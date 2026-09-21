-- =============================================================================
-- Migration: Schema.org JSON-LD Structured Data QA Telemetry Schema (v1.0.0)
-- Task Reference: TASK-09010103 (Subtask: SUB-0901010301)
-- Architecture Reference: ADR-002 (Database), ADR-008 (Programmatic SEO), ADR-013 (Security)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security & RBAC)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: public.qa_jsonld_validation_logs
-- Stores unit test verification metrics for Schema.org JSON-LD generators
-- (JobPosting, Event, BreadcrumbList) to track Google Rich Results compliance.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_jsonld_validation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schema_type TEXT NOT NULL,                  -- 'JobPosting', 'Event', 'BreadcrumbList', 'AllNotificationSchemas'
    target_entity_slug TEXT,                    -- e.g. 'upsc-civil-services-2026'
    google_rich_results_compliant BOOLEAN NOT NULL DEFAULT true,
    missing_required_properties TEXT[] DEFAULT '{}',
    missing_recommended_properties TEXT[] DEFAULT '{}',
    test_suite TEXT NOT NULL DEFAULT 'vitest-jsonld-unit',
    total_assertions INTEGER NOT NULL DEFAULT 0,
    execution_status TEXT NOT NULL DEFAULT 'passed', -- 'passed', 'failed', 'pending'
    execution_duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance and analytical indexing
CREATE INDEX IF NOT EXISTS idx_qa_jsonld_type_created 
    ON public.qa_jsonld_validation_logs (schema_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_jsonld_status 
    ON public.qa_jsonld_validation_logs (execution_status);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.qa_jsonld_validation_logs ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "Admin select policy for qa_jsonld_validation_logs" ON public.qa_jsonld_validation_logs;
DROP POLICY IF EXISTS "Service role all policy for qa_jsonld_validation_logs" ON public.qa_jsonld_validation_logs;

CREATE POLICY "Admin select policy for qa_jsonld_validation_logs"
    ON public.qa_jsonld_validation_logs
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

CREATE POLICY "Service role all policy for qa_jsonld_validation_logs"
    ON public.qa_jsonld_validation_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. Stored Procedure: public.record_jsonld_validation_test_telemetry
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_jsonld_validation_test_telemetry(
    p_schema_type TEXT,
    p_target_entity_slug TEXT DEFAULT NULL,
    p_google_rich_results_compliant BOOLEAN DEFAULT true,
    p_missing_required_properties TEXT[] DEFAULT '{}',
    p_missing_recommended_properties TEXT[] DEFAULT '{}',
    p_test_suite TEXT DEFAULT 'vitest-jsonld-unit',
    p_total_assertions INTEGER DEFAULT 0,
    p_execution_status TEXT DEFAULT 'passed',
    p_execution_duration_ms INTEGER DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.qa_jsonld_validation_logs (
        schema_type,
        target_entity_slug,
        google_rich_results_compliant,
        missing_required_properties,
        missing_recommended_properties,
        test_suite,
        total_assertions,
        execution_status,
        execution_duration_ms,
        created_at
    ) VALUES (
        p_schema_type,
        p_target_entity_slug,
        p_google_rich_results_compliant,
        p_missing_required_properties,
        p_missing_recommended_properties,
        p_test_suite,
        p_total_assertions,
        p_execution_status,
        p_execution_duration_ms,
        NOW()
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_jsonld_validation_test_telemetry(TEXT, TEXT, BOOLEAN, TEXT[], TEXT[], TEXT, INTEGER, TEXT, INTEGER) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_jsonld_validation_test_telemetry(TEXT, TEXT, BOOLEAN, TEXT[], TEXT[], TEXT, INTEGER, TEXT, INTEGER) FROM anon, public;

COMMENT ON TABLE public.qa_jsonld_validation_logs IS 'Telemetry table tracking Schema.org JSON-LD test execution metrics and Google Rich Results conformance';
COMMENT ON FUNCTION public.record_jsonld_validation_test_telemetry IS 'Security definer procedure to record automated Schema.org structured data test telemetry';
