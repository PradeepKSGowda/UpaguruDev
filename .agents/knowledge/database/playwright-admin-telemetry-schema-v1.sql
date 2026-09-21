-- =============================================================================
-- Migration: Playwright Admin HITL Flow E2E Test Telemetry Schema (v1.0.0)
-- Task Reference: TASK-09020102 (Subtask: SUB-0902010201)
-- Architecture Reference: ADR-002 (Database), ADR-003 (RBAC), ADR-013 (Security)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security & RBAC)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: public.qa_admin_e2e_test_runs
-- Stores End-to-End browser test telemetry for administrative Human-in-the-Loop
-- (HITL) workflows: authentication guards, draft queue triage, side-by-side
-- verification workspace, approval/publishing, portal sync, and rejection modals.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_admin_e2e_test_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spec_name TEXT NOT NULL,                         -- e.g. 'admin-hitl-flow.spec.ts'
    browser_project TEXT NOT NULL,                   -- 'chromium', 'firefox', 'webkit'
    test_title TEXT NOT NULL,                        -- Test case identifier and title
    hitl_phase TEXT NOT NULL,                        -- 'auth_guard', 'admin_login', 'draft_queue', 'review_workspace', 'approval_publish', 'portal_sync', 'rejection_guard'
    status TEXT NOT NULL DEFAULT 'passed',           -- 'passed', 'failed', 'timedOut', 'skipped'
    duration_ms INTEGER,
    retry_count INTEGER NOT NULL DEFAULT 0,
    draft_id_tested TEXT,
    error_message TEXT,
    trace_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance and analytical indexing
CREATE INDEX IF NOT EXISTS idx_qa_admin_e2e_spec_created 
    ON public.qa_admin_e2e_test_runs (spec_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_admin_e2e_status 
    ON public.qa_admin_e2e_test_runs (status);

CREATE INDEX IF NOT EXISTS idx_qa_admin_e2e_phase 
    ON public.qa_admin_e2e_test_runs (hitl_phase);

CREATE INDEX IF NOT EXISTS idx_qa_admin_e2e_browser 
    ON public.qa_admin_e2e_test_runs (browser_project);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.qa_admin_e2e_test_runs ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "Admin select policy for qa_admin_e2e_test_runs" ON public.qa_admin_e2e_test_runs;
DROP POLICY IF EXISTS "Service role all policy for qa_admin_e2e_test_runs" ON public.qa_admin_e2e_test_runs;

CREATE POLICY "Admin select policy for qa_admin_e2e_test_runs"
    ON public.qa_admin_e2e_test_runs
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

CREATE POLICY "Service role all policy for qa_admin_e2e_test_runs"
    ON public.qa_admin_e2e_test_runs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. Stored Procedure: public.record_playwright_admin_test_run
-- Thread-safe security definer function for logging automated E2E test results.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_playwright_admin_test_run(
    p_spec_name TEXT,
    p_browser_project TEXT,
    p_test_title TEXT,
    p_hitl_phase TEXT,
    p_status TEXT DEFAULT 'passed',
    p_duration_ms INTEGER DEFAULT NULL,
    p_retry_count INTEGER DEFAULT 0,
    p_draft_id_tested TEXT DEFAULT NULL,
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
    INSERT INTO public.qa_admin_e2e_test_runs (
        spec_name,
        browser_project,
        test_title,
        hitl_phase,
        status,
        duration_ms,
        retry_count,
        draft_id_tested,
        error_message,
        trace_url,
        created_at
    ) VALUES (
        p_spec_name,
        p_browser_project,
        p_test_title,
        p_hitl_phase,
        p_status,
        p_duration_ms,
        p_retry_count,
        p_draft_id_tested,
        p_error_message,
        p_trace_url,
        NOW()
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;
