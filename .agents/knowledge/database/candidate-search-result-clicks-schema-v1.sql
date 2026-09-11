-- =====================================================================================
-- Migration: candidate_search_result_clicks table with Mandatory Row Level Security (RLS)
-- Document ID: SCHEMA-SEARCH-CLICKS-001
-- Task ID: TASK-02040103
-- Purpose: Monitor candidate click-through conversions on search results pages (/search)
--          to measure relevance ranking accuracy and search result quality.
-- =====================================================================================

-- 1. Create candidate_search_result_clicks table
CREATE TABLE IF NOT EXISTS public.candidate_search_result_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    search_query TEXT NOT NULL,
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    result_position INT NOT NULL, -- 1-indexed position in results list
    total_results INT NOT NULL,
    user_agent TEXT,
    client_ip_hash VARCHAR(64), -- SHA-256 hashed candidate IP for deduplication
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_search_clicks_clicked_at 
    ON public.candidate_search_result_clicks(clicked_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_clicks_notification_id 
    ON public.candidate_search_result_clicks(notification_id);

CREATE INDEX IF NOT EXISTS idx_search_clicks_query 
    ON public.candidate_search_result_clicks(search_query);

-- 3. Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.candidate_search_result_clicks ENABLE ROW LEVEL SECURITY;

-- 4. Explicit RLS Policies (Idempotent)

-- Allow public insertion of search click conversions from candidate portal
DROP POLICY IF EXISTS "Allow public insert for search clicks" ON public.candidate_search_result_clicks;
CREATE POLICY "Allow public insert for search clicks"
    ON public.candidate_search_result_clicks
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Restrict read access strictly to authenticated Administrators
DROP POLICY IF EXISTS "Allow admins read access to search clicks" ON public.candidate_search_result_clicks;
CREATE POLICY "Allow admins read access to search clicks"
    ON public.candidate_search_result_clicks
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

-- Prohibit direct updates to preserve telemetry integrity
DROP POLICY IF EXISTS "Prevent updates on search clicks" ON public.candidate_search_result_clicks;
CREATE POLICY "Prevent updates on search clicks"
    ON public.candidate_search_result_clicks
    FOR UPDATE
    TO authenticated
    USING (false);

-- Prohibit deletions except by super_admins during database maintenance
DROP POLICY IF EXISTS "Allow super_admins to delete search clicks" ON public.candidate_search_result_clicks;
CREATE POLICY "Allow super_admins to delete search clicks"
    ON public.candidate_search_result_clicks
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

-- 5. Table & Column Comments
COMMENT ON TABLE public.candidate_search_result_clicks IS 'Audit log of candidate click-through events on /search results page.';
COMMENT ON COLUMN public.candidate_search_result_clicks.result_position IS 'Rank position of the clicked notification in search results (1, 2, 3...).';
