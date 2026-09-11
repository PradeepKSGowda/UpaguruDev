-- =====================================================================================
-- Migration: candidate_outbound_clicks table with Mandatory Row Level Security (RLS)
-- Document ID: SCHEMA-OUTBOUND-CLICKS-001
-- Task ID: TASK-02030102
-- Purpose: Track candidate conversion interactions (Apply Online, PDF Downloads,
--          Authority Portal Visits) for analytics, broken-link telemetry, and auditability.
-- =====================================================================================

-- 1. Create candidate_outbound_clicks table
CREATE TABLE IF NOT EXISTS public.candidate_outbound_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    link_type VARCHAR(50) NOT NULL CHECK (link_type IN ('apply_online', 'official_pdf', 'authority_website', 'other')),
    target_url TEXT NOT NULL,
    user_agent TEXT,
    referrer_url TEXT,
    ip_hash VARCHAR(64), -- SHA-256 hashed candidate IP for privacy-compliant deduplication
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_outbound_clicks_notification_id 
    ON public.candidate_outbound_clicks(notification_id);

CREATE INDEX IF NOT EXISTS idx_outbound_clicks_link_type 
    ON public.candidate_outbound_clicks(link_type);

CREATE INDEX IF NOT EXISTS idx_outbound_clicks_created_at 
    ON public.candidate_outbound_clicks(created_at DESC);

-- 3. Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.candidate_outbound_clicks ENABLE ROW LEVEL SECURITY;

-- 4. Explicit RLS Policies (Idempotent)

-- Allow anonymous & authenticated candidates to record outbound click events (telemetry insertion)
DROP POLICY IF EXISTS "Allow public insert for candidate outbound clicks" ON public.candidate_outbound_clicks;
CREATE POLICY "Allow public insert for candidate outbound clicks"
    ON public.candidate_outbound_clicks
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Restrict read access strictly to authenticated Admins
DROP POLICY IF EXISTS "Allow admins full read access to outbound clicks" ON public.candidate_outbound_clicks;
CREATE POLICY "Allow admins full read access to outbound clicks"
    ON public.candidate_outbound_clicks
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

-- Prohibit direct updates to preserve clickstream integrity
DROP POLICY IF EXISTS "Prevent updates on outbound clicks" ON public.candidate_outbound_clicks;
CREATE POLICY "Prevent updates on outbound clicks"
    ON public.candidate_outbound_clicks
    FOR UPDATE
    TO authenticated
    USING (false);

-- Prohibit deletions except by super_admins for maintenance
DROP POLICY IF EXISTS "Allow super_admins to delete click logs" ON public.candidate_outbound_clicks;
CREATE POLICY "Allow super_admins to delete click logs"
    ON public.candidate_outbound_clicks
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

-- 5. Table and Column Comments
COMMENT ON TABLE public.candidate_outbound_clicks IS 'Audit log of candidate outbound link conversions for job applications and notification PDFs.';
COMMENT ON COLUMN public.candidate_outbound_clicks.ip_hash IS 'SHA-256 hashed IP for anonymous frequency analytics without PII storage.';
