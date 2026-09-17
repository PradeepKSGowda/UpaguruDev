-- =====================================================================================
-- Migration: Enhanced RLS Policies for Publishing Notifications & Audit Telemetry
-- Document ID: SCHEMA-PUBLISH-REJECT-ACTIONS-001
-- Task ID: TASK-03020104 (Subtasks: SUB-0302010401, SUB-0302010402)
-- Purpose: Grant verified administrators explicit INSERT and UPDATE capabilities on
--          public.notifications and public.exams while preserving strict public read RLS.
-- =====================================================================================

-- -------------------------------------------------------------------------------------
-- 1. Ensure Row Level Security (RLS) is Enabled
-- -------------------------------------------------------------------------------------
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draft_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------------------
-- 2. Explicit RLS Policies for public.notifications
-- -------------------------------------------------------------------------------------

-- Policy: Allow public candidates and search crawlers to view published notifications
DROP POLICY IF EXISTS "Public Read Published Notifications" ON public.notifications;
CREATE POLICY "Public Read Published Notifications"
    ON public.notifications
    FOR SELECT
    USING (status = 'published');

-- Policy: Allow verified administrators to view ALL notifications (draft, review, published)
DROP POLICY IF EXISTS "Admins read all notifications" ON public.notifications;
CREATE POLICY "Admins read all notifications"
    ON public.notifications
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

-- Policy: Allow verified administrators to insert newly published notifications
DROP POLICY IF EXISTS "Admins insert published notifications" ON public.notifications;
CREATE POLICY "Admins insert published notifications"
    ON public.notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    );

-- Policy: Allow verified administrators to update notifications
DROP POLICY IF EXISTS "Admins update published notifications" ON public.notifications;
CREATE POLICY "Admins update published notifications"
    ON public.notifications
    FOR UPDATE
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    );

-- -------------------------------------------------------------------------------------
-- 3. Explicit RLS Policies for public.exams (Exam Catalog)
-- -------------------------------------------------------------------------------------

-- Policy: Allow public read of all master exam series
DROP POLICY IF EXISTS "Public Read Published Exams" ON public.exams;
CREATE POLICY "Public Read Published Exams"
    ON public.exams
    FOR SELECT
    USING (true);

-- Policy: Allow verified administrators to insert master exam entities
DROP POLICY IF EXISTS "Admins insert master exam series" ON public.exams;
CREATE POLICY "Admins insert master exam series"
    ON public.exams
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    );

-- Policy: Allow verified administrators to update master exam entities
DROP POLICY IF EXISTS "Admins update master exam series" ON public.exams;
CREATE POLICY "Admins update master exam series"
    ON public.exams
    FOR UPDATE
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    );

-- -------------------------------------------------------------------------------------
-- 4. Audit Table RLS: Ensure authenticated admins can write audit logs
-- -------------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admins insert audit log entries" ON public.audit_logs;
CREATE POLICY "Admins insert audit log entries"
    ON public.audit_logs
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

DROP POLICY IF EXISTS "Admins read audit logs" ON public.audit_logs;
CREATE POLICY "Admins read audit logs"
    ON public.audit_logs
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

-- -------------------------------------------------------------------------------------
-- 5. Verification & Metadata Comments
-- -------------------------------------------------------------------------------------
COMMENT ON POLICY "Admins insert published notifications" ON public.notifications 
    IS 'Enforces that only verified administrators and super admins can publish notifications';
COMMENT ON POLICY "Admins insert master exam series" ON public.exams 
    IS 'Enforces that only verified administrators and super admins can provision master exam series';
