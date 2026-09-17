-- ============================================================================
-- Migration: Audit Log Viewer RLS Policies & Performance Indexes
-- Target: Supabase Cloud PostgreSQL 15+
-- Schema: public.audit_logs
-- Task ID: TASK-03040101
-- ============================================================================

-- 1. Ensure RLS is active on public.audit_logs
ALTER TABLE IF EXISTS public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 2. Read Policy: Only authenticated administrators and service_role can query audit logs
DROP POLICY IF EXISTS "Admins read audit logs" ON public.audit_logs;
CREATE POLICY "Admins read audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- 3. Composite Performance Indexes for High-Volume Queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at_desc 
  ON public.audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created 
  ON public.audit_logs(action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_created 
  ON public.audit_logs(admin_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_target 
  ON public.audit_logs(target_entity, target_id);

-- 4. Documentation Comments
COMMENT ON POLICY "Admins read audit logs" ON public.audit_logs IS
  'Restricts forensic audit log inspection to authenticated administrators with admin or super_admin roles.';
