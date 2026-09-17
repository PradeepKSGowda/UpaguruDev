-- ============================================================================
-- Migration: Exam CRUD Management RLS & Indexes
-- Target: Supabase Cloud PostgreSQL 15+
-- Schema: public.exams, public.audit_logs
-- Task ID: TASK-03030101
-- ============================================================================

-- 1. Ensure RLS is active on public.exams
ALTER TABLE IF EXISTS public.exams ENABLE ROW LEVEL SECURITY;

-- 2. Public Read Access: Anyone can read exams
DROP POLICY IF EXISTS "Public Read Published Exams" ON public.exams;
CREATE POLICY "Public Read Published Exams"
  ON public.exams
  FOR SELECT
  TO public
  USING (true);

-- 3. Admin Full Access: INSERT, UPDATE, DELETE for Admin / Service Role
DROP POLICY IF EXISTS "Admins insert master exam series" ON public.exams;
DROP POLICY IF EXISTS "Admins can insert parent exams" ON public.exams;
CREATE POLICY "Admins can insert exams"
  ON public.exams
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

DROP POLICY IF EXISTS "Admins update master exam series" ON public.exams;
DROP POLICY IF EXISTS "Admins can update parent exams" ON public.exams;
CREATE POLICY "Admins can update exams"
  ON public.exams
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

DROP POLICY IF EXISTS "Admins can delete exams" ON public.exams;
CREATE POLICY "Admins can delete exams"
  ON public.exams
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() ->> 'role') = 'service_role'
  );

-- 4. Unique Constraints & Performance Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_exams_slug_unique 
  ON public.exams(slug);

CREATE INDEX IF NOT EXISTS idx_exams_category_state 
  ON public.exams(category, state_or_central);

CREATE INDEX IF NOT EXISTS idx_exams_conducting_body_trgm 
  ON public.exams USING gin (conducting_body gin_trgm_ops);

-- 5. Comments
COMMENT ON POLICY "Admins can delete exams" ON public.exams IS 
  'Authorizes administrators to remove unreferenced examination series.';
