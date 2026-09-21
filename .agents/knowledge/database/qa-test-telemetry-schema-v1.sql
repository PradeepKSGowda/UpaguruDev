-- =============================================================================
-- Migration: QA Test Execution & Coverage Telemetry Schema (v1.0.0)
-- Task Reference: TASK-09010101 (Subtask: SUB-0901010101)
-- Architecture Reference: ADR-002 (Database), ADR-013 (Security)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security & RBAC)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: public.qa_test_runs
-- Stores automated test run metrics (Vitest unit tests, Playwright E2E, Lighthouse)
-- to track stability, regression frequency, and code coverage over time.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    suite_name TEXT NOT NULL, -- 'vitest-unit', 'playwright-e2e', 'lighthouse-audit'
    environment TEXT NOT NULL DEFAULT 'local', -- 'local', 'ci', 'staging'
    total_tests INTEGER NOT NULL DEFAULT 0,
    passed_tests INTEGER NOT NULL DEFAULT 0,
    failed_tests INTEGER NOT NULL DEFAULT 0,
    skipped_tests INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER,
    line_coverage_pct NUMERIC(5,2),
    branch_coverage_pct NUMERIC(5,2),
    git_commit_sha TEXT,
    git_branch TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance and analytical indexing
CREATE INDEX IF NOT EXISTS idx_qa_test_runs_suite_created 
    ON public.qa_test_runs (suite_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_test_runs_commit 
    ON public.qa_test_runs (git_commit_sha);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.qa_test_runs ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "Admin select policy for qa_test_runs" ON public.qa_test_runs;
DROP POLICY IF EXISTS "Service role all policy for qa_test_runs" ON public.qa_test_runs;

CREATE POLICY "Admin select policy for qa_test_runs"
    ON public.qa_test_runs
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

CREATE POLICY "Service role all policy for qa_test_runs"
    ON public.qa_test_runs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. Stored Procedure: public.record_qa_test_run
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_qa_test_run(
    p_suite_name TEXT,
    p_environment TEXT DEFAULT 'local',
    p_total_tests INTEGER DEFAULT 0,
    p_passed_tests INTEGER DEFAULT 0,
    p_failed_tests INTEGER DEFAULT 0,
    p_skipped_tests INTEGER DEFAULT 0,
    p_duration_ms INTEGER DEFAULT NULL,
    p_line_coverage_pct NUMERIC(5,2) DEFAULT NULL,
    p_branch_coverage_pct NUMERIC(5,2) DEFAULT NULL,
    p_git_commit_sha TEXT DEFAULT NULL,
    p_git_branch TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.qa_test_runs (
        suite_name,
        environment,
        total_tests,
        passed_tests,
        failed_tests,
        skipped_tests,
        duration_ms,
        line_coverage_pct,
        branch_coverage_pct,
        git_commit_sha,
        git_branch,
        created_at
    ) VALUES (
        p_suite_name,
        p_environment,
        p_total_tests,
        p_passed_tests,
        p_failed_tests,
        p_skipped_tests,
        p_duration_ms,
        p_line_coverage_pct,
        p_branch_coverage_pct,
        p_git_commit_sha,
        p_git_branch,
        NOW()
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_qa_test_run(TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, TEXT, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_qa_test_run(TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC, NUMERIC, TEXT, TEXT) FROM anon, public;

COMMENT ON TABLE public.qa_test_runs IS 'Audit table for unit test, E2E, and performance benchmark test execution metrics';
COMMENT ON FUNCTION public.record_qa_test_run IS 'Security definer procedure to record automated QA test run telemetry';
