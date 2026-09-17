-- =====================================================================================
-- Migration: admin_portal_sessions table with Mandatory Row Level Security (RLS)
-- Document ID: SCHEMA-ADMIN-SESSIONS-001
-- Task ID: TASK-03010101 (Subtasks: SUB-0301010101, SUB-0301010102)
-- Purpose: Track administrative portal access, active session telemetry, and
--          audit user logins to the Admin HITL Verification Portal.
-- =====================================================================================

-- 1. Create admin_portal_sessions table
CREATE TABLE IF NOT EXISTS public.admin_portal_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ip_address_hash VARCHAR(64),
    user_agent TEXT,
    session_started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    is_active BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 2. Performance & Analytical Indexes
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id 
    ON public.admin_portal_sessions(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_last_active 
    ON public.admin_portal_sessions(last_active_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_active_status 
    ON public.admin_portal_sessions(is_active) 
    WHERE is_active = true;

-- 3. Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.admin_portal_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Explicit RLS Policies (Idempotent)

-- Policy 1: Restrict SELECT access exclusively to verified Administrators and Super Admins
DROP POLICY IF EXISTS "Allow admins read access to admin portal sessions" ON public.admin_portal_sessions;
CREATE POLICY "Allow admins read access to admin portal sessions"
    ON public.admin_portal_sessions
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    );

-- Policy 2: Allow authenticated admins to insert their own session records
DROP POLICY IF EXISTS "Allow admins to insert their own session records" ON public.admin_portal_sessions;
CREATE POLICY "Allow admins to insert their own session records"
    ON public.admin_portal_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = admin_id
        AND (
            (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE public.profiles.id = auth.uid()
                AND public.profiles.role::text IN ('admin', 'super_admin')
            )
        )
    );

-- Policy 3: Allow admins to update their own active session telemetry
DROP POLICY IF EXISTS "Allow admins to update their own session telemetry" ON public.admin_portal_sessions;
CREATE POLICY "Allow admins to update their own session telemetry"
    ON public.admin_portal_sessions
    FOR UPDATE
    TO authenticated
    USING (
        auth.uid() = admin_id
        AND (
            (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE public.profiles.id = auth.uid()
                AND public.profiles.role::text IN ('admin', 'super_admin')
            )
        )
    )
    WITH CHECK (
        auth.uid() = admin_id
    );

-- Policy 4: Allow only super_admin to delete session records (for compliance purge)
DROP POLICY IF EXISTS "Allow super admins to delete session records" ON public.admin_portal_sessions;
CREATE POLICY "Allow super admins to delete session records"
    ON public.admin_portal_sessions
    FOR DELETE
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text = 'super_admin'
        )
    );

-- 5. Comments
COMMENT ON TABLE public.admin_portal_sessions IS 'Audit telemetry for authenticated admin dashboard sessions and verification activities';
COMMENT ON COLUMN public.admin_portal_sessions.admin_id IS 'Foreign key to auth.users representing the administrator';
COMMENT ON COLUMN public.admin_portal_sessions.ip_address_hash IS 'SHA-256 hashed client IP address for privacy-compliant audit logging';
COMMENT ON COLUMN public.admin_portal_sessions.last_active_at IS 'Timestamp of the most recent administrator activity within the portal';
