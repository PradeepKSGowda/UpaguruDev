-- =============================================================================
-- UPA-GURU Database Migration: Supabase Auth & RBAC Schema (v1.0.0)
-- Task ID: TASK-01020101 (Configure Supabase Auth Providers & RBAC Integration)
-- Complies with: ADR-003, ADR-013, AGENTS.md (Rule 3: Mandatory RLS & RBAC)
-- =============================================================================

-- Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. App Roles Enum Definition
-- -----------------------------------------------------------------------------
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
-- 2. User Profiles Table (Synchronized with auth.users)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role public.app_role_enum NOT NULL DEFAULT 'candidate',
    email_verified BOOLEAN NOT NULL DEFAULT false,
    auth_provider TEXT NOT NULL DEFAULT 'email', -- 'email', 'google', 'magic_link'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.profiles IS 'User profiles and RBAC role assignments synchronized with Supabase auth.users';
COMMENT ON COLUMN public.profiles.role IS 'Platform access role: candidate, moderator, admin, super_admin';
COMMENT ON COLUMN public.profiles.auth_provider IS 'Identity provider used during user registration';

-- -----------------------------------------------------------------------------
-- 3. Indexes for Query Performance & Lookups
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_auth_provider ON public.profiles(auth_provider);

-- -----------------------------------------------------------------------------
-- 4. Mandatory Row Level Security (RLS) Enablement
-- -----------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 5. Explicit Row Level Security Policies (Default Deny Principle)
-- -----------------------------------------------------------------------------

-- SELECT: Candidates can read their own profile; Admins/Moderators can view all profiles
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT
    USING (
        auth.uid() = id
        OR (auth.jwt() ->> 'role') IN ('admin', 'super_admin', 'moderator')
    );

-- INSERT: Only system triggers or authenticated users registering their own ID
CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT
    WITH CHECK (
        auth.uid() = id
        OR (auth.jwt() ->> 'role') IN ('admin', 'super_admin')
    );

-- UPDATE: Candidates can update their own personal info (name, avatar); Role edits restricted to Admin
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE
    USING (
        auth.uid() = id
        OR (auth.jwt() ->> 'role') IN ('admin', 'super_admin')
    )
    WITH CHECK (
        -- Candidates cannot elevate their own role
        (
            auth.uid() = id 
            AND role = (SELECT p.role FROM public.profiles p WHERE p.id = auth.uid())
        )
        OR (auth.jwt() ->> 'role') IN ('admin', 'super_admin')
    );

-- DELETE: Self-deletion by account owner or by super_admin
CREATE POLICY "profiles_delete_own" ON public.profiles
    FOR DELETE
    USING (
        auth.uid() = id
        OR (auth.jwt() ->> 'role') = 'super_admin'
    );

-- -----------------------------------------------------------------------------
-- 6. Trigger Function: Sync auth.users to public.profiles & user_subscriptions
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
    detected_provider TEXT;
    extracted_name TEXT;
    extracted_avatar TEXT;
    is_confirmed BOOLEAN;
BEGIN
    -- Determine primary authentication provider
    detected_provider := COALESCE(
        NEW.raw_app_meta_data ->> 'provider',
        (NEW.raw_user_meta_data ->> 'provider'),
        'email'
    );

    -- Extract metadata supplied by OAuth or signup payload
    extracted_name := COALESCE(
        NEW.raw_user_meta_data ->> 'full_name',
        NEW.raw_user_meta_data ->> 'name',
        split_part(NEW.email, '@', 1)
    );
    extracted_avatar := NEW.raw_user_meta_data ->> 'avatar_url';

    -- Email confirmation status
    is_confirmed := (NEW.email_confirmed_at IS NOT NULL);

    -- Inject default 'candidate' role into app_metadata if not set
    NEW.raw_app_meta_data := jsonb_set(
        COALESCE(NEW.raw_app_meta_data, '{}'::jsonb),
        '{role}',
        COALESCE(NEW.raw_app_meta_data -> 'role', '"candidate"'::jsonb)
    );

    -- 1. Upsert profile record
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        role,
        email_verified,
        auth_provider,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        extracted_name,
        extracted_avatar,
        'candidate'::public.app_role_enum,
        is_confirmed,
        detected_provider,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
        avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
        email_verified = EXCLUDED.email_verified,
        updated_at = NOW();

    -- 2. Initialize candidate preferences row in user_subscriptions (if missing)
    INSERT INTO public.user_subscriptions (
        user_id,
        preferred_channels,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        ARRAY['web_push'],
        NOW(),
        NOW()
    )
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$;

-- Attach trigger to auth.users table
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- 7. Custom JWT Claims Hook for Supabase Auth (Injects 'role' into JWT)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB 
LANGUAGE plpgsql 
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    claims JSONB;
    user_role public.app_role_enum;
BEGIN
    -- Fetch the user's assigned role from public.profiles
    SELECT role INTO user_role 
    FROM public.profiles 
    WHERE id = (event ->> 'user_id')::UUID;

    claims := event -> 'claims';

    IF user_role IS NOT NULL THEN
        -- Embed role directly into JWT claims for instant RLS validation
        claims := jsonb_set(claims, '{role}', to_jsonb(user_role::TEXT));
    ELSE
        claims := jsonb_set(claims, '{role}', '"candidate"'::jsonb);
    END IF;

    event := jsonb_set(event, '{claims}', claims);
    RETURN event;
END;
$$;

-- Grant execution permission to Supabase auth admin
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(JSONB) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(JSONB) FROM authenticated, anon, public;

-- -----------------------------------------------------------------------------
-- 8. Admin RBAC Role Assignment Stored Procedure with Audit Logging
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_user_role(
    target_user_id UUID,
    new_role public.app_role_enum
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    caller_role TEXT;
    caller_id UUID;
    previous_role public.app_role_enum;
BEGIN
    caller_id := auth.uid();
    caller_role := auth.jwt() ->> 'role';

    -- Only Admin or Super Admin can assign roles
    IF caller_role NOT IN ('admin', 'super_admin') THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can modify user roles. Caller role: %', caller_role
            USING ERRCODE = '42501';
    END IF;

    -- Fetch current role
    SELECT role INTO previous_role FROM public.profiles WHERE id = target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Target user not found: %', target_user_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Update role in public.profiles
    UPDATE public.profiles 
    SET role = new_role, updated_at = NOW() 
    WHERE id = target_user_id;

    -- Sync role to auth.users raw_app_meta_data
    UPDATE auth.users
    SET raw_app_meta_data = jsonb_set(
        COALESCE(raw_app_meta_data, '{}'::jsonb),
        '{role}',
        to_jsonb(new_role::TEXT)
    )
    WHERE id = target_user_id;

    -- Mandatory Audit Trail Logging (AGENTS.md Rule 3)
    INSERT INTO public.audit_logs (
        admin_id,
        action,
        target_entity,
        target_id,
        metadata,
        created_at
    ) VALUES (
        caller_id,
        'ROLE_CHANGE',
        'profiles',
        target_user_id,
        jsonb_build_object(
            'previous_role', previous_role,
            'new_role', new_role,
            'changed_by', caller_id
        ),
        NOW()
    );
END;
$$;

COMMENT ON FUNCTION public.assign_user_role IS 'Administrative procedure to update user RBAC role with mandatory audit logging';
