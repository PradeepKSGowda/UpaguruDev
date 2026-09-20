-- =============================================================================
-- UPA-GURU Database Migration: Product Analytics & Candidate Interaction Logs (v1.0.0)
-- Task ID: TASK-07020101 (Subtasks: SUB-0702010101, SUB-0702010102 - GA4 & PostHog)
-- Complies with: ADR-002, ADR-011, ADR-013, AGENTS.md (Rule 3: Mandatory RLS & RBAC)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Analytics Event Logs Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.analytics_event_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_name TEXT NOT NULL CHECK (event_name IN (
        'search_performed',
        'notification_viewed',
        'filter_applied',
        'outbound_click',
        'bookmark_toggled',
        'subscription_updated',
        'page_view'
    )),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    session_id TEXT,
    properties JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.analytics_event_logs IS 'Audit ledger of high-intent candidate actions, search queries, and notification views';
COMMENT ON COLUMN public.analytics_event_logs.event_name IS 'Standardized product analytics event identifier';
COMMENT ON COLUMN public.analytics_event_logs.properties IS 'JSONB payload containing search query, filters, or notification metadata';

-- -----------------------------------------------------------------------------
-- 2. Query & Performance Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_analytics_event_logs_name_created 
    ON public.analytics_event_logs(event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analytics_event_logs_user 
    ON public.analytics_event_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_analytics_event_logs_properties_gin 
    ON public.analytics_event_logs USING gin (properties);

-- -----------------------------------------------------------------------------
-- 3. Mandatory Row Level Security (RLS) Enablement
-- -----------------------------------------------------------------------------
ALTER TABLE public.analytics_event_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. Explicit Row Level Security Policies (Idempotent)
-- -----------------------------------------------------------------------------

-- Policy 4.1: Admins can inspect all candidate event telemetry
DROP POLICY IF EXISTS "Allow admin read on analytics_event_logs" ON public.analytics_event_logs;
CREATE POLICY "Allow admin read on analytics_event_logs"
ON public.analytics_event_logs
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

-- Policy 4.2: Anyone (public / authenticated / service_role) can record interaction events
DROP POLICY IF EXISTS "Allow public insert on analytics_event_logs" ON public.analytics_event_logs;
CREATE POLICY "Allow public insert on analytics_event_logs"
ON public.analytics_event_logs
FOR INSERT
WITH CHECK (true);

-- Policy 4.3: Modifications prohibited (logs are append-only)
-- No UPDATE policy defined -> updates are blocked by default RLS

-- Policy 4.4: Super admins can purge older event logs for retention compliance
DROP POLICY IF EXISTS "Allow super_admin delete on analytics_event_logs" ON public.analytics_event_logs;
CREATE POLICY "Allow super_admin delete on analytics_event_logs"
ON public.analytics_event_logs
FOR DELETE
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
);

-- -----------------------------------------------------------------------------
-- 5. Verification Queries
-- -----------------------------------------------------------------------------
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'analytics_event_logs';

SELECT policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'analytics_event_logs';
