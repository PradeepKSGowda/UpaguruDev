-- =============================================================================
-- Migration: Rate Limiting Telemetry & Allowlist Schema (v1.0.0)
-- Task Reference: TASK-01040102 (Subtasks: SUB-0104010201, SUB-0104010202)
-- Architecture Reference: ADR-010 (Caching), ADR-013 (Security), ADR-014 (API Design)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security)
-- =============================================================================

-- Ensure uuid extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: rate_limit_allowlist
-- Stores verified static IP addresses, CIDR blocks, or API tokens exempted from
-- public sliding window throttling (e.g. Health checkers, partner aggregators).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limit_allowlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ip_or_cidr TEXT NOT NULL UNIQUE,
    entity_name TEXT NOT NULL,
    purpose TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance index for IP allowlist checks
CREATE INDEX IF NOT EXISTS idx_rate_limit_allowlist_active 
    ON public.rate_limit_allowlist (ip_or_cidr) 
    WHERE is_active = true;

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.rate_limit_allowlist ENABLE ROW LEVEL SECURITY;

-- RLS: Only platform admins can view or modify the allowlist
CREATE POLICY "Admin select policy for rate_limit_allowlist"
    ON public.rate_limit_allowlist
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

CREATE POLICY "Admin write policy for rate_limit_allowlist"
    ON public.rate_limit_allowlist
    FOR ALL
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    )
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

-- -----------------------------------------------------------------------------
-- 2. Stored Procedure: record_rate_limit_incident
-- Invoked asynchronously by Edge API middleware to log threshold breaches.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_rate_limit_incident(
    p_client_ip TEXT,
    p_endpoint TEXT,
    p_request_method TEXT,
    p_user_agent TEXT,
    p_requests_recorded INTEGER,
    p_window_seconds INTEGER DEFAULT 60
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.rate_limit_violations (
        client_ip,
        endpoint,
        request_method,
        user_agent,
        requests_recorded,
        window_seconds,
        action_taken,
        created_at
    ) VALUES (
        p_client_ip,
        p_endpoint,
        p_request_method,
        p_user_agent,
        p_requests_recorded,
        p_window_seconds,
        '429_TOO_MANY_REQUESTS',
        NOW()
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- Grant procedure execution to service_role (used by server route handlers)
GRANT EXECUTE ON FUNCTION public.record_rate_limit_incident(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO service_role;
REVOKE EXECUTE ON FUNCTION public.record_rate_limit_incident(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM anon, public;

COMMENT ON TABLE public.rate_limit_allowlist IS 'Exempted IP addresses and CIDRs bypassing sliding window rate limits';
COMMENT ON FUNCTION public.record_rate_limit_incident IS 'Records rate limit threshold breach incidents into persistent audit telemetry';
