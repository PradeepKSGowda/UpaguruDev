-- =====================================================================================
-- Migration: candidate_search_keystrokes table with Mandatory Row Level Security (RLS)
-- Document ID: SCHEMA-SEARCH-KEYSTROKES-001
-- Task ID: TASK-02040102
-- Purpose: Monitor candidate debounced search keystrokes, input clearing patterns,
--          and abandoned search queries for search UX intelligence and keyword analytics.
-- =====================================================================================

-- 1. Create candidate_search_keystrokes table
CREATE TABLE IF NOT EXISTS public.candidate_search_keystrokes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    typed_query TEXT NOT NULL,
    debounce_duration_ms INTEGER NOT NULL DEFAULT 300,
    client_route TEXT NOT NULL,
    has_cleared BOOLEAN NOT NULL DEFAULT false,
    user_agent TEXT,
    client_ip_hash VARCHAR(64), -- SHA-256 hashed candidate IP for privacy-compliant telemetry
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_search_keystrokes_created_at 
    ON public.candidate_search_keystrokes(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_keystrokes_query 
    ON public.candidate_search_keystrokes(typed_query);

-- 3. Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.candidate_search_keystrokes ENABLE ROW LEVEL SECURITY;

-- 4. Explicit RLS Policies (Idempotent)

-- Allow public insertion of debounced search query telemetry from client components
DROP POLICY IF EXISTS "Allow public insert for search keystrokes" ON public.candidate_search_keystrokes;
CREATE POLICY "Allow public insert for search keystrokes"
    ON public.candidate_search_keystrokes
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Restrict read access strictly to authenticated Administrators
DROP POLICY IF EXISTS "Allow admins read access to search keystrokes" ON public.candidate_search_keystrokes;
CREATE POLICY "Allow admins read access to search keystrokes"
    ON public.candidate_search_keystrokes
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
DROP POLICY IF EXISTS "Prevent updates on search keystrokes" ON public.candidate_search_keystrokes;
CREATE POLICY "Prevent updates on search keystrokes"
    ON public.candidate_search_keystrokes
    FOR UPDATE
    TO authenticated
    USING (false);

-- Prohibit deletions except by super_admins during database maintenance
DROP POLICY IF EXISTS "Allow super_admins to delete search keystrokes" ON public.candidate_search_keystrokes;
CREATE POLICY "Allow super_admins to delete search keystrokes"
    ON public.candidate_search_keystrokes
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
COMMENT ON TABLE public.candidate_search_keystrokes IS 'Telemetry capturing candidate search input queries, debounce pauses, and clear actions.';
COMMENT ON COLUMN public.candidate_search_keystrokes.client_route IS 'The page URL pathname where search was initiated (e.g. /, /search).';
