-- =====================================================================================
-- Migration: exam_page_impressions table with Mandatory Row Level Security (RLS)
-- Document ID: SCHEMA-EXAM-IMPRESSIONS-001
-- Task ID: TASK-02050103
-- Purpose: Monitor candidate traffic and search crawler impressions across programmatic
--          exam entity hub pages (/exam/[slug]) for SEO performance tracking.
-- =====================================================================================

-- 1. Create exam_page_impressions table
CREATE TABLE IF NOT EXISTS public.exam_page_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    exam_slug TEXT NOT NULL,
    exam_id UUID REFERENCES public.exams(id) ON DELETE SET NULL,
    page_number INT NOT NULL DEFAULT 1,
    total_results_shown INT NOT NULL DEFAULT 0,
    user_agent TEXT,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    referrer TEXT,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_exam_impressions_viewed_at 
    ON public.exam_page_impressions(viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_impressions_slug 
    ON public.exam_page_impressions(exam_slug);

CREATE INDEX IF NOT EXISTS idx_exam_impressions_slug_viewed 
    ON public.exam_page_impressions(exam_slug, viewed_at DESC);

CREATE INDEX IF NOT EXISTS idx_exam_impressions_is_bot 
    ON public.exam_page_impressions(is_bot) 
    WHERE is_bot = TRUE;

-- 3. Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.exam_page_impressions ENABLE ROW LEVEL SECURITY;

-- 4. Explicit RLS Policies (Idempotent)

-- Allow public insertion of exam page impressions from Candidate Portal RSC/Edge
DROP POLICY IF EXISTS "Allow public insert for exam page impressions" ON public.exam_page_impressions;
CREATE POLICY "Allow public insert for exam page impressions"
    ON public.exam_page_impressions
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Restrict read access strictly to authenticated Administrators
DROP POLICY IF EXISTS "Allow admins read access to exam page impressions" ON public.exam_page_impressions;
CREATE POLICY "Allow admins read access to exam page impressions"
    ON public.exam_page_impressions
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
DROP POLICY IF EXISTS "Prevent updates on exam page impressions" ON public.exam_page_impressions;
CREATE POLICY "Prevent updates on exam page impressions"
    ON public.exam_page_impressions
    FOR UPDATE
    TO authenticated
    USING (false);

-- Prohibit deletions except for administrators
DROP POLICY IF EXISTS "Allow admins delete access to exam page impressions" ON public.exam_page_impressions;
CREATE POLICY "Allow admins delete access to exam page impressions"
    ON public.exam_page_impressions
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
