-- =============================================================================
-- UPA-GURU Database Migration: Cache Revalidation & ISR Queue Schema (v1.0.0)
-- Task ID: TASK-06020101 (Subtask: SUB-0602010101 - Cache Tags & Revalidation)
-- Complies with: ADR-002, ADR-010 (Caching), ADR-013, AGENTS.md (Rule 3 & 4)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Create isr_revalidation_queue Table (If not already provisioned)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.isr_revalidation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_path TEXT NOT NULL,
    slug TEXT NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('notification_update', 'status_change', 'manual_admin', 'scheduled_purge')),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 1,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    revalidated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.isr_revalidation_queue IS 'Audit and telemetry ledger of on-demand edge cache invalidations and ISR purges';
COMMENT ON COLUMN public.isr_revalidation_queue.route_path IS 'Target URL path purged (e.g. /notification/[slug], /notifications, /exams)';
COMMENT ON COLUMN public.isr_revalidation_queue.slug IS 'Subject entity URL slug';
COMMENT ON COLUMN public.isr_revalidation_queue.reason IS 'Reason for purge: notification_update, status_change, manual_admin, scheduled_purge';

-- -----------------------------------------------------------------------------
-- 2. Performance Indexes for Cache Telemetry Analytics
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_isr_queue_status_created 
    ON public.isr_revalidation_queue(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_isr_queue_slug 
    ON public.isr_revalidation_queue(slug);

CREATE INDEX IF NOT EXISTS idx_isr_queue_route 
    ON public.isr_revalidation_queue(route_path);

-- -----------------------------------------------------------------------------
-- 3. Mandatory Row Level Security (RLS) Enablement
-- -----------------------------------------------------------------------------
ALTER TABLE public.isr_revalidation_queue ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. Explicit Row Level Security Policies (Idempotent)
-- -----------------------------------------------------------------------------

-- Policy 4.1: Admins and Service Role can insert revalidation jobs
DROP POLICY IF EXISTS "Allow admins to insert revalidation jobs" ON public.isr_revalidation_queue;
CREATE POLICY "Allow admins to insert revalidation jobs"
ON public.isr_revalidation_queue
FOR INSERT
WITH CHECK (
    auth.role() IN ('authenticated', 'service_role')
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE public.profiles.id = auth.uid()
          AND public.profiles.role::text IN ('admin', 'super_admin')
    )
);

-- Policy 4.2: Admins can inspect revalidation queue telemetry
DROP POLICY IF EXISTS "Allow admins to read revalidation queue" ON public.isr_revalidation_queue;
CREATE POLICY "Allow admins to read revalidation queue"
ON public.isr_revalidation_queue
FOR SELECT
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE public.profiles.id = auth.uid()
          AND public.profiles.role::text IN ('admin', 'super_admin')
    )
);

-- Policy 4.3: Prohibit deletions except by super_admin
DROP POLICY IF EXISTS "Allow super_admins to delete revalidation jobs" ON public.isr_revalidation_queue;
CREATE POLICY "Allow super_admins to delete revalidation jobs"
ON public.isr_revalidation_queue
FOR DELETE
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE public.profiles.id = auth.uid()
          AND public.profiles.role::text = 'super_admin'
    )
);

-- -----------------------------------------------------------------------------
-- 5. Helper Function: log_isr_revalidation
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_isr_revalidation(
    p_route_path TEXT,
    p_slug TEXT,
    p_reason VARCHAR
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO public.isr_revalidation_queue (
        route_path,
        slug,
        reason,
        status,
        attempts,
        revalidated_at
    ) VALUES (
        p_route_path,
        p_slug,
        p_reason,
        'completed',
        1,
        NOW()
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Verification Queries
-- -----------------------------------------------------------------------------
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'isr_revalidation_queue';

SELECT policyname, permissive, roles, cmd 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'isr_revalidation_queue';
