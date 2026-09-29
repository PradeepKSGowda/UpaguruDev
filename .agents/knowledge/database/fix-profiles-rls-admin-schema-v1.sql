-- =============================================================================
-- Migration: fix-profiles-rls-admin-schema-v1.sql
-- Description: Fix public.profiles Row Level Security (RLS) policies for administrators.
-- Target Table: public.profiles
-- Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
-- 
-- Root Cause:
-- Supabase Auth JWT tokens have `auth.jwt() ->> 'role'` set to 'authenticated'.
-- The previous RLS policy evaluated `(auth.jwt() ->> 'role') IN ('admin', 'super_admin')`
-- which evaluated to FALSE for authenticated admin sessions, causing admins to only
-- be able to read their own profile (auth.uid() = id) and hiding other users.
--
-- Solution:
-- 1. Create a SECURITY DEFINER helper function `is_admin_or_moderator` that checks
--    the caller's role without causing RLS infinite recursion.
-- 2. Update SELECT and UPDATE policies to recognize app_metadata, service_role,
--    and database profile/user_roles status.
-- =============================================================================

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

COMMENT ON FUNCTION public.is_admin_or_moderator(UUID) IS 
  'Security definer helper to check if a user possesses administrative or moderation privileges without RLS recursion.';

-- Drop existing policies
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- 1. SELECT Policy: Candidates can view their own profile; Admins and Moderators can view all profiles
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT
    USING (
        auth.uid() = id
        OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin', 'moderator')
        OR (auth.jwt() ->> 'role') = 'service_role'
        OR public.is_admin_or_moderator(auth.uid())
    );

-- 2. UPDATE Policy: Candidates can update their own profile; Admins can update any profile
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE
    USING (
        auth.uid() = id
        OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR (auth.jwt() ->> 'role') = 'service_role'
        OR public.is_admin_or_moderator(auth.uid())
    )
    WITH CHECK (
        auth.uid() = id
        OR (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR (auth.jwt() ->> 'role') = 'service_role'
        OR public.is_admin_or_moderator(auth.uid())
    );
