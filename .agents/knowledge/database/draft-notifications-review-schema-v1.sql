-- =====================================================================================
-- Migration: draft_notifications review indexes, RLS policies & review telemetry table
-- Document ID: SCHEMA-DRAFTS-REVIEW-001
-- Task ID: TASK-03020101 (Subtask: SUB-0302010101)
-- Purpose: Accelerate draft queue sorting (confidence ASC, status filter), enforce
--          strict administrative RLS policies, and capture HITL queue review events.
-- =====================================================================================

-- 1. High-Performance Compound Indexes for Draft Queue Operations
CREATE INDEX IF NOT EXISTS idx_drafts_status_confidence 
    ON public.draft_notifications(status, extraction_confidence_score ASC);

CREATE INDEX IF NOT EXISTS idx_drafts_status_created 
    ON public.draft_notifications(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_drafts_confidence 
    ON public.draft_notifications(extraction_confidence_score ASC);

-- 2. Ensure Mandatory Row Level Security (RLS) on public.draft_notifications
ALTER TABLE public.draft_notifications ENABLE ROW LEVEL SECURITY;

-- 3. Explicit RLS Policies for public.draft_notifications (Idempotent)

-- Policy: Restrict read access to verified Administrators and Super Admins
DROP POLICY IF EXISTS "Allow admins read access to draft notifications" ON public.draft_notifications;
CREATE POLICY "Allow admins read access to draft notifications"
    ON public.draft_notifications
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

-- Policy: Allow admins to update draft status during review (approval, rejection, edits)
DROP POLICY IF EXISTS "Allow admins to update draft notifications" ON public.draft_notifications;
CREATE POLICY "Allow admins to update draft notifications"
    ON public.draft_notifications
    FOR UPDATE
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    )
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    );

-- 4. Create draft_review_events Telemetry Table
CREATE TABLE IF NOT EXISTS public.draft_review_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    draft_id UUID NOT NULL REFERENCES public.draft_notifications(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL DEFAULT 'draft_opened', -- 'queue_view', 'draft_opened', 'draft_approved', 'draft_rejected'
    confidence_score NUMERIC(5,2),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Performance Indexes on draft_review_events
CREATE INDEX IF NOT EXISTS idx_draft_events_draft_id 
    ON public.draft_review_events(draft_id);

CREATE INDEX IF NOT EXISTS idx_draft_events_admin_id 
    ON public.draft_review_events(admin_id);

CREATE INDEX IF NOT EXISTS idx_draft_events_recorded_at 
    ON public.draft_review_events(recorded_at DESC);

-- Enable Mandatory RLS on draft_review_events
ALTER TABLE public.draft_review_events ENABLE ROW LEVEL SECURITY;

-- 5. Explicit RLS Policies for draft_review_events

-- Allow admins to read review events
DROP POLICY IF EXISTS "Allow admins read access to draft review events" ON public.draft_review_events;
CREATE POLICY "Allow admins read access to draft review events"
    ON public.draft_review_events
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

-- Allow admins to insert review telemetry
DROP POLICY IF EXISTS "Allow admins to insert draft review events" ON public.draft_review_events;
CREATE POLICY "Allow admins to insert draft review events"
    ON public.draft_review_events
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

-- Prohibit updates to maintain telemetry immutability
DROP POLICY IF EXISTS "Prevent updates on draft review events" ON public.draft_review_events;
CREATE POLICY "Prevent updates on draft review events"
    ON public.draft_review_events
    FOR UPDATE
    TO authenticated
    USING (false);

-- Prohibit delete except for Super Admins
DROP POLICY IF EXISTS "Allow super admins to delete draft review events" ON public.draft_review_events;
CREATE POLICY "Allow super admins to delete draft review events"
    ON public.draft_review_events
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

-- 6. Comments
COMMENT ON TABLE public.draft_review_events IS 'Audit telemetry tracking administrative draft inspection, approval, and rejection events';
COMMENT ON INDEX public.idx_drafts_status_confidence IS 'Accelerates draft queue retrieval ordered by lowest confidence first';
