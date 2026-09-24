-- =============================================================================
-- Knowledge Database Reference: exam-lifecycle-schema-v1.sql
-- Enhancement: ENH-0012 (Exam Lifecycle Automated Status Tracker)
-- Description: DDL definitions for exam lifecycle events with mandatory RLS.
-- Architecture Reference: ADR-002 (Database Schema), ADR-003 (RBAC)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.exam_lifecycle_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL CHECK (event_type IN ('admit_card', 'exam_date', 'answer_key', 'objection_window', 'result', 'cutoff_list', 'corrigendum')),
    title TEXT NOT NULL,
    description TEXT,
    official_url TEXT,
    release_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closing_date TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exam_lifecycle_notif_event
    ON public.exam_lifecycle_events(notification_id, event_type, release_date DESC);

CREATE INDEX IF NOT EXISTS idx_exam_lifecycle_closing
    ON public.exam_lifecycle_events(closing_date);

CREATE INDEX IF NOT EXISTS idx_exam_lifecycle_status
    ON public.exam_lifecycle_events(status, release_date DESC);

ALTER TABLE public.exam_lifecycle_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view published exam lifecycle events" ON public.exam_lifecycle_events;
CREATE POLICY "Public can view published exam lifecycle events"
    ON public.exam_lifecycle_events
    FOR SELECT TO public
    USING (status = 'published' OR (auth.uid() IS NOT NULL AND public.has_permission(auth.uid(), 'notifications:read:all')));

DROP POLICY IF EXISTS "Admins can insert exam lifecycle events" ON public.exam_lifecycle_events;
CREATE POLICY "Admins can insert exam lifecycle events"
    ON public.exam_lifecycle_events
    FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), 'notifications:write'));

DROP POLICY IF EXISTS "Admins can update exam lifecycle events" ON public.exam_lifecycle_events;
CREATE POLICY "Admins can update exam lifecycle events"
    ON public.exam_lifecycle_events
    FOR UPDATE TO authenticated
    USING (public.has_permission(auth.uid(), 'notifications:write'))
    WITH CHECK (public.has_permission(auth.uid(), 'notifications:write'));

DROP POLICY IF EXISTS "Admins can delete exam lifecycle events" ON public.exam_lifecycle_events;
CREATE POLICY "Admins can delete exam lifecycle events"
    ON public.exam_lifecycle_events
    FOR DELETE TO authenticated
    USING (public.has_permission(auth.uid(), 'notifications:write'));
