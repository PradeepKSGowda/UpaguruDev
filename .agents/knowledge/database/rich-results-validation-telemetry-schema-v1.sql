-- =============================================================================
-- Migration: Google Rich Results & Schema.org Validation Telemetry Schema (v1.0.0)
-- Task Reference: TASK-09030102 (Subtask: SUB-0903010201)
-- Architecture Reference: ADR-002 (Database), ADR-008 (Programmatic SEO & Structured Data)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security & RBAC), Rule 4 (SEO Target >= 95)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: public.qa_rich_results_validation_logs
-- Tracks automated and manual validation runs across Google Rich Results Test,
-- Schema Markup Validator, and local Vitest suites for JobPosting, Event, and
-- BreadcrumbList structured data markup.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.qa_rich_results_validation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    page_url TEXT NOT NULL,                          -- e.g. '/notification/upsc-civil-services-examination-2026'
    schema_type TEXT NOT NULL,                       -- 'JobPosting', 'Event', 'BreadcrumbList', 'WebSite'
    validation_tool TEXT NOT NULL,                   -- 'Google Rich Results Test', 'Schema Markup Validator', 'Vitest'
    status TEXT NOT NULL DEFAULT 'valid',            -- 'valid', 'valid_with_warnings', 'invalid'
    errors_count INTEGER NOT NULL DEFAULT 0,
    warnings_count INTEGER NOT NULL DEFAULT 0,
    detected_items JSONB,                            -- Parsed entities detected by test tool
    raw_issues JSONB,                                -- Error messages, missing recommended properties
    validated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance and analytical indexing
CREATE INDEX IF NOT EXISTS idx_qa_rich_results_url_created 
    ON public.qa_rich_results_validation_logs (page_url, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qa_rich_results_schema_status 
    ON public.qa_rich_results_validation_logs (schema_type, status);

CREATE INDEX IF NOT EXISTS idx_qa_rich_results_tool 
    ON public.qa_rich_results_validation_logs (validation_tool);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.qa_rich_results_validation_logs ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "Admin select policy for qa_rich_results_validation_logs" ON public.qa_rich_results_validation_logs;
DROP POLICY IF EXISTS "Service role all policy for qa_rich_results_validation_logs" ON public.qa_rich_results_validation_logs;

CREATE POLICY "Admin select policy for qa_rich_results_validation_logs"
    ON public.qa_rich_results_validation_logs
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

CREATE POLICY "Service role all policy for qa_rich_results_validation_logs"
    ON public.qa_rich_results_validation_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. Stored Procedure: public.record_rich_results_validation
-- Ingests validation results and error logs into the audit ledger.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_rich_results_validation(
    p_page_url TEXT,
    p_schema_type TEXT,
    p_validation_tool TEXT,
    p_status TEXT DEFAULT 'valid',
    p_errors_count INTEGER DEFAULT 0,
    p_warnings_count INTEGER DEFAULT 0,
    p_detected_items JSONB DEFAULT NULL,
    p_raw_issues JSONB DEFAULT NULL,
    p_validated_by UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.qa_rich_results_validation_logs (
        page_url,
        schema_type,
        validation_tool,
        status,
        errors_count,
        warnings_count,
        detected_items,
        raw_issues,
        validated_by,
        created_at
    ) VALUES (
        p_page_url,
        p_schema_type,
        p_validation_tool,
        p_status,
        p_errors_count,
        p_warnings_count,
        p_detected_items,
        p_raw_issues,
        p_validated_by,
        NOW()
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;
