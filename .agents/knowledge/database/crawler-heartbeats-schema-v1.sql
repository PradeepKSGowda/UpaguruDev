-- =============================================================================
-- UPA-GURU Database Migration: Scraper Crawler Heartbeat Logs (v1.0.0)
-- Task ID: TASK-07030101 (Subtasks: SUB-0703010101, SUB-0703010102 - Healthchecks.io)
-- Complies with: ADR-002, ADR-011, ADR-013, AGENTS.md (Rule 3: Mandatory RLS & RBAC)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Crawler Heartbeat Logs Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crawler_heartbeat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_code TEXT NOT NULL CHECK (portal_code IN ('KPSC', 'UPSC', 'SSC', 'RRB')),
    status TEXT NOT NULL CHECK (status IN ('started', 'success', 'failure')),
    ping_url TEXT,
    payload_summary TEXT,
    duration_ms INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.crawler_heartbeat_logs IS 'Heartbeat telemetry synchronizing portal crawl runs with Healthchecks.io dead-mans switch';
COMMENT ON COLUMN public.crawler_heartbeat_logs.portal_code IS 'Government recruitment portal code (KPSC, UPSC, SSC, RRB)';
COMMENT ON COLUMN public.crawler_heartbeat_logs.status IS 'Run state: started, success, or failure';

-- -----------------------------------------------------------------------------
-- 2. Query & Performance Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_crawler_heartbeat_logs_portal_created 
    ON public.crawler_heartbeat_logs(portal_code, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crawler_heartbeat_logs_status 
    ON public.crawler_heartbeat_logs(status);

-- -----------------------------------------------------------------------------
-- 3. Mandatory Row Level Security (RLS) Enablement
-- -----------------------------------------------------------------------------
ALTER TABLE public.crawler_heartbeat_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. Explicit Row Level Security Policies (Idempotent)
-- -----------------------------------------------------------------------------

-- Policy 4.1: Admins can inspect all crawler heartbeat records
DROP POLICY IF EXISTS "Allow admin read on crawler_heartbeat_logs" ON public.crawler_heartbeat_logs;
CREATE POLICY "Allow admin read on crawler_heartbeat_logs"
ON public.crawler_heartbeat_logs
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

-- Policy 4.2: Scraper microservice (service_role or authenticated) can log heartbeats
DROP POLICY IF EXISTS "Allow service insert on crawler_heartbeat_logs" ON public.crawler_heartbeat_logs;
CREATE POLICY "Allow service insert on crawler_heartbeat_logs"
ON public.crawler_heartbeat_logs
FOR INSERT
WITH CHECK (
    auth.role() IN ('authenticated', 'service_role')
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
);

-- Policy 4.3: Prohibit modifications (logs are append-only)
-- No UPDATE policy defined -> updates are blocked by default RLS

-- Policy 4.4: Super admins can purge old heartbeat telemetry
DROP POLICY IF EXISTS "Allow super_admin delete on crawler_heartbeat_logs" ON public.crawler_heartbeat_logs;
CREATE POLICY "Allow super_admin delete on crawler_heartbeat_logs"
ON public.crawler_heartbeat_logs
FOR DELETE
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
);

-- -----------------------------------------------------------------------------
-- 5. Verification Queries
-- -----------------------------------------------------------------------------
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'crawler_heartbeat_logs';

SELECT policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'crawler_heartbeat_logs';
