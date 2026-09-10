-- =============================================================================
-- Migration: Redis Cache Audit & Rate Limiting Telemetry (v1.0)
-- Task Reference: TASK-01040101 (Subtask: SUB-0104010101)
-- Architecture Reference: ADR-010 (Caching), ADR-013 (Security)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security)
-- =============================================================================

-- Ensure uuid extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: redis_cache_invalidation_logs
-- Tracks on-demand revalidation events, tag purges, and manual Redis flushes.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.redis_cache_invalidation_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    cache_tag TEXT NOT NULL,
    target_path TEXT,
    invalidation_reason TEXT NOT NULL,
    keys_purged INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying invalidation history by tag and timestamp
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_tag_created_at 
    ON public.redis_cache_invalidation_logs (cache_tag, created_at DESC);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.redis_cache_invalidation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only authenticated administrators can view invalidation audit logs
CREATE POLICY "Admin select policy for redis_cache_invalidation_logs"
    ON public.redis_cache_invalidation_logs
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

-- RLS Policy: Only authenticated administrators and service role can insert invalidation logs
CREATE POLICY "Admin insert policy for redis_cache_invalidation_logs"
    ON public.redis_cache_invalidation_logs
    FOR INSERT
    TO authenticated, service_role
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR auth.role() = 'service_role'
    );

-- -----------------------------------------------------------------------------
-- 2. Table: rate_limit_violations
-- Logs persistent threshold breaches from malicious IPs or aggressive scrapers.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rate_limit_violations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_ip TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_method TEXT NOT NULL,
    user_agent TEXT,
    requests_recorded INTEGER NOT NULL,
    window_seconds INTEGER NOT NULL DEFAULT 60,
    action_taken TEXT NOT NULL DEFAULT '429_TOO_MANY_REQUESTS',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for threat analysis and IP reputation tracking
CREATE INDEX IF NOT EXISTS idx_rate_limit_client_ip 
    ON public.rate_limit_violations (client_ip, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rate_limit_endpoint 
    ON public.rate_limit_violations (endpoint, created_at DESC);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.rate_limit_violations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can inspect rate limit violations for security monitoring
CREATE POLICY "Admin select policy for rate_limit_violations"
    ON public.rate_limit_violations
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

-- RLS Policy: Server actions and Edge API handlers (service_role) can insert violation records
CREATE POLICY "Service role insert policy for rate_limit_violations"
    ON public.rate_limit_violations
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Comments & Documentation
-- -----------------------------------------------------------------------------
COMMENT ON TABLE public.redis_cache_invalidation_logs IS 
    'Audit record of on-demand cache revalidation triggers and Redis key purges.';
COMMENT ON TABLE public.rate_limit_violations IS 
    'Persistent telemetry of client IP addresses exceeding API sliding window rate limits.';
