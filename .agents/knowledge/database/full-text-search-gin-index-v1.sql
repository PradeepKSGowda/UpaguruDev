-- =====================================================================================
-- Migration: PostgreSQL GIN Indexes & Full-Text Search Optimization (v1.0.0)
-- Document ID: SCHEMA-SEARCH-GIN-001
-- Task ID: TASK-02040101 (Subtask: SUB-0204010101)
-- Complies with: ADR-002 (Database Schema), AGENTS.md (Rule 3: Mandatory RLS)
-- =====================================================================================

-- Ensure text search extensions exist
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- -------------------------------------------------------------------------------------
-- 1. Generated Column & GIN Indexes on public.notifications
-- -------------------------------------------------------------------------------------

-- Add stored tsvector column on notifications with weighted lexemes
-- Weight A: Title (highest relevance)
-- Weight B: Notification Number
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS fts tsvector 
GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(notification_number, '')), 'B')
) STORED;

-- GIN Index on the stored fts column
CREATE INDEX IF NOT EXISTS idx_notifications_fts 
    ON public.notifications USING GIN(fts);

-- Functional GIN Index on to_tsvector('english', title) for direct PostgREST .textSearch()
CREATE INDEX IF NOT EXISTS idx_notifications_title_fts 
    ON public.notifications USING GIN(to_tsvector('english', title));

-- -------------------------------------------------------------------------------------
-- 2. GIN Full-Text Indexes on public.exams
-- -------------------------------------------------------------------------------------

-- Index for searching conducting body (UPSC, KPSC, SSC, IBPS, RRB)
CREATE INDEX IF NOT EXISTS idx_exams_conducting_body_fts 
    ON public.exams USING GIN(to_tsvector('english', conducting_body));

-- Index for searching exam series title
CREATE INDEX IF NOT EXISTS idx_exams_title_fts 
    ON public.exams USING GIN(to_tsvector('english', title));

-- -------------------------------------------------------------------------------------
-- 3. Search Performance & Telemetry Table with Mandatory RLS
-- -------------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.search_performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text TEXT NOT NULL,
    category_filter TEXT,
    state_filter TEXT,
    results_count INTEGER NOT NULL DEFAULT 0,
    execution_time_ms NUMERIC(8, 2) NOT NULL DEFAULT 0.00,
    user_agent TEXT,
    client_ip_hash VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Performance indexes for analytics
CREATE INDEX IF NOT EXISTS idx_search_metrics_created_at 
    ON public.search_performance_metrics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_metrics_zero_results 
    ON public.search_performance_metrics(results_count, created_at DESC) 
    WHERE results_count = 0;

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.search_performance_metrics ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies

-- Allow anonymous and authenticated candidates to log search execution telemetry
DROP POLICY IF EXISTS "Allow public insert for search metrics" ON public.search_performance_metrics;
CREATE POLICY "Allow public insert for search metrics"
    ON public.search_performance_metrics
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Restrict read access strictly to platform administrators
DROP POLICY IF EXISTS "Allow admins read access to search metrics" ON public.search_performance_metrics;
CREATE POLICY "Allow admins read access to search metrics"
    ON public.search_performance_metrics
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    );

-- Prohibit direct updates to preserve telemetry integrity
DROP POLICY IF EXISTS "Prevent updates on search metrics" ON public.search_performance_metrics;
CREATE POLICY "Prevent updates on search metrics"
    ON public.search_performance_metrics
    FOR UPDATE
    TO authenticated
    USING (false);

-- Prohibit deletions except by super_admins during database maintenance
DROP POLICY IF EXISTS "Allow super_admins to delete search metrics" ON public.search_performance_metrics;
CREATE POLICY "Allow super_admins to delete search metrics"
    ON public.search_performance_metrics
    FOR DELETE
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text = 'super_admin'
        )
    );

-- -------------------------------------------------------------------------------------
-- 4. High-Performance PostgreSQL Full-Text Search RPC Function
-- -------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.search_published_notifications(
    search_query TEXT,
    category_filter TEXT DEFAULT NULL,
    state_filter TEXT DEFAULT NULL,
    page_num INT DEFAULT 1,
    page_size INT DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    slug TEXT,
    title TEXT,
    notification_number TEXT,
    total_vacancies INT,
    application_start_date DATE,
    application_end_date DATE,
    exam_date DATE,
    qualification_required TEXT[],
    age_limit_min INT,
    age_limit_max INT,
    status notification_status_enum,
    published_at TIMESTAMPTZ,
    rank REAL,
    total_count BIGINT,
    exam_id UUID,
    exam_slug TEXT,
    exam_title TEXT,
    exam_conducting_body TEXT,
    exam_category exam_category_enum,
    exam_state_or_central TEXT,
    exam_official_website TEXT,
    exam_logo_url TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    parsed_query tsquery;
    offset_val INT;
BEGIN
    -- Parse query using websearch syntax (supports "quotes", +, -)
    parsed_query := websearch_to_tsquery('english', search_query);
    offset_val := GREATEST((page_num - 1) * page_size, 0);

    RETURN QUERY
    WITH filtered_notifications AS (
        SELECT 
            n.id,
            n.slug,
            n.title,
            n.notification_number,
            n.total_vacancies,
            n.application_start_date,
            n.application_end_date,
            n.exam_date,
            n.qualification_required,
            n.age_limit_min,
            n.age_limit_max,
            n.status,
            n.published_at,
            (
                ts_rank_cd(n.fts, parsed_query) * 1.5 +
                ts_rank(to_tsvector('english', e.conducting_body), parsed_query) * 1.0 +
                ts_rank(to_tsvector('english', e.title), parsed_query) * 0.8
            )::REAL AS match_rank,
            COUNT(*) OVER() AS full_count,
            e.id AS e_id,
            e.slug AS e_slug,
            e.title AS e_title,
            e.conducting_body AS e_conducting_body,
            e.category AS e_category,
            e.state_or_central AS e_state_or_central,
            e.official_website AS e_official_website,
            e.logo_url AS e_logo_url
        FROM public.notifications n
        INNER JOIN public.exams e ON n.exam_id = e.id
        WHERE n.status = 'published'
          AND (
              n.fts @@ parsed_query
              OR to_tsvector('english', e.conducting_body) @@ parsed_query
              OR to_tsvector('english', e.title) @@ parsed_query
          )
          AND (category_filter IS NULL OR category_filter = 'all' OR e.category::text = category_filter)
          AND (state_filter IS NULL OR state_filter = 'all' OR e.state_or_central ILIKE '%' || state_filter || '%')
    )
    SELECT 
        fn.id,
        fn.slug,
        fn.title,
        fn.notification_number,
        fn.total_vacancies,
        fn.application_start_date,
        fn.application_end_date,
        fn.exam_date,
        fn.qualification_required,
        fn.age_limit_min,
        fn.age_limit_max,
        fn.status,
        fn.published_at,
        fn.match_rank AS rank,
        fn.full_count AS total_count,
        fn.e_id AS exam_id,
        fn.e_slug AS exam_slug,
        fn.e_title AS exam_title,
        fn.e_conducting_body AS exam_conducting_body,
        fn.e_category AS exam_category,
        fn.e_state_or_central AS exam_state_or_central,
        fn.e_official_website AS exam_official_website,
        fn.e_logo_url AS exam_logo_url
    FROM filtered_notifications fn
    ORDER BY fn.match_rank DESC, fn.application_end_date ASC
    LIMIT page_size
    OFFSET offset_val;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.search_published_notifications(TEXT, TEXT, TEXT, INT, INT) TO anon, authenticated;

-- Comments
COMMENT ON INDEX public.idx_notifications_fts IS 'GIN full-text search index on notifications title and number.';
COMMENT ON INDEX public.idx_exams_conducting_body_fts IS 'GIN full-text search index on conducting body abbreviations and names.';
COMMENT ON FUNCTION public.search_published_notifications IS 'PostgreSQL full-text search RPC query utilizing GIN indexes, multi-attribute relevance ranking, and server-side pagination.';
