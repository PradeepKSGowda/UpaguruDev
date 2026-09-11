-- =====================================================================================
-- Migration: sitemap_crawler_events table with Mandatory Row Level Security (RLS)
-- Document ID: SCHEMA-SITEMAP-EVENTS-001
-- Task ID: TASK-02050104
-- Purpose: Monitor search engine crawler requests (Googlebot, Bingbot, etc.) for
--          /sitemap.xml and /robots.txt to measure indexation coverage and crawl frequency.
-- =====================================================================================

-- 1. Create sitemap_crawler_events table
CREATE TABLE IF NOT EXISTS public.sitemap_crawler_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crawler_name VARCHAR(64) NOT NULL DEFAULT 'unknown',
    requested_resource VARCHAR(64) NOT NULL, -- '/sitemap.xml', '/robots.txt'
    user_agent TEXT,
    client_ip_hash VARCHAR(64),
    response_status INT NOT NULL DEFAULT 200,
    urls_served INT NOT NULL DEFAULT 0,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_sitemap_events_requested_at 
    ON public.sitemap_crawler_events(requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_sitemap_events_crawler 
    ON public.sitemap_crawler_events(crawler_name);

CREATE INDEX IF NOT EXISTS idx_sitemap_events_resource 
    ON public.sitemap_crawler_events(requested_resource);

-- 3. Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.sitemap_crawler_events ENABLE ROW LEVEL SECURITY;

-- 4. Explicit RLS Policies (Idempotent)

-- Allow public insertion of crawler telemetry events from Next.js edge/server handlers
DROP POLICY IF EXISTS "Allow public insert for sitemap crawler events" ON public.sitemap_crawler_events;
CREATE POLICY "Allow public insert for sitemap crawler events"
    ON public.sitemap_crawler_events
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Restrict read access strictly to authenticated Administrators
DROP POLICY IF EXISTS "Allow admins read access to sitemap crawler events" ON public.sitemap_crawler_events;
CREATE POLICY "Allow admins read access to sitemap crawler events"
    ON public.sitemap_crawler_events
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
DROP POLICY IF EXISTS "Prevent updates on sitemap crawler events" ON public.sitemap_crawler_events;
CREATE POLICY "Prevent updates on sitemap crawler events"
    ON public.sitemap_crawler_events
    FOR UPDATE
    TO authenticated
    USING (false);

-- Prohibit deletions except for administrators
DROP POLICY IF EXISTS "Allow admins delete access to sitemap crawler events" ON public.sitemap_crawler_events;
CREATE POLICY "Allow admins delete access to sitemap crawler events"
    ON public.sitemap_crawler_events
    FOR DELETE
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    );
