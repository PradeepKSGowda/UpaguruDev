-- =============================================================================
-- UPA-GURU Database Verification Script: Auth UI User Lifecycle & Triggers
-- Task ID: TASK-01020103 (Build Auth UI Pages)
-- Complies with: ADR-003, ADR-013, AGENTS.md (Rule 3: Mandatory RLS & RBAC)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Verify User Registration Trigger Logic
-- -----------------------------------------------------------------------------
-- Ensure handle_new_auth_user() trigger is active on auth.users
SELECT 
    tgname AS trigger_name,
    tgenabled AS trigger_status,
    proname AS trigger_function
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth' 
  AND c.relname = 'users'
  AND t.tgname = 'on_auth_user_created';

-- -----------------------------------------------------------------------------
-- 2. Audit Profiles Created via Auth UI Registration
-- -----------------------------------------------------------------------------
SELECT 
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.auth_provider,
    p.email_verified,
    p.created_at
FROM public.profiles p
ORDER BY p.created_at DESC
LIMIT 10;

-- Expected result:
-- 1. All new registrations default to role = 'candidate'.
-- 2. Email registrations have email_verified = false until confirmed.
-- 3. Google OAuth registrations have email_verified = true and auth_provider = 'google'.

-- -----------------------------------------------------------------------------
-- 3. Verify Default User Subscriptions Initialized
-- -----------------------------------------------------------------------------
SELECT 
    s.id AS subscription_id,
    s.user_id,
    s.preferred_channels,
    p.email,
    p.role
FROM public.user_subscriptions s
JOIN public.profiles p ON s.user_id = p.id
ORDER BY s.created_at DESC
LIMIT 10;

-- Expected result:
-- Every registered user has a corresponding row in user_subscriptions with preferred_channels = ARRAY['web_push'].

-- -----------------------------------------------------------------------------
-- 4. Verify RLS Candidate Isolation on Profile Updates
-- -----------------------------------------------------------------------------
-- Ensure candidates cannot elevate their own role to 'admin' via profile updates
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'profiles'
  AND policyname = 'profiles_update_own';
