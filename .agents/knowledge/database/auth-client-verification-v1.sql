-- =============================================================================
-- UPA-GURU Database Verification Script: Supabase Auth Clients & RLS Verification
-- Task ID: TASK-01020102 (Build Supabase Auth Client Wrappers)
-- Complies with: ADR-003, ADR-013, AGENTS.md (Rule 3: Mandatory RLS & RBAC)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Verify RLS Status on All Application Tables
-- -----------------------------------------------------------------------------
SELECT 
    schemaname,
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'exams', 'notifications', 'draft_notifications', 'user_subscriptions', 'audit_logs')
ORDER BY tablename;

-- Expected result: rowsecurity = true for all 6 tables.

-- -----------------------------------------------------------------------------
-- 2. Verify Custom Access Token Hook Exists and Has Valid Signature
-- -----------------------------------------------------------------------------
SELECT 
    p.proname AS function_name,
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'custom_access_token_hook';

-- -----------------------------------------------------------------------------
-- 3. Simulate RLS Context for Candidate Persona
-- -----------------------------------------------------------------------------
-- Setup simulated JWT claims for a candidate
DO $$
DECLARE
    candidate_id UUID := '00000000-0000-0000-0000-000000000001'::UUID;
BEGIN
    -- Set request claims representing an authenticated candidate
    PERFORM set_config(
        'request.jwt.claims',
        json_build_object(
            'sub', candidate_id,
            'role', 'authenticated',
            'email', 'candidate@example.com',
            'app_metadata', json_build_object('role', 'candidate')
        )::text,
        true
    );
END $$;

-- Test 3.1: Candidate can read published notifications
SELECT count(*) AS published_notifications_visible
FROM public.notifications
WHERE status = 'published';

-- Test 3.2: Candidate CANNOT read draft notifications (should return 0 rows)
SELECT count(*) AS draft_notifications_visible_to_candidate
FROM public.draft_notifications;

-- -----------------------------------------------------------------------------
-- 4. Simulate RLS Context for Admin Persona
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    admin_id UUID := '00000000-0000-0000-0000-000000000099'::UUID;
BEGIN
    -- Set request claims representing an authenticated admin
    PERFORM set_config(
        'request.jwt.claims',
        json_build_object(
            'sub', admin_id,
            'role', 'authenticated',
            'email', 'admin@upaguru.in',
            'app_metadata', json_build_object('role', 'admin')
        )::text,
        true
    );
END $$;

-- Test 4.1: Admin can read all draft notifications for HITL review
SELECT count(*) AS draft_notifications_visible_to_admin
FROM public.draft_notifications;

-- Test 4.2: Admin can access audit logs
SELECT count(*) AS audit_logs_visible_to_admin
FROM public.audit_logs;

-- -----------------------------------------------------------------------------
-- 5. Verify User Profile & Subscription Trigger Synchronization
-- -----------------------------------------------------------------------------
SELECT 
    p.id AS profile_id,
    p.email,
    p.role,
    p.auth_provider,
    s.id AS subscription_id,
    s.preferred_channels
FROM public.profiles p
LEFT JOIN public.user_subscriptions s ON s.user_id = p.id
LIMIT 5;
