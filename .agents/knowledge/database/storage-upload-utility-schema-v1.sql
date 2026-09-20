-- =============================================================================
-- UPA-GURU Database Migration: Storage Upload Telemetry & Audit Logs (v1.0.0)
-- Task ID: TASK-06010102 (Subtask: SUB-0601010201 - File Upload Utility)
-- Complies with: ADR-002, ADR-011, ADR-013, AGENTS.md (Rule 3: Mandatory RLS & RBAC)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Storage Upload Audit Table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.storage_upload_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
    mime_type TEXT NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT false,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.storage_upload_logs IS 'Audit ledger tracking media asset uploads across all Supabase Storage buckets';
COMMENT ON COLUMN public.storage_upload_logs.bucket_id IS 'Target storage bucket (public-notifications, public-logos, draft-attachments)';
COMMENT ON COLUMN public.storage_upload_logs.file_path IS 'Relative storage object path';
COMMENT ON COLUMN public.storage_upload_logs.file_size_bytes IS 'Exact file size in bytes verified prior to upload';

-- -----------------------------------------------------------------------------
-- 2. Performance Indexes
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_storage_upload_logs_bucket_created 
    ON public.storage_upload_logs(bucket_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_storage_upload_logs_user 
    ON public.storage_upload_logs(uploaded_by);

-- -----------------------------------------------------------------------------
-- 3. Mandatory Row Level Security (RLS) Enablement
-- -----------------------------------------------------------------------------
ALTER TABLE public.storage_upload_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. Explicit Row Level Security Policies (Idempotent)
-- -----------------------------------------------------------------------------

-- Policy 4.1: Admins can view all upload logs
DROP POLICY IF EXISTS "Allow admin read on storage_upload_logs" ON public.storage_upload_logs;
CREATE POLICY "Allow admin read on storage_upload_logs"
ON public.storage_upload_logs
FOR SELECT
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    OR
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE public.profiles.id = auth.uid()
          AND public.profiles.role::text IN ('admin', 'super_admin')
    )
);

-- Policy 4.2: Authenticated users / Service role can insert upload logs
DROP POLICY IF EXISTS "Allow authenticated insert on storage_upload_logs" ON public.storage_upload_logs;
CREATE POLICY "Allow authenticated insert on storage_upload_logs"
ON public.storage_upload_logs
FOR INSERT
WITH CHECK (
    auth.role() IN ('authenticated', 'service_role')
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
);

-- Policy 4.3: Prohibit unauthorized deletion or modification
DROP POLICY IF EXISTS "Allow super_admin delete on storage_upload_logs" ON public.storage_upload_logs;
CREATE POLICY "Allow super_admin delete on storage_upload_logs"
ON public.storage_upload_logs
FOR DELETE
USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
);

-- -----------------------------------------------------------------------------
-- 5. Verification Queries
-- -----------------------------------------------------------------------------
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'storage_upload_logs';

SELECT policyname, permissive, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'storage_upload_logs';
