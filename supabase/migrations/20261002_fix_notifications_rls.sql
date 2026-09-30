-- =============================================================================
-- Migration: 20261002_fix_notifications_rls.sql
-- Description: Fix RLS policies on public.notifications, public.exams,
--              public.draft_notifications, and public.audit_logs to recognize
--              'super_admin' role, app_metadata claims, service_role, and
--              public.is_admin_or_moderator() helper.
--
-- Root Cause:
-- The initial schema-v1.sql defined policies checking:
--   USING (auth.jwt() ->> 'role' = 'admin')
-- In Supabase Auth, `auth.jwt() ->> 'role'` is 'authenticated' (Postgres role),
-- and the application role is in `auth.jwt() -> 'app_metadata' ->> 'role'`.
-- Furthermore, users with role 'super_admin' failed the exact check 'admin'.
-- =============================================================================

-- Ensure helper function exists
CREATE OR REPLACE FUNCTION public.is_admin_or_moderator(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND role IN ('admin', 'super_admin', 'moderator')
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id AND r.code IN ('admin', 'super_admin', 'moderator')
  );
$$;

-- 1. NOTIFICATIONS TABLE
DROP POLICY IF EXISTS "Admin Full Access Notifications" ON public.notifications;
CREATE POLICY "Admin Full Access Notifications" ON public.notifications
    FOR ALL
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR (auth.jwt() ->> 'role') IN ('admin', 'service_role')
        OR public.is_admin_or_moderator(auth.uid())
    )
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR (auth.jwt() ->> 'role') IN ('admin', 'service_role')
        OR public.is_admin_or_moderator(auth.uid())
    );

-- 2. EXAMS TABLE
DROP POLICY IF EXISTS "Admin Full Access Exams" ON public.exams;
CREATE POLICY "Admin Full Access Exams" ON public.exams
    FOR ALL
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR (auth.jwt() ->> 'role') IN ('admin', 'service_role')
        OR public.is_admin_or_moderator(auth.uid())
    )
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR (auth.jwt() ->> 'role') IN ('admin', 'service_role')
        OR public.is_admin_or_moderator(auth.uid())
    );

-- 3. DRAFT NOTIFICATIONS TABLE
DROP POLICY IF EXISTS "Admin Full Access Drafts" ON public.draft_notifications;
CREATE POLICY "Admin Full Access Drafts" ON public.draft_notifications
    FOR ALL
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'moderator')
        OR (auth.jwt() ->> 'role') IN ('admin', 'service_role')
        OR public.is_admin_or_moderator(auth.uid())
    )
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'moderator')
        OR (auth.jwt() ->> 'role') IN ('admin', 'service_role')
        OR public.is_admin_or_moderator(auth.uid())
    );

-- 4. AUDIT LOGS TABLE
DROP POLICY IF EXISTS "Admin Full Access Audit Logs" ON public.audit_logs;
CREATE POLICY "Admin Full Access Audit Logs" ON public.audit_logs
    FOR ALL
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR (auth.jwt() ->> 'role') IN ('admin', 'service_role')
        OR public.is_admin_or_moderator(auth.uid())
    )
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR (auth.jwt() ->> 'role') IN ('admin', 'service_role')
        OR public.is_admin_or_moderator(auth.uid())
    );
