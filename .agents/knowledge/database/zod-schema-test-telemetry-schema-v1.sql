-- =============================================================================
-- Migration: Zod Schema Validation QA Telemetry Schema (v1.0.0)
-- Task Reference: TASK-09010102 (Subtask: SUB-0901010201)
-- Architecture Reference: ADR-002 (Database), ADR-013 (Security)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security & RBAC)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: public.qa_schema_validation_logs
-- Stores unit test verification metrics for Zod schemas across administrative,
-- candidate, feed, and subscription endpoints to track schema resilience.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_schema_validation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schema_name TEXT NOT NULL,           -- e.g. 'notificationFilterSchema', 'adminNotificationInputSchema'
    module_path TEXT NOT NULL,           -- e.g. 'lib/schemas/admin-notifications.ts'
    test_file_path TEXT NOT NULL,        -- e.g. 'tests/unit/schemas/admin-notifications.test.ts'
    test_suite TEXT NOT NULL DEFAULT 'vitest-zod-unit',
    total_assertions INTEGER NOT NULL DEFAULT 0,
    valid_cases_tested INTEGER NOT NULL DEFAULT 0,
    invalid_cases_tested INTEGER NOT NULL DEFAULT 0,
    boundary_cases_tested INTEGER NOT NULL DEFAULT 0,
    coercion_cases_tested INTEGER NOT NULL DEFAULT 0,
    execution_status TEXT NOT NULL DEFAULT 'passed', -- 'passed', 'failed', 'pending'
    execution_duration_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance and analytical indexing
CREATE INDEX IF NOT EXISTS idx_qa_schema_logs_name_created 
    ON public.qa_schema_validation_logs (schema_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_schema_logs_status 
    ON public.qa_schema_validation_logs (execution_status);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.qa_schema_validation_logs ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "Admin select policy for qa_schema_validation_logs" ON public.qa_schema_validation_logs;
DROP POLICY IF EXISTS "Service role all policy for qa_schema_validation_logs" ON public.qa_schema_validation_logs;

CREATE POLICY "Admin select policy for qa_schema_validation_logs"
    ON public.qa_schema_validation_logs
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

CREATE POLICY "Service role all policy for qa_schema_validation_logs"
    ON public.qa_schema_validation_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. Stored Procedure: public.record_schema_validation_test_telemetry
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_schema_validation_test_telemetry(
    p_schema_name TEXT,
    p_module_path TEXT,
    p_test_file_path TEXT,
    p_test_suite TEXT DEFAULT 'vitest-zod-unit',
    p_total_assertions INTEGER DEFAULT 0,
    p_valid_cases_tested INTEGER DEFAULT 0,
    p_invalid_cases_tested INTEGER DEFAULT 0,
    p_boundary_cases_tested INTEGER DEFAULT 0,
    p_coercion_cases_tested INTEGER DEFAULT 0,
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
    INSERT INTO public.qa_schema_validation_logs (
        schema_name,
        module_path,
        test_file_path,
        test_suite,
        total_assertions,
        valid_cases_tested,
        invalid_cases_tested,
        boundary_cases_tested,
        coercion_cases_tested,
        execution_status,
        execution_duration_ms,
        created_at
    ) VALUES (
        p_schema_name,
        p_module_path,
        p_test_file_path,
        p_test_suite,
        p_total_assertions,
        p_valid_cases_tested,
        p_invalid_cases_tested,
        p_boundary_cases_tested,
        p_coercion_cases_tested,
        p_execution_status,
        p_execution_duration_ms,
        NOW()
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_schema_validation_test_telemetry(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, INTEGER) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_schema_validation_test_telemetry(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, INTEGER) FROM anon, public;

COMMENT ON TABLE public.qa_schema_validation_logs IS 'Telemetry and audit table tracking Zod validation schema unit test coverage and edge-case execution results';
COMMENT ON FUNCTION public.record_schema_validation_test_telemetry IS 'Security definer procedure to record automated Zod schema verification metrics';
