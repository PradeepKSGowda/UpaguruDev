-- =====================================================================================
-- Migration: admin_dashboard_metrics table & get_admin_dashboard_stats RPC function
-- Document ID: SCHEMA-ADMIN-DASHBOARD-001
-- Task ID: TASK-03010102 (Subtask: SUB-0301010201)
-- Purpose: Support high-performance administrative dashboard analytics, real-time
--          aggregate queries, and operational telemetry with Mandatory Row Level Security (RLS).
-- =====================================================================================

-- 1. Create admin_dashboard_metrics table for historical operational telemetry
CREATE TABLE IF NOT EXISTS public.admin_dashboard_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    metric_type VARCHAR(64) NOT NULL DEFAULT 'dashboard_view',
    pending_drafts_count INT NOT NULL DEFAULT 0,
    published_today_count INT NOT NULL DEFAULT 0,
    total_published_count INT NOT NULL DEFAULT 0,
    total_exams_count INT NOT NULL DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 2. Performance & Analytical Indexes
CREATE INDEX IF NOT EXISTS idx_admin_metrics_recorded_at 
    ON public.admin_dashboard_metrics(recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_metrics_admin_id 
    ON public.admin_dashboard_metrics(admin_id);

CREATE INDEX IF NOT EXISTS idx_admin_metrics_type 
    ON public.admin_dashboard_metrics(metric_type);

-- 3. Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.admin_dashboard_metrics ENABLE ROW LEVEL SECURITY;

-- 4. Explicit RLS Policies (Idempotent)

-- Policy 1: Restrict SELECT strictly to verified Administrators and Super Admins
DROP POLICY IF EXISTS "Allow admins read access to admin dashboard metrics" ON public.admin_dashboard_metrics;
CREATE POLICY "Allow admins read access to admin dashboard metrics"
    ON public.admin_dashboard_metrics
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

-- Policy 2: Allow authenticated admins to insert their own dashboard metrics telemetry
DROP POLICY IF EXISTS "Allow admins to insert dashboard metrics" ON public.admin_dashboard_metrics;
CREATE POLICY "Allow admins to insert dashboard metrics"
    ON public.admin_dashboard_metrics
    FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = admin_id
        AND (
            (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
            OR EXISTS (
                SELECT 1 FROM public.profiles
                WHERE public.profiles.id = auth.uid()
                AND public.profiles.role::text IN ('admin', 'super_admin')
            )
        )
    );

-- Policy 3: Prohibit direct updates to maintain audit telemetry immutability
DROP POLICY IF EXISTS "Prevent updates on admin dashboard metrics" ON public.admin_dashboard_metrics;
CREATE POLICY "Prevent updates on admin dashboard metrics"
    ON public.admin_dashboard_metrics
    FOR UPDATE
    TO authenticated
    USING (false);

-- Policy 4: Restrict DELETE strictly to Super Admins
DROP POLICY IF EXISTS "Allow super admins to delete dashboard metrics" ON public.admin_dashboard_metrics;
CREATE POLICY "Allow super admins to delete dashboard metrics"
    ON public.admin_dashboard_metrics
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

-- 5. High-Performance Atomic RPC Function for Aggregate Dashboard Counts
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pending_drafts INT;
    v_published_today INT;
    v_total_published INT;
    v_total_exams INT;
    v_today_utc TIMESTAMPTZ := date_trunc('day', timezone('utc'::text, now()));
    v_result JSON;
BEGIN
    -- Check caller authorization: must be admin or super_admin
    IF (auth.jwt() -> 'app_metadata' ->> 'role') NOT IN ('admin', 'super_admin')
       AND NOT EXISTS (
           SELECT 1 FROM public.profiles
           WHERE id = auth.uid() AND role::text IN ('admin', 'super_admin')
       ) THEN
        RAISE EXCEPTION 'Unauthorized: Caller lacks administrative privileges';
    END IF;

    -- Count pending review drafts
    SELECT COUNT(*) INTO v_pending_drafts
    FROM public.draft_notifications
    WHERE status = 'pending_review';

    -- Count notifications published today
    SELECT COUNT(*) INTO v_published_today
    FROM public.notifications
    WHERE status = 'published' AND published_at >= v_today_utc;

    -- Count total published notifications
    SELECT COUNT(*) INTO v_total_published
    FROM public.notifications
    WHERE status = 'published';

    -- Count total exams master entities
    SELECT COUNT(*) INTO v_total_exams
    FROM public.exams;

    v_result := json_build_object(
        'pending_drafts_count', v_pending_drafts,
        'published_today_count', v_published_today,
        'total_published_count', v_total_published,
        'total_exams_count', v_total_exams,
        'calculated_at', timezone('utc'::text, now())
    );

    RETURN v_result;
END;
$$;

-- Grant execution permissions on RPC function to authenticated users (role checked inside function)
REVOKE ALL ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;

-- 6. Comments
COMMENT ON TABLE public.admin_dashboard_metrics IS 'Historical telemetry capturing admin dashboard views and queue metrics';
COMMENT ON FUNCTION public.get_admin_dashboard_stats() IS 'Computes atomic high-performance counts for the admin dashboard overview';
