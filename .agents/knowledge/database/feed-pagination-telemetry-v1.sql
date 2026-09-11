-- =============================================================================
-- Migration: Feed Pagination Telemetry & Category Distribution Function (v1.0.0)
-- Task Reference: TASK-02020104 (Subtasks: SUB-0202010401, SUB-0202010402)
-- Architecture Reference: ADR-002 (Database), ADR-008 (SEO & Edge Caching), ADR-013 (Security)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security)
-- =============================================================================

-- Ensure uuid extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: portal_feed_impressions
-- Captures anonymous and authenticated feed page transitions, active filters,
-- and pagination depth to monitor candidate engagement and identify abandoned searches.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portal_feed_impressions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    category_filter exam_category_enum,
    state_filter TEXT,
    page_number INTEGER NOT NULL DEFAULT 1,
    page_size INTEGER NOT NULL DEFAULT 12,
    results_returned INTEGER NOT NULL DEFAULT 0,
    total_matching INTEGER NOT NULL DEFAULT 0,
    sort_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for aggregate pagination depth and filter analytics
CREATE INDEX IF NOT EXISTS idx_feed_impressions_created 
    ON public.portal_feed_impressions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_feed_impressions_page 
    ON public.portal_feed_impressions (page_number);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.portal_feed_impressions ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. Explicit Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------

-- Policy: Anyone (authenticated or anonymous candidate) can log feed page impression
CREATE POLICY "Public log feed impressions"
    ON public.portal_feed_impressions
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Policy: Only Platform Administrators can analyze impression telemetry
CREATE POLICY "Admins read impression telemetry"
    ON public.portal_feed_impressions
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

-- -----------------------------------------------------------------------------
-- 3. Stored Function: get_category_notification_counts()
-- Returns active published notification counts grouped by exam category
-- for instant badge rendering and Redis edge caching.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_category_notification_counts()
RETURNS TABLE (
    category exam_category_enum,
    active_count BIGINT
) 
LANGUAGE sql 
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT 
        e.category,
        COUNT(n.id) AS active_count
    FROM public.exams e
    LEFT JOIN public.notifications n 
        ON n.exam_id = e.id AND n.status = 'published'
    GROUP BY e.category
    ORDER BY active_count DESC;
$$;

-- Grant execution to public candidates and service roles
GRANT EXECUTE ON FUNCTION public.get_category_notification_counts() TO anon, authenticated, service_role;
