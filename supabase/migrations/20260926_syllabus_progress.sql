-- =============================================================================
-- Migration: 20260926_syllabus_progress.sql
-- Enhancement: ENH-0011 (Interactive Exam Syllabus & Subject Mastery Tracker)
-- Description: Stores candidate topic-by-topic syllabus progress, revision counts,
--              and mastery tracking for applied/bookmarked examinations.
-- Architecture Reference: ADR-002 (Database Schema), ADR-003 (RBAC)
-- =============================================================================

-- 1. Candidate Syllabus Progress Table
CREATE TABLE IF NOT EXISTS public.candidate_syllabus_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    subject_key TEXT NOT NULL,
    topic_title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'needs_revision')),
    revision_count INTEGER NOT NULL DEFAULT 0 CHECK (revision_count >= 0),
    confidence_level INTEGER DEFAULT 1 CHECK (confidence_level BETWEEN 1 AND 5),
    last_reviewed_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, notification_id, subject_key, topic_title)
);

-- 2. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_syllabus_progress_user_notif
    ON public.candidate_syllabus_progress(user_id, notification_id);

CREATE INDEX IF NOT EXISTS idx_syllabus_progress_status
    ON public.candidate_syllabus_progress(status);

-- 3. Mandatory Row Level Security (RLS)
ALTER TABLE public.candidate_syllabus_progress ENABLE ROW LEVEL SECURITY;

-- 3.1 Idempotent RLS Policies
DROP POLICY IF EXISTS "Candidate can select own syllabus progress" ON public.candidate_syllabus_progress;
CREATE POLICY "Candidate can select own syllabus progress"
    ON public.candidate_syllabus_progress
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'users:read:all'));

DROP POLICY IF EXISTS "Candidate can insert own syllabus progress" ON public.candidate_syllabus_progress;
CREATE POLICY "Candidate can insert own syllabus progress"
    ON public.candidate_syllabus_progress
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Candidate can update own syllabus progress" ON public.candidate_syllabus_progress;
CREATE POLICY "Candidate can update own syllabus progress"
    ON public.candidate_syllabus_progress
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Candidate can delete own syllabus progress" ON public.candidate_syllabus_progress;
CREATE POLICY "Candidate can delete own syllabus progress"
    ON public.candidate_syllabus_progress
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
