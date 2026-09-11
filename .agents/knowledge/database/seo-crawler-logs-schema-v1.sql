-- =====================================================================================
-- Migration: seo_crawler_logs table with Mandatory Row Level Security (RLS)
-- Document ID: SCHEMA-SEO-CRAWLER-001
-- Task ID: TASK-02030103
-- Purpose: Monitor Googlebot, Bingbot, and search engine crawler indexing requests on
--          /notification/[slug] routes to verify Rich Result indexing health.
-- =====================================================================================

-- 1. Create seo_crawler_logs table
CREATE TABLE IF NOT EXISTS public.seo_crawler_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    bot_name VARCHAR(50) NOT NULL CHECK (bot_name IN ('googlebot', 'bingbot', 'yandex', 'duckduckbot', 'other')),
    user_agent TEXT NOT NULL,
    status_code INTEGER NOT NULL DEFAULT 200,
    response_time_ms INTEGER,
    ip_hash VARCHAR(64), -- SHA-256 hashed crawler IP for verification
    crawled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_seo_crawler_logs_slug 
    ON public.seo_crawler_logs(slug);

CREATE INDEX IF NOT EXISTS idx_seo_crawler_logs_bot_name 
    ON public.seo_crawler_logs(bot_name);

CREATE INDEX IF NOT EXISTS idx_seo_crawler_logs_crawled_at 
    ON public.seo_crawler_logs(crawled_at DESC);

-- 3. Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.seo_crawler_logs ENABLE ROW LEVEL SECURITY;

-- 4. Explicit RLS Policies (Idempotent)

-- Allow public insertion of crawler telemetry events from Next.js middleware/edge functions
DROP POLICY IF EXISTS "Allow public insert for crawler telemetry" ON public.seo_crawler_logs;
CREATE POLICY "Allow public insert for crawler telemetry"
    ON public.seo_crawler_logs
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Restrict read access strictly to authenticated Administrators
DROP POLICY IF EXISTS "Allow admins read access to crawler logs" ON public.seo_crawler_logs;
CREATE POLICY "Allow admins read access to crawler logs"
    ON public.seo_crawler_logs
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

-- Prohibit direct updates to preserve audit log immutability
DROP POLICY IF EXISTS "Prevent updates on crawler logs" ON public.seo_crawler_logs;
CREATE POLICY "Prevent updates on crawler logs"
    ON public.seo_crawler_logs
    FOR UPDATE
    TO authenticated
    USING (false);

-- Prohibit deletions except by super_admins during database maintenance
DROP POLICY IF EXISTS "Allow super_admins to delete crawler logs" ON public.seo_crawler_logs;
CREATE POLICY "Allow super_admins to delete crawler logs"
    ON public.seo_crawler_logs
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
COMMENT ON TABLE public.seo_crawler_logs IS 'Telemetry tracking search engine crawler visits on programmatic notification pages.';
COMMENT ON COLUMN public.seo_crawler_logs.bot_name IS 'Identified search engine crawler name (googlebot, bingbot, etc.).';
