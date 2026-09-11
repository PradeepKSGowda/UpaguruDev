-- =====================================================================================
-- Migration: isr_revalidation_queue table with Mandatory Row Level Security (RLS)
-- Document ID: SCHEMA-ISR-REVALIDATION-001
-- Task ID: TASK-02030104
-- Purpose: Manage on-demand edge cache invalidation and ISR revalidation triggers
--          when notifications or exams are updated by administrators.
-- =====================================================================================

-- 1. Create isr_revalidation_queue table
CREATE TABLE IF NOT EXISTS public.isr_revalidation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_path TEXT NOT NULL,
    slug TEXT NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('notification_update', 'status_change', 'manual_admin', 'scheduled_purge')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    revalidated_at TIMESTAMPTZ
);

-- 2. Performance indexes
CREATE INDEX IF NOT EXISTS idx_isr_queue_status 
    ON public.isr_revalidation_queue(status, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_isr_queue_slug 
    ON public.isr_revalidation_queue(slug);

CREATE INDEX IF NOT EXISTS idx_isr_queue_route 
    ON public.isr_revalidation_queue(route_path);

-- 3. Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.isr_revalidation_queue ENABLE ROW LEVEL SECURITY;

-- 4. Explicit RLS Policies (Idempotent)

-- Allow platform administrators and super_admins to queue revalidation jobs
DROP POLICY IF EXISTS "Allow admins to insert revalidation jobs" ON public.isr_revalidation_queue;
CREATE POLICY "Allow admins to insert revalidation jobs"
    ON public.isr_revalidation_queue
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    );

-- Allow platform administrators to inspect queue status
DROP POLICY IF EXISTS "Allow admins to read revalidation queue" ON public.isr_revalidation_queue;
CREATE POLICY "Allow admins to read revalidation queue"
    ON public.isr_revalidation_queue
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

-- Allow platform administrators to update status during worker processing
DROP POLICY IF EXISTS "Allow admins to update revalidation queue" ON public.isr_revalidation_queue;
CREATE POLICY "Allow admins to update revalidation queue"
    ON public.isr_revalidation_queue
    FOR UPDATE
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
            AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    );

-- Prohibit deletions except by super_admins during queue cleanup
DROP POLICY IF EXISTS "Allow super_admins to delete revalidation jobs" ON public.isr_revalidation_queue;
CREATE POLICY "Allow super_admins to delete revalidation jobs"
    ON public.isr_revalidation_queue
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
COMMENT ON TABLE public.isr_revalidation_queue IS 'Queue tracking Next.js ISR on-demand edge cache invalidation requests for static routes.';
COMMENT ON COLUMN public.isr_revalidation_queue.route_path IS 'Target route URL path to revalidate (e.g., /notification/[slug]).';
