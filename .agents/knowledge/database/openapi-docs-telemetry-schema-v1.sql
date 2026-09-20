-- =============================================================================
-- Migration: OpenAPI 3.0 Documentation Telemetry Schema (v1.0.0)
-- Task Reference: TASK-08020101 (Subtask: SUB-0802010101)
-- Architecture Reference: ADR-002 (Database), ADR-010 (Caching), ADR-013 (Security), ADR-014 (API Design)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security & RBAC)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: public.api_docs_access_logs
-- Records visits to /api/docs and OpenAPI spec downloads for developer ecosystem metrics.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_docs_access_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_ip TEXT,
    user_agent TEXT,
    format_requested TEXT DEFAULT 'html', -- 'html', 'yaml', 'json'
    referer TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance and analytical indexing
CREATE INDEX IF NOT EXISTS idx_api_docs_access_logs_created 
    ON public.api_docs_access_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_docs_access_logs_format 
    ON public.api_docs_access_logs (format_requested, created_at DESC);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.api_docs_access_logs ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policies
DROP POLICY IF EXISTS "Admin select policy for api_docs_access_logs" ON public.api_docs_access_logs;
DROP POLICY IF EXISTS "Service role all policy for api_docs_access_logs" ON public.api_docs_access_logs;

CREATE POLICY "Admin select policy for api_docs_access_logs"
    ON public.api_docs_access_logs
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

CREATE POLICY "Service role all policy for api_docs_access_logs"
    ON public.api_docs_access_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. Stored Procedure: public.record_api_docs_access
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_api_docs_access(
    p_client_ip TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_format_requested TEXT DEFAULT 'html',
    p_referer TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.api_docs_access_logs (
        client_ip,
        user_agent,
        format_requested,
        referer,
        created_at
    ) VALUES (
        p_client_ip,
        p_user_agent,
        p_format_requested,
        p_referer,
        NOW()
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_api_docs_access(TEXT, TEXT, TEXT, TEXT) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_api_docs_access(TEXT, TEXT, TEXT, TEXT) FROM anon, public;

COMMENT ON TABLE public.api_docs_access_logs IS 'Developer portal access logs for /api/docs and OpenAPI spec downloads';
COMMENT ON FUNCTION public.record_api_docs_access IS 'Records developer documentation access telemetry';
