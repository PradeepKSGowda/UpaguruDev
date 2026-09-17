-- ============================================================================
-- Migration: Notification CRUD Management RLS & Performance Indexes
-- Target: Supabase Cloud PostgreSQL 15+
-- Schema: public.notifications, public.audit_logs
-- Task ID: TASK-03030102
-- ============================================================================

-- 1. Ensure RLS is active on public.notifications
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Read Access:
-- Public can only view published notifications
DROP POLICY IF EXISTS "Public Read Published Notifications" ON public.notifications;
CREATE POLICY "Public Read Published Notifications"
  ON public.notifications
  FOR SELECT
  TO public
  USING (status = 'published');

-- Admins can view all notifications regardless of status
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
CREATE POLICY "Admins can view all notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- 3. Write Access for Admins:
-- Admins can insert notifications
DROP POLICY IF EXISTS "Admins can insert verified notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications"
  ON public.notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- Admins can update notifications
DROP POLICY IF EXISTS "Admins can update notifications" ON public.notifications;
CREATE POLICY "Admins can update notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() ->> 'role') = 'service_role'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- Admins can delete notifications
DROP POLICY IF EXISTS "Admins can delete notifications" ON public.notifications;
CREATE POLICY "Admins can delete notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- 4. Unique & Performance Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_slug_unique 
  ON public.notifications(slug);

CREATE INDEX IF NOT EXISTS idx_notifications_exam_status 
  ON public.notifications(exam_id, status);

CREATE INDEX IF NOT EXISTS idx_notifications_admin_filter 
  ON public.notifications(status, application_end_date DESC, created_at DESC);

-- 5. Documentation Comments
COMMENT ON POLICY "Admins can delete notifications" ON public.notifications IS
  'Authorizes administrators to delete obsolete or erroneously created notification records.';
