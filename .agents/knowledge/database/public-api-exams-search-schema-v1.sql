-- =============================================================================
-- Migration: Public REST API v1 Exams & Search Telemetry Schema (v1.0.0)
-- Task Reference: TASK-08010102 (Subtask: SUB-0801010201)
-- Architecture Reference: ADR-002 (Database), ADR-006 (Search), ADR-010 (Caching), ADR-013 (Security), ADR-014 (API Design)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security & RBAC)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Performance Indexes on public.exams
-- Accelerates GET /api/v1/exams query filtering, pagination, and sorting
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_exams_category_state 
    ON public.exams (category, state_or_central);

CREATE INDEX IF NOT EXISTS idx_exams_title_slug 
    ON public.exams (title, slug);

-- -----------------------------------------------------------------------------
-- 2. Table: public.api_search_telemetry
-- Records external API search queries, frequency, matching result counts,
-- and execution duration to identify keyword demand and trending recruitment searches.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_search_telemetry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    query_text TEXT NOT NULL,
    category_filter TEXT,
    state_filter TEXT,
    sort_strategy TEXT DEFAULT 'relevance',
    results_count INTEGER NOT NULL DEFAULT 0,
    execution_time_ms INTEGER,
    client_ip TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance and analytical indexing
CREATE INDEX IF NOT EXISTS idx_api_search_telemetry_created 
    ON public.api_search_telemetry (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_search_telemetry_query 
    ON public.api_search_telemetry (query_text, created_at DESC);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.api_search_telemetry ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "Admin select policy for api_search_telemetry" ON public.api_search_telemetry;
DROP POLICY IF EXISTS "Service role all policy for api_search_telemetry" ON public.api_search_telemetry;

CREATE POLICY "Admin select policy for api_search_telemetry"
    ON public.api_search_telemetry
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

CREATE POLICY "Service role all policy for api_search_telemetry"
    ON public.api_search_telemetry
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 3. Stored Procedure: public.record_api_search_telemetry
-- Idempotent logging helper callable by Next.js search route handlers.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_api_search_telemetry(
    p_query_text TEXT,
    p_category_filter TEXT DEFAULT NULL,
    p_state_filter TEXT DEFAULT NULL,
    p_sort_strategy TEXT DEFAULT 'relevance',
    p_results_count INTEGER DEFAULT 0,
    p_execution_time_ms INTEGER DEFAULT NULL,
    p_client_ip TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.api_search_telemetry (
        query_text,
        category_filter,
        state_filter,
        sort_strategy,
        results_count,
        execution_time_ms,
        client_ip,
        user_agent,
        created_at
    ) VALUES (
        p_query_text,
        p_category_filter,
        p_state_filter,
        p_sort_strategy,
        p_results_count,
        p_execution_time_ms,
        p_client_ip,
        p_user_agent,
        NOW()
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_api_search_telemetry(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_api_search_telemetry(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) FROM anon, public;

COMMENT ON TABLE public.api_search_telemetry IS 'Audit and analytics telemetry of Public REST API search queries and result counts';
COMMENT ON FUNCTION public.record_api_search_telemetry IS 'Persists API search query telemetry from Next.js server route handlers';
