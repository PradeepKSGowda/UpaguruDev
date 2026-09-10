-- =============================================================================
-- Migration / Audit Script: Vercel Deployments & Release Audit Logging
-- File: vercel-deployment-audit-v1.sql
-- Task Reference: TASK-01030102
-- Architecture Reference: ADR-005 (Hosting & Deployment Infrastructure), ADR-013 (Security)
-- =============================================================================

-- Table: public.vercel_deployments
-- Stores webhook logs and records of automated Vercel preview & production deployments
CREATE TABLE IF NOT EXISTS public.vercel_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deployment_id VARCHAR(100) NOT NULL UNIQUE,
    project_id VARCHAR(100) NOT NULL,
    deployment_url TEXT NOT NULL,
    environment TEXT NOT NULL CHECK (environment IN ('production', 'preview', 'development')),
    git_branch TEXT NOT NULL,
    git_commit_sha VARCHAR(40) NOT NULL,
    git_commit_message TEXT,
    author_name TEXT,
    state TEXT NOT NULL CHECK (state IN ('BUILDING', 'READY', 'ERROR', 'CANCELED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ready_at TIMESTAMPTZ,
    error_code TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable Row Level Security (Mandatory per AGENTS.md Rule 3)
ALTER TABLE public.vercel_deployments ENABLE ROW LEVEL SECURITY;

-- Policy: Admin full access to view and manage deployment logs
CREATE POLICY "Admins have full access to vercel deployment logs"
    ON public.vercel_deployments
    FOR ALL
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    )
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

-- Policy: Service role key has full access (for webhook integration)
-- (Bypasses RLS automatically via service_role)

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_vercel_deployments_env_created
    ON public.vercel_deployments(environment, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vercel_deployments_commit
    ON public.vercel_deployments(git_commit_sha);

-- Comment on table
COMMENT ON TABLE public.vercel_deployments IS 
'Audit history of Vercel production and preview deployments triggered by GitHub events, maintaining traceable build lineages.';
