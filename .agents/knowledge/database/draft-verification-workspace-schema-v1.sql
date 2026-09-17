-- =====================================================================================
-- Migration: draft_verification_sessions table with Mandatory Row Level Security (RLS)
-- Document ID: SCHEMA-DRAFT-VERIFICATION-001
-- Task ID: TASK-03020103 (Subtasks: SUB-0302010301, SUB-0302010302, SUB-0302010303)
-- Purpose: Record granular operator verification sessions, modifications, rejection
--          reasons, and review duration for HITL accountability.
-- =====================================================================================

-- 1. Create draft_verification_sessions table
CREATE TABLE IF NOT EXISTS public.draft_verification_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL REFERENCES public.draft_notifications(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    verification_action VARCHAR(32) NOT NULL DEFAULT 'inspected', -- 'approved', 'rejected', 'modified', 'inspected'
    rejection_reason TEXT,
    fields_modified JSONB NOT NULL DEFAULT '{}'::jsonb,
    duration_seconds INT NOT NULL DEFAULT 0,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Performance & Analytical Indexes
CREATE INDEX IF NOT EXISTS idx_verification_sessions_draft_id 
    ON public.draft_verification_sessions(draft_id);

CREATE INDEX IF NOT EXISTS idx_verification_sessions_admin_id 
    ON public.draft_verification_sessions(admin_id);

CREATE INDEX IF NOT EXISTS idx_verification_sessions_verified_at 
    ON public.draft_verification_sessions(verified_at DESC);

-- 3. Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.draft_verification_sessions ENABLE ROW LEVEL SECURITY;

-- 4. Explicit RLS Policies (Idempotent)

-- Policy 1: Restrict SELECT access strictly to verified Administrators and Super Admins
DROP POLICY IF EXISTS "Allow admins read access to draft verification sessions" ON public.draft_verification_sessions;
CREATE POLICY "Allow admins read access to draft verification sessions"
    ON public.draft_verification_sessions
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    );

-- Policy 2: Allow authenticated admins to insert their own verification records
DROP POLICY IF EXISTS "Allow admins to insert draft verification records" ON public.draft_verification_sessions;
CREATE POLICY "Allow admins to insert draft verification records"
    ON public.draft_verification_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = admin_id
        AND (
            (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE public.profiles.id = auth.uid()
                AND public.profiles.role::text IN ('admin', 'super_admin')
            )
        )
    );

-- Policy 3: Prohibit direct updates to maintain audit log immutability
DROP POLICY IF EXISTS "Prevent updates on draft verification sessions" ON public.draft_verification_sessions;
CREATE POLICY "Prevent updates on draft verification sessions"
    ON public.draft_verification_sessions
    FOR UPDATE
    TO authenticated
    USING (false);

-- Policy 4: Restrict DELETE strictly to Super Admins
DROP POLICY IF EXISTS "Allow super admins to delete draft verification sessions" ON public.draft_verification_sessions;
CREATE POLICY "Allow super admins to delete draft verification sessions"
    ON public.draft_verification_sessions
    FOR DELETE
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text = 'super_admin'
        )
    );

-- 5. Comments
COMMENT ON TABLE public.draft_verification_sessions IS 'Audit telemetry capturing operator side-by-side reviews, approval modifications, and rejection reasons';
COMMENT ON COLUMN public.draft_verification_sessions.draft_id IS 'Foreign key referencing the draft notification under review';
COMMENT ON COLUMN public.draft_verification_sessions.rejection_reason IS 'Required rationale explaining why an AI draft extraction was rejected';
