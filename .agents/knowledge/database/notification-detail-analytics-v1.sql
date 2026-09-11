-- =============================================================================
-- Migration: Notification Detail Page Analytics & Slug Lookup Optimization (v1.0.0)
-- Task Reference: TASK-02030101 (Subtask: SUB-0203010101)
-- Architecture Reference: ADR-002 (Database), ADR-008 (SEO & Slug Routing), ADR-013 (Security)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security)
-- =============================================================================

-- Ensure uuid extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. High-Performance Index on Published Slugs
-- Guarantees sub-millisecond route resolution for /notification/[slug]
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notifications_published_slug 
    ON public.notifications (slug) 
    WHERE status = 'published';

-- -----------------------------------------------------------------------------
-- 2. Table: notification_view_events
-- Tracks candidate engagement, official PDF downloads, and referral traffic
-- per individual notification detail page.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notification_view_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    slug TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    referrer TEXT,
    device_type TEXT,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for aggregate view counts per notification
CREATE INDEX IF NOT EXISTS idx_notification_views_notif_id 
    ON public.notification_view_events (notification_id, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_views_slug 
    ON public.notification_view_events (slug);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.notification_view_events ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 3. Explicit Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------

-- Policy: Anyone (authenticated or anonymous) can record a view event
CREATE POLICY "Public record notification view event"
    ON public.notification_view_events
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Policy: Only Platform Administrators can analyze view event telemetry
CREATE POLICY "Admins read notification view telemetry"
    ON public.notification_view_events
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );
