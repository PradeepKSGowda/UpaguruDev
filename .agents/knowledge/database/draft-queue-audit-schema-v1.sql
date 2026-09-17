-- =====================================================================================
-- Migration: draft_queue_audit_logs table with Mandatory Row Level Security (RLS)
-- Document ID: SCHEMA-DRAFT-QUEUE-AUDIT-001
-- Task ID: TASK-03020102 (Subtasks: SUB-0302010201, SUB-0302010202)
-- Purpose: Track operator draft review queue inspections, filter modifications, and
--          batch pagination events for administrative compliance and auditing.
-- =====================================================================================

-- 1. Create draft_queue_audit_logs table
CREATE TABLE IF NOT EXISTS public.draft_queue_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type VARCHAR(64) NOT NULL DEFAULT 'queue_filtered', -- 'queue_view', 'filter_changed', 'queue_sorted', 'page_navigated'
    filter_status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
    results_count INT NOT NULL DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 2. Performance & Analytical Indexes
CREATE INDEX IF NOT EXISTS idx_queue_audit_recorded_at 
    ON public.draft_queue_audit_logs(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_audit_admin_id 
    ON public.draft_queue_audit_logs(admin_id);

CREATE INDEX IF NOT EXISTS idx_queue_audit_filter_status 
    ON public.draft_queue_audit_logs(filter_status);

-- 3. Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.draft_queue_audit_logs ENABLE ROW LEVEL SECURITY;

-- 4. Explicit RLS Policies (Idempotent)

-- Policy 1: Restrict SELECT access strictly to verified Administrators and Super Admins
DROP POLICY IF EXISTS "Allow admins read access to draft queue audit logs" ON public.draft_queue_audit_logs;
CREATE POLICY "Allow admins read access to draft queue audit logs"
    ON public.draft_queue_audit_logs
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

-- Policy 2: Allow authenticated admins to insert their own queue telemetry logs
DROP POLICY IF EXISTS "Allow admins to insert draft queue audit logs" ON public.draft_queue_audit_logs;
CREATE POLICY "Allow admins to insert draft queue audit logs"
    ON public.draft_queue_audit_logs
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
DROP POLICY IF EXISTS "Prevent updates on draft queue audit logs" ON public.draft_queue_audit_logs;
CREATE POLICY "Prevent updates on draft queue audit logs"
    ON public.draft_queue_audit_logs
    FOR UPDATE
    TO authenticated
    USING (false);

-- Policy 4: Restrict DELETE strictly to Super Admins
DROP POLICY IF EXISTS "Allow super admins to delete draft queue audit logs" ON public.draft_queue_audit_logs;
CREATE POLICY "Allow super admins to delete draft queue audit logs"
    ON public.draft_queue_audit_logs
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
COMMENT ON TABLE public.draft_queue_audit_logs IS 'Audit logging and telemetry table for operator interactions with the HITL draft review queue';
COMMENT ON COLUMN public.draft_queue_audit_logs.admin_id IS 'Foreign key referencing auth.users representing the operator';
COMMENT ON COLUMN public.draft_queue_audit_logs.action_type IS 'Action descriptor indicating view, filter, sort, or pagination change';
