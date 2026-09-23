-- =============================================================================
-- Database Schema: rbac-user-profiles-schema-v1.sql
-- Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
-- Module: Platform Administration & Candidate Personal Workspace
-- Description: Extensible Role-Based Access Control (RBAC), Candidate User Profiles,
-- Admin Profiles, Bookmarks, Exam Notes, Application Tracking, and Verification Requests.
-- =============================================================================

-- Enable uuid-ossp or pgcrypto if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. EXTENSIBLE RBAC SUBSYSTEM
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    module TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- =============================================================================
-- 2. CANDIDATE & ADMIN PROFILE EXTENSIONS
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    alternate_email TEXT,
    is_alternate_email_verified BOOLEAN DEFAULT false,
    phone TEXT,
    is_phone_verified BOOLEAN DEFAULT false,
    alternate_phone TEXT,
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    date_of_birth DATE,
    category TEXT, -- Reservation/Eligibility category (e.g. GM, OBC, SC, ST)
    address_line TEXT,
    state TEXT,
    district TEXT,
    pincode TEXT,
    avatar_url TEXT,
    language_preference TEXT DEFAULT 'en',
    profile_completion_percentage INTEGER DEFAULT 20,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    department TEXT,
    employee_id TEXT,
    two_factor_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 3. CANDIDATE WORKSPACE ENTITIES
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('exam', 'notification')),
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, entity_type, entity_id)
);

CREATE TABLE IF NOT EXISTS public.exam_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_id UUID REFERENCES public.exams(id) ON DELETE SET NULL,
    notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_exam_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    application_submitted BOOLEAN DEFAULT false,
    application_number TEXT,
    fee_paid BOOLEAN DEFAULT false,
    fee_amount NUMERIC(10, 2),
    hall_ticket_downloaded BOOLEAN DEFAULT false,
    exam_attended BOOLEAN DEFAULT false,
    result_status TEXT DEFAULT 'pending' CHECK (result_status IN ('pending', 'qualified', 'disqualified', 'waitlisted')),
    custom_notes TEXT,
    personal_reminders TIMESTAMPTZ[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, notification_id)
);

CREATE TABLE IF NOT EXISTS public.verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('email', 'alternate_email', 'phone', 'alternate_phone')),
    target_value TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- 4. PERFORMANCE INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON public.bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_entity ON public.bookmarks(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_exam_notes_user_id ON public.exam_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_tracking_user_notif ON public.user_exam_tracking(user_id, notification_id);
CREATE INDEX IF NOT EXISTS idx_verification_requests_lookup ON public.verification_requests(user_id, target_type, expires_at);

-- =============================================================================
-- 5. PERMISSION HELPER FUNCTION
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_permission(p_user_id UUID, p_permission_code TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.role_permissions rp ON ur.role_id = rp.role_id
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE ur.user_id = p_user_id
          AND p.code = p_permission_code
    );
$$;

-- =============================================================================
-- 6. MANDATORY ROW LEVEL SECURITY (RLS)
-- =============================================================================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exam_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;

-- Roles & Permissions: Read-only for authenticated, mutations restricted to super_admin
CREATE POLICY "Allow authenticated read roles" ON public.roles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read permissions" ON public.permissions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read role_permissions" ON public.role_permissions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated read user_roles" ON public.user_roles
    FOR SELECT TO authenticated USING (true);

-- User Profiles: Owner or users with users:read:all
CREATE POLICY "Users can read own profile" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id OR public.has_permission(auth.uid(), 'users:read:all'));

CREATE POLICY "Users can update own profile" ON public.user_profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id OR public.has_permission(auth.uid(), 'users:update:any'))
    WITH CHECK (auth.uid() = id OR public.has_permission(auth.uid(), 'users:update:any'));

CREATE POLICY "Users can insert own profile" ON public.user_profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = id);

-- Bookmarks: Owner only
CREATE POLICY "Bookmarks are strictly owner-scoped" ON public.bookmarks
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Exam Notes: Owner only
CREATE POLICY "Exam notes are strictly owner-scoped" ON public.exam_notes
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- User Exam Tracking: Owner only
CREATE POLICY "Tracking is strictly owner-scoped" ON public.user_exam_tracking
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =============================================================================
-- 7. SEED DATA (ROLES & PERMISSIONS)
-- =============================================================================

INSERT INTO public.roles (code, name, description, is_system_role)
VALUES
    ('super_admin', 'Super Administrator', 'Full platform governance and RBAC control', true),
    ('admin', 'Administrator', 'HITL verification, user management, and portal operations', true),
    ('moderator', 'Moderator', 'Content audit and review verification queues', true),
    ('support', 'Support Specialist', 'Candidate account assistance and inquiries', true),
    ('candidate', 'Candidate', 'Registered job seeker and exam aspirant', true)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.permissions (code, module, description)
VALUES
    ('iam:roles:manage', 'IAM', 'Create and modify platform roles'),
    ('iam:roles:assign', 'IAM', 'Assign roles to platform users'),
    ('iam:permissions:manage', 'IAM', 'Manage role permissions matrix'),
    ('users:create', 'Users', 'Create and invite users'),
    ('users:read:all', 'Users', 'View all registered candidate and admin users'),
    ('users:update:any', 'Users', 'Update profile and status of users'),
    ('users:block', 'Users', 'Block and reactivate users'),
    ('users:delete:soft', 'Users', 'Soft delete user records'),
    ('users:export', 'Users', 'Export user directories in CSV/JSON'),
    ('admin:create', 'Admin', 'Provision new administrative accounts'),
    ('admin:suspend', 'Admin', 'Suspend or reactivate administrator accounts'),
    ('audit:logs:read', 'Audit', 'View immutable system audit logs'),
    ('analytics:kpi:read', 'Analytics', 'Access user KPI dashboards and engagement metrics'),
    ('scrapers:view', 'Scrapers', 'View active scrapers and discovery timestamps'),
    ('scrapers:run', 'Scrapers', 'Trigger manual extractions on scraper portals'),
    ('notifications:view', 'Notifications', 'View published notifications'),
    ('notifications:review', 'Notifications', 'Review and edit notification details'),
    ('drafts:review', 'Drafts', 'Approve or reject extracted drafts in HITL queue'),
    ('profile:self', 'Candidate', 'Manage personal account and profile settings'),
    ('bookmarks:self', 'Candidate', 'Manage saved exams and notifications'),
    ('notes:self', 'Candidate', 'Manage personal exam notes'),
    ('tracking:self', 'Candidate', 'Manage personal application tracking records')
ON CONFLICT (code) DO NOTHING;
