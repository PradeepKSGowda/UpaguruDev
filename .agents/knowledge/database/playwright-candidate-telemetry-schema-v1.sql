-- =============================================================================
-- Migration: Playwright Candidate Flow E2E Test Telemetry Schema (v1.0.0)
-- Task Reference: TASK-09020101 (Subtask: SUB-0902010101)
-- Architecture Reference: ADR-002 (Database), ADR-013 (Security)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security & RBAC)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: public.qa_playwright_test_runs
-- Stores End-to-End browser test run execution telemetry across desktop and
-- mobile viewports, tracking multi-step candidate user journeys.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_playwright_test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spec_name TEXT NOT NULL,                         -- e.g. 'candidate-flow.spec.ts'
    browser_project TEXT NOT NULL,                   -- 'chromium', 'firefox', 'webkit', 'Mobile Chrome'
    test_title TEXT NOT NULL,                        -- Test case identifier and description
    journey_stage TEXT NOT NULL,                     -- 'home', 'filtering', 'search', 'detail', 'mobile'
    status TEXT NOT NULL DEFAULT 'passed',           -- 'passed', 'failed', 'timedOut', 'skipped'
    duration_ms INTEGER,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    trace_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance and analytical indexing
CREATE INDEX IF NOT EXISTS idx_qa_playwright_spec_created 
    ON public.qa_playwright_test_runs (spec_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_playwright_status 
    ON public.qa_playwright_test_runs (status);

CREATE INDEX IF NOT EXISTS idx_qa_playwright_browser 
    ON public.qa_playwright_test_runs (browser_project);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.qa_playwright_test_runs ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "Admin select policy for qa_playwright_test_runs" ON public.qa_playwright_test_runs;
DROP POLICY IF EXISTS "Service role all policy for qa_playwright_test_runs" ON public.qa_playwright_test_runs;

CREATE POLICY "Admin select policy for qa_playwright_test_runs"
    ON public.qa_playwright_test_runs
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

CREATE POLICY "Service role all policy for qa_playwright_test_runs"
    ON public.qa_playwright_test_runs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. Stored Procedure: public.record_playwright_candidate_test_run
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_playwright_candidate_test_run(
    p_spec_name TEXT,
    p_browser_project TEXT,
    p_test_title TEXT,
    p_journey_stage TEXT,
    p_status TEXT DEFAULT 'passed',
    p_duration_ms INTEGER DEFAULT NULL,
    p_retry_count INTEGER DEFAULT 0,
    p_error_message TEXT DEFAULT NULL,
    p_trace_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.qa_playwright_test_runs (
        spec_name,
        browser_project,
        test_title,
        journey_stage,
        status,
        duration_ms,
        retry_count,
        error_message,
        trace_url,
        created_at
    ) VALUES (
        p_spec_name,
        p_browser_project,
        p_test_title,
        p_journey_stage,
        p_status,
        p_duration_ms,
        p_retry_count,
        p_error_message,
        p_trace_url,
        NOW()
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_playwright_candidate_test_run(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_playwright_candidate_test_run(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT) FROM anon, public;

COMMENT ON TABLE public.qa_playwright_test_runs IS 'Telemetry table recording automated Playwright E2E browser test runs and journey milestones';
COMMENT ON FUNCTION public.record_playwright_candidate_test_run IS 'Security definer procedure to record automated Playwright E2E test telemetry';
