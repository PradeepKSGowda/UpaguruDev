-- =============================================================================
-- Migration / Audit Script: Scaffolding and Deployment Health Tracking
-- File: scaffolding-audit-v1.sql
-- Task Reference: TASK-01030101
-- Architecture Reference: ADR-005 (Cloud Hosting & Deployment Infrastructure)
-- =============================================================================

-- Create deployment_manifests table to log Next.js frontend builds and environment deployments
CREATE TABLE IF NOT EXISTS public.deployment_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    environment TEXT NOT NULL CHECK (environment IN ('local', 'preview', 'production')),
    git_commit_sha VARCHAR(40),
    git_branch TEXT,
    app_version TEXT NOT NULL DEFAULT '0.1.0',
    framework_version TEXT NOT NULL DEFAULT 'Next.js 15',
    deployed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    build_status TEXT NOT NULL CHECK (build_status IN ('pending', 'successful', 'failed')),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.deployment_manifests ENABLE ROW LEVEL SECURITY;

-- Policy: Admin full access to deployment manifests
CREATE POLICY "Admins have full access to deployment manifests"
    ON public.deployment_manifests
    FOR ALL
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    )
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

-- Policy: Anonymous & candidate read access is denied (security hardening)
-- (Default-deny is enforced by RLS)

-- Performance index for environment and deployment date
CREATE INDEX IF NOT EXISTS idx_deployment_manifests_env_date
    ON public.deployment_manifests(environment, deployed_at DESC);

-- Comment on table
COMMENT ON TABLE public.deployment_manifests IS 
'Immutable record of Next.js frontend builds, git revisions, and deployment environments for platform auditing.';
