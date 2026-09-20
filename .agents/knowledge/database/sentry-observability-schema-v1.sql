-- =============================================================================
-- UPA-GURU Database Migration: Error Telemetry & Observability Logs (v1.0.0)
-- Task ID: TASK-07010101 (Subtask: SUB-0701010101 / SUB-0701010102 - Sentry Next.js SDK)
-- Complies with: ADR-002, ADR-011, ADR-013, AGENTS.md (Rule 3: Mandatory RLS & RBAC)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Error Telemetry Logs Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.error_telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sentry_event_id TEXT,
    environment TEXT NOT NULL DEFAULT 'production',
    runtime TEXT NOT NULL CHECK (runtime IN ('browser', 'server', 'edge', 'scraper')),
    error_name TEXT NOT NULL,
    error_message TEXT NOT NULL,
    error_digest TEXT,
    stack_trace TEXT,
    request_url TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.error_telemetry_logs IS 'System error telemetry and runtime exception logs synchronized with Sentry SDK';
COMMENT ON COLUMN public.error_telemetry_logs.sentry_event_id IS 'Unique Sentry event identifier for cross-referencing dashboards';
COMMENT ON COLUMN public.error_telemetry_logs.runtime IS 'Execution runtime environment: browser, server, edge, or scraper';
COMMENT ON COLUMN public.error_telemetry_logs.error_digest IS 'Next.js 15 error digest hash generated for server-side exceptions';

-- -----------------------------------------------------------------------------
-- 2. Performance & Query Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_error_telemetry_logs_created 
    ON public.error_telemetry_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_error_telemetry_logs_runtime_env 
    ON public.error_telemetry_logs(runtime, environment);

CREATE INDEX IF NOT EXISTS idx_error_telemetry_logs_user 
    ON public.error_telemetry_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_error_telemetry_logs_digest 
    ON public.error_telemetry_logs(error_digest)
    WHERE error_digest IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Mandatory Row Level Security (RLS) Enablement
-- -----------------------------------------------------------------------------
ALTER TABLE public.error_telemetry_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. Explicit Row Level Security Policies (Idempotent)
-- -----------------------------------------------------------------------------

-- Policy 4.1: Admins can view all telemetry error logs
DROP POLICY IF EXISTS "Allow admin read on error_telemetry_logs" ON public.error_telemetry_logs;
CREATE POLICY "Allow admin read on error_telemetry_logs"
ON public.error_telemetry_logs
FOR SELECT
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE public.profiles.id = auth.uid()
          AND public.profiles.role::text IN ('admin', 'super_admin')
    )
);

-- Policy 4.2: Anyone (public / authenticated / service_role) can report unhandled errors
DROP POLICY IF EXISTS "Allow public insert on error_telemetry_logs" ON public.error_telemetry_logs;
CREATE POLICY "Allow public insert on error_telemetry_logs"
ON public.error_telemetry_logs
FOR INSERT
WITH CHECK (true);

-- Policy 4.3: Prohibit modifications (logs are append-only)
-- No UPDATE policy defined -> updates are blocked by default RLS

-- Policy 4.4: Only Super Admins can purge old telemetry logs
DROP POLICY IF EXISTS "Allow super_admin delete on error_telemetry_logs" ON public.error_telemetry_logs;
CREATE POLICY "Allow super_admin delete on error_telemetry_logs"
ON public.error_telemetry_logs
FOR DELETE
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
);

-- -----------------------------------------------------------------------------
-- 5. Verification Queries
-- -----------------------------------------------------------------------------
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'error_telemetry_logs';

SELECT policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'error_telemetry_logs';
