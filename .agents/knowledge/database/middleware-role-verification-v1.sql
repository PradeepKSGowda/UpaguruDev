-- =============================================================================
-- UPA-GURU Database Verification Script: Middleware RBAC & Role Claim Audit
-- Task ID: TASK-01020202 (Build Next.js Middleware for Role-Based Route Protection)
-- Complies with: ADR-003, ADR-013, AGENTS.md (Rule 3: Mandatory RLS & RBAC)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Audit Administrative Users Eligible for /admin/* Route Access
-- -----------------------------------------------------------------------------
-- Find all users whose app_metadata.role qualifies for Next.js middleware /admin/* access
SELECT 
    u.id AS user_id,
    u.email,
    u.raw_app_meta_data ->> 'role' AS app_metadata_role,
    p.role AS profile_role,
    CASE 
        WHEN u.raw_app_meta_data ->> 'role' IN ('admin', 'super_admin') THEN 'ACCESS_GRANTED'
        ELSE 'ACCESS_DENIED_REDIRECT_TO_HOME'
    END AS middleware_admin_route_verdict
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
ORDER BY u.created_at DESC;

-- -----------------------------------------------------------------------------
-- 2. Verify Candidate Users Are Confined to Candidate Permissions
-- -----------------------------------------------------------------------------
-- Check that no candidate user has accidentally obtained admin role in app_metadata
SELECT 
    count(*) AS total_candidates,
    count(*) FILTER (WHERE raw_app_meta_data ->> 'role' = 'candidate') AS confirmed_candidates,
    count(*) FILTER (WHERE raw_app_meta_data ->> 'role' IN ('admin', 'super_admin')) AS privileged_users
FROM auth.users;

-- -----------------------------------------------------------------------------
-- 3. Verify Custom Access Token Hook Alignment with Middleware Role Evaluation
-- -----------------------------------------------------------------------------
-- Check that custom claims hook injects the identical role evaluated by middleware
SELECT 
    p.proname,
    pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
WHERE p.proname = 'custom_access_token_hook';
