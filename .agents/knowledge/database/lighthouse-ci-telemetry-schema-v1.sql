-- =============================================================================
-- Migration: Lighthouse CI Audit Telemetry & Performance Tracking Schema (v1.0.0)
-- Task Reference: TASK-09030101 (Subtask: SUB-0903010101)
-- Architecture Reference: ADR-002 (Database), ADR-008 (Programmatic SEO & Web Vitals)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security & RBAC), Rule 4 (Lighthouse Target >= 95)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: public.qa_lighthouse_audit_runs
-- Stores automated Lighthouse CI audit telemetry across critical candidate routes,
-- recording category scores (Performance, SEO, Accessibility, Best Practices) and
-- Core Web Vitals (LCP, FCP, CLS, TBT) with status pass/fail tracking.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_lighthouse_audit_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    audit_url TEXT NOT NULL,                         -- e.g. 'http://localhost:3000/'
    form_factor TEXT NOT NULL DEFAULT 'mobile',      -- 'mobile' or 'desktop'
    performance_score NUMERIC(4, 2) NOT NULL,        -- 0.00 to 1.00 (target >= 0.95)
    seo_score NUMERIC(4, 2) NOT NULL,                -- 0.00 to 1.00 (target >= 0.95)
    accessibility_score NUMERIC(4, 2),               -- 0.00 to 1.00 (target >= 0.90)
    best_practices_score NUMERIC(4, 2),              -- 0.00 to 1.00 (target >= 0.90)
    lcp_ms NUMERIC(8, 2),                            -- Largest Contentful Paint (target <= 2500ms)
    fcp_ms NUMERIC(8, 2),                            -- First Contentful Paint (target <= 1800ms)
    cls NUMERIC(6, 4),                               -- Cumulative Layout Shift (target <= 0.10)
    tbt_ms NUMERIC(8, 2),                            -- Total Blocking Time (target <= 200ms)
    status TEXT NOT NULL DEFAULT 'passed',           -- 'passed', 'failed', 'warning'
    report_path TEXT,                                -- Local or CDN artifact path
    raw_summary JSONB,                               -- Full audit score breakdown
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Analytical and time-series query indexing
CREATE INDEX IF NOT EXISTS idx_qa_lh_url_created 
    ON public.qa_lighthouse_audit_runs (audit_url, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_lh_status 
    ON public.qa_lighthouse_audit_runs (status);

CREATE INDEX IF NOT EXISTS idx_qa_lh_scores 
    ON public.qa_lighthouse_audit_runs (performance_score, seo_score);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.qa_lighthouse_audit_runs ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "Admin select policy for qa_lighthouse_audit_runs" ON public.qa_lighthouse_audit_runs;
DROP POLICY IF EXISTS "Service role all policy for qa_lighthouse_audit_runs" ON public.qa_lighthouse_audit_runs;

CREATE POLICY "Admin select policy for qa_lighthouse_audit_runs"
    ON public.qa_lighthouse_audit_runs
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

CREATE POLICY "Service role all policy for qa_lighthouse_audit_runs"
    ON public.qa_lighthouse_audit_runs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. Stored Procedure: public.record_lighthouse_audit_run
-- Security definer stored procedure to ingest Lighthouse CI telemetry.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_lighthouse_audit_run(
    p_audit_url TEXT,
    p_form_factor TEXT DEFAULT 'mobile',
    p_performance_score NUMERIC DEFAULT 1.00,
    p_seo_score NUMERIC DEFAULT 1.00,
    p_accessibility_score NUMERIC DEFAULT NULL,
    p_best_practices_score NUMERIC DEFAULT NULL,
    p_lcp_ms NUMERIC DEFAULT NULL,
    p_fcp_ms NUMERIC DEFAULT NULL,
    p_cls NUMERIC DEFAULT NULL,
    p_tbt_ms NUMERIC DEFAULT NULL,
    p_status TEXT DEFAULT 'passed',
    p_report_path TEXT DEFAULT NULL,
    p_raw_summary JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.qa_lighthouse_audit_runs (
        audit_url,
        form_factor,
        performance_score,
        seo_score,
        accessibility_score,
        best_practices_score,
        lcp_ms,
        fcp_ms,
        cls,
        tbt_ms,
        status,
        report_path,
        raw_summary,
        created_at
    ) VALUES (
        p_audit_url,
        p_form_factor,
        p_performance_score,
        p_seo_score,
        p_accessibility_score,
        p_best_practices_score,
        p_lcp_ms,
        p_fcp_ms,
        p_cls,
        p_tbt_ms,
        p_status,
        p_report_path,
        p_raw_summary,
        NOW()
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;
