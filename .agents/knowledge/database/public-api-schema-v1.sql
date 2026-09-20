-- =============================================================================
-- Migration: Public REST API v1 Telemetry & Logging Schema (v1.0.0)
-- Task Reference: TASK-08010101 (Subtask: SUB-0801010101)
-- Architecture Reference: ADR-002 (Database), ADR-010 (Caching), ADR-013 (Security), ADR-014 (API Design)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security & RBAC)
-- =============================================================================

-- Ensure required extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: public.api_request_logs
-- Records incoming requests, execution latency, response status codes, and
-- query filters across public REST API v1 endpoints for audit and abuse tracking.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.api_request_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'GET',
    status_code INTEGER NOT NULL,
    response_time_ms INTEGER,
    client_ip TEXT,
    user_agent TEXT,
    query_params JSONB DEFAULT '{}'::jsonb,
    error_detail JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance and analytical indexing
CREATE INDEX IF NOT EXISTS idx_api_request_logs_endpoint_created 
    ON public.api_request_logs (endpoint, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_status_created 
    ON public.api_request_logs (status_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_request_logs_client_ip 
    ON public.api_request_logs (client_ip, created_at DESC);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;

-- Idempotent RLS Policy Setup
DROP POLICY IF EXISTS "Admin select policy for api_request_logs" ON public.api_request_logs;
DROP POLICY IF EXISTS "Admin insert policy for api_request_logs" ON public.api_request_logs;
DROP POLICY IF EXISTS "Service role all policy for api_request_logs" ON public.api_request_logs;

-- RLS: Platform administrators can read API request logs for analytics & troubleshooting
CREATE POLICY "Admin select policy for api_request_logs"
    ON public.api_request_logs
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

-- RLS: Service role has full permissions for ingestion and cleanup
CREATE POLICY "Service role all policy for api_request_logs"
    ON public.api_request_logs
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 2. Stored Procedure: public.record_api_request_telemetry
-- Idempotent logging helper callable by Next.js route handlers via service role.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_api_request_telemetry(
    p_endpoint TEXT,
    p_method TEXT,
    p_status_code INTEGER,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_client_ip TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_query_params JSONB DEFAULT '{}'::jsonb,
    p_error_detail JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.api_request_logs (
        endpoint,
        method,
        status_code,
        response_time_ms,
        client_ip,
        user_agent,
        query_params,
        error_detail,
        created_at
    ) VALUES (
        p_endpoint,
        p_method,
        p_status_code,
        p_response_time_ms,
        p_client_ip,
        p_user_agent,
        p_query_params,
        p_error_detail,
        NOW()
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.record_api_request_telemetry(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, JSONB, JSONB) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_api_request_telemetry(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, JSONB, JSONB) FROM anon, public;

COMMENT ON TABLE public.api_request_logs IS 'Audit log of incoming Public REST API v1 requests, latency, and status codes';
COMMENT ON FUNCTION public.record_api_request_telemetry IS 'Security definer function to persist API telemetry from Next.js server handlers';
