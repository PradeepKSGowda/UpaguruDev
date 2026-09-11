-- =============================================================================
-- Migration: Candidate Saved Notifications & Bookmarks Schema (v1.0.0)
-- Task Reference: TASK-02020102 (Subtasks: SUB-0202010201, SUB-0202010202)
-- Architecture Reference: ADR-002 (Database), ADR-013 (Security & RBAC)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security)
-- =============================================================================

-- Ensure uuid extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: candidate_saved_notifications
-- Stores candidate bookmarks for active notifications to receive urgent reminders
-- and track application deadlines across devices.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_saved_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_candidate_notification_bookmark UNIQUE (user_id, notification_id)
);

-- Index for fast user bookmark lookups
CREATE INDEX IF NOT EXISTS idx_saved_notifications_user 
    ON public.candidate_saved_notifications (user_id, created_at DESC);

-- Index for notification bookmark count aggregation
CREATE INDEX IF NOT EXISTS idx_saved_notifications_notif 
    ON public.candidate_saved_notifications (notification_id);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.candidate_saved_notifications ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. Explicit Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------

-- Policy: Candidates can view only their own saved bookmarks
CREATE POLICY "Candidates select own bookmarks"
    ON public.candidate_saved_notifications
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy: Candidates can insert their own bookmarks
CREATE POLICY "Candidates insert own bookmarks"
    ON public.candidate_saved_notifications
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy: Candidates can remove their own bookmarks
CREATE POLICY "Candidates delete own bookmarks"
    ON public.candidate_saved_notifications
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy: Admins have read-only analytics access to bookmark distributions
CREATE POLICY "Admins read bookmark metrics"
    ON public.candidate_saved_notifications
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );
