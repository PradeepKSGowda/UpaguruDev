-- =============================================================================
-- UPA-GURU Database Migration: Default Role Assignment Trigger & Procedure
-- Task ID: TASK-01020201 (Create PL/pgSQL Function & Trigger for Default Role Assignment)
-- Subtasks: SUB-0102020101 (set_user_role function), SUB-0102020102 (auth.users trigger)
-- Complies with: ADR-002, ADR-003, ADR-013, AGENTS.md (Rule 3: Mandatory RLS & RBAC)
-- =============================================================================

-- Ensure required app_role_enum exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role_enum') THEN
        CREATE TYPE public.app_role_enum AS ENUM (
            'guest',
            'candidate',
            'moderator',
            'admin',
            'super_admin'
        );
    END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 1. PL/pgSQL Function: set_user_role (SUB-0102020101)
-- -----------------------------------------------------------------------------
-- Updates auth.users.raw_app_meta_data and synchronizes with public.profiles.role.
-- Logs all role transitions to public.audit_logs.
CREATE OR REPLACE FUNCTION public.set_user_role(
    target_user_id UUID,
    new_role public.app_role_enum,
    admin_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    caller_role TEXT;
    caller_id UUID;
    previous_role public.app_role_enum;
BEGIN
    caller_id := auth.uid();
    caller_role := auth.jwt() ->> 'role';

    -- Authorization check: If invoked from an active session, must be admin or super_admin.
    -- (If invoked by internal database trigger or service_role, caller_id may be null).
    IF caller_id IS NOT NULL AND caller_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Access Denied: Caller lacks privilege to modify user roles. Active role: %', caller_role
            USING ERRCODE = '42501';
    END IF;

    -- Validate target user existence
    SELECT role INTO previous_role 
    FROM public.profiles 
    WHERE id = target_user_id;

    -- Update or synchronize public.profiles
    IF FOUND THEN
        UPDATE public.profiles
        SET role = new_role,
            updated_at = NOW()
        WHERE id = target_user_id;
    END IF;

    -- Atomically update auth.users raw_app_meta_data
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{role}',
        to_jsonb(new_role::TEXT)
    )
    WHERE id = target_user_id;

    -- Log role change to audit_logs (AGENTS.md Rule 3)
    INSERT INTO public.audit_logs (
        admin_id,
        action,
        target_entity,
        target_id,
        metadata,
        created_at
    ) VALUES (
        COALESCE(caller_id, target_user_id),
        'ASSIGN_ROLE',
        'profiles',
        target_user_id,
        jsonb_build_object(
            'previous_role', previous_role,
            'new_role', new_role,
            'assigned_by', COALESCE(caller_id::TEXT, 'SYSTEM_TRIGGER'),
            'notes', admin_notes
        ),
        NOW()
    );
END;
$$;

COMMENT ON FUNCTION public.set_user_role IS 'Assigns role in both auth.users app_metadata and public.profiles with mandatory audit logging';

-- -----------------------------------------------------------------------------
-- 2. Trigger Function: enforce_default_user_role (SUB-0102020102)
-- -----------------------------------------------------------------------------
-- Fires BEFORE INSERT on auth.users to ensure raw_app_meta_data is initialized
-- with role = 'candidate' before the record is persisted to disk.
CREATE OR REPLACE FUNCTION public.enforce_default_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
    -- Ensure raw_app_meta_data exists as JSONB object
    IF NEW.raw_app_meta_data IS NULL THEN
        NEW.raw_app_meta_data := '{}'::jsonb;
    END IF;

    -- Inject default 'candidate' role into app_metadata if role key is missing
    IF NEW.raw_app_meta_data ->> 'role' IS NULL THEN
        NEW.raw_app_meta_data := jsonb_set(
            NEW.raw_app_meta_data,
            '{role}',
            '"candidate"'::jsonb
        );
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.enforce_default_user_role IS 'BEFORE INSERT trigger function guaranteeing raw_app_meta_data defaults to role=candidate';

-- -----------------------------------------------------------------------------
-- 3. Attach BEFORE INSERT Trigger to auth.users (SUB-0102020102)
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS tr_enforce_default_user_role ON auth.users;
CREATE TRIGGER tr_enforce_default_user_role
    BEFORE INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.enforce_default_user_role();

-- -----------------------------------------------------------------------------
-- 4. Access Control & Execution Permissions
-- -----------------------------------------------------------------------------
-- Restrict direct execution from public, anon, and authenticated roles
REVOKE ALL ON FUNCTION public.set_user_role(UUID, public.app_role_enum, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, public.app_role_enum, TEXT) TO authenticated, service_role, supabase_auth_admin;

REVOKE ALL ON FUNCTION public.enforce_default_user_role() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_default_user_role() TO supabase_auth_admin, service_role;

-- -----------------------------------------------------------------------------
-- 5. Verification Queries (Diagnostic Only)
-- -----------------------------------------------------------------------------
-- Verify trigger status on auth.users
SELECT 
    tgname AS trigger_name,
    tgenabled AS trigger_enabled,
    proname AS trigger_function
FROM pg_trigger t
JOIN pg_proc p ON t.tgfoid = p.oid
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'auth' 
  AND c.relname = 'users'
  AND t.tgname = 'tr_enforce_default_user_role';

-- Verify function definitions exist
SELECT 
    p.proname,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('set_user_role', 'enforce_default_user_role');
