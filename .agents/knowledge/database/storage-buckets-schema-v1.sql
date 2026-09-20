-- =============================================================================
-- UPA-GURU Database Migration: Supabase Storage Buckets & Access Policies (v1.0.0)
-- Task ID: TASK-06010101
-- Subtasks:
--   - SUB-0601010101: Create public-notifications bucket with public read policy
--   - SUB-0601010102: Create public-logos bucket and draft-attachments bucket
-- Complies with: ADR-002 (Database), ADR-011 (File Storage), ADR-013 (Security),
--                AGENTS.md Rule 3 (Mandatory Row Level Security on storage buckets)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Register Storage Buckets in storage.buckets Table
-- -----------------------------------------------------------------------------
-- Idempotent upsert ensuring bucket existence, visibility flags, size limits,
-- and allowed MIME type restrictions.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    (
        'public-notifications', 
        'public-notifications', 
        true, 
        52428800, -- 50 MB
        ARRAY['application/pdf']::text[]
    ),
    (
        'public-logos', 
        'public-logos', 
        true, 
        5242880,  -- 5 MB
        ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']::text[]
    ),
    (
        'draft-attachments', 
        'draft-attachments', 
        false, -- Private: Restricted to Admin HITL & Scrapers
        52428800, -- 50 MB
        ARRAY['application/pdf']::text[]
    )
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- -----------------------------------------------------------------------------
-- 2. Storage Objects Row Level Security Notice
-- -----------------------------------------------------------------------------
-- Note: Row Level Security (RLS) is enabled by default on storage.objects in Supabase
-- and managed internally by supabase_storage_admin. Direct ALTER TABLE DDL on
-- storage.objects is restricted (causing ERROR: 42501). Policies are directly
-- managed on the table below.

-- -----------------------------------------------------------------------------
-- 3. Row Level Security Policies for 'public-notifications'
--    - Public Read: Anyone (anon/authenticated) can read verified notification PDFs
--    - Admin Insert/Update/Delete: Only admin/super_admin or service_role can modify
-- -----------------------------------------------------------------------------

-- Policy 3.1: Public Read Access
DROP POLICY IF EXISTS "Allow public read access on public-notifications" ON storage.objects;
CREATE POLICY "Allow public read access on public-notifications"
ON storage.objects
FOR SELECT
USING (bucket_id = 'public-notifications');

-- Policy 3.2: Admin Upload (Insert) Access
DROP POLICY IF EXISTS "Allow admin insert on public-notifications" ON storage.objects;
CREATE POLICY "Allow admin insert on public-notifications"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'public-notifications'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    )
);

-- Policy 3.3: Admin Update Access
DROP POLICY IF EXISTS "Allow admin update on public-notifications" ON storage.objects;
CREATE POLICY "Allow admin update on public-notifications"
ON storage.objects
FOR UPDATE
USING (
    bucket_id = 'public-notifications'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    )
)
WITH CHECK (
    bucket_id = 'public-notifications'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    )
);

-- Policy 3.4: Admin Delete Access
DROP POLICY IF EXISTS "Allow admin delete on public-notifications" ON storage.objects;
CREATE POLICY "Allow admin delete on public-notifications"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'public-notifications'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    )
);

-- -----------------------------------------------------------------------------
-- 4. Row Level Security Policies for 'public-logos'
--    - Public Read: Anyone can read organization logos for UI display
--    - Admin Insert/Update/Delete: Only admin/super_admin or service_role can modify
-- -----------------------------------------------------------------------------

-- Policy 4.1: Public Read Access
DROP POLICY IF EXISTS "Allow public read access on public-logos" ON storage.objects;
CREATE POLICY "Allow public read access on public-logos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'public-logos');

-- Policy 4.2: Admin Upload (Insert) Access
DROP POLICY IF EXISTS "Allow admin insert on public-logos" ON storage.objects;
CREATE POLICY "Allow admin insert on public-logos"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'public-logos'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    )
);

-- Policy 4.3: Admin Update Access
DROP POLICY IF EXISTS "Allow admin update on public-logos" ON storage.objects;
CREATE POLICY "Allow admin update on public-logos"
ON storage.objects
FOR UPDATE
USING (
    bucket_id = 'public-logos'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    )
)
WITH CHECK (
    bucket_id = 'public-logos'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    )
);

-- Policy 4.4: Admin Delete Access
DROP POLICY IF EXISTS "Allow admin delete on public-logos" ON storage.objects;
CREATE POLICY "Allow admin delete on public-logos"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'public-logos'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    )
);

-- -----------------------------------------------------------------------------
-- 5. Row Level Security Policies for 'draft-attachments'
--    - Private: Read access restricted strictly to Admin / Super Admin
--    - Admin Insert/Update/Delete: Restricted to Admin / Super Admin (Scraper uses service_role)
-- -----------------------------------------------------------------------------

-- Policy 5.1: Admin Read Access
DROP POLICY IF EXISTS "Allow admin read on draft-attachments" ON storage.objects;
CREATE POLICY "Allow admin read on draft-attachments"
ON storage.objects
FOR SELECT
USING (
    bucket_id = 'draft-attachments'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    )
);

-- Policy 5.2: Admin Upload (Insert) Access
DROP POLICY IF EXISTS "Allow admin insert on draft-attachments" ON storage.objects;
CREATE POLICY "Allow admin insert on draft-attachments"
ON storage.objects
FOR INSERT
WITH CHECK (
    bucket_id = 'draft-attachments'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    )
);

-- Policy 5.3: Admin Update Access
DROP POLICY IF EXISTS "Allow admin update on draft-attachments" ON storage.objects;
CREATE POLICY "Allow admin update on draft-attachments"
ON storage.objects
FOR UPDATE
USING (
    bucket_id = 'draft-attachments'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    )
)
WITH CHECK (
    bucket_id = 'draft-attachments'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    )
);

-- Policy 5.4: Admin Delete Access
DROP POLICY IF EXISTS "Allow admin delete on draft-attachments" ON storage.objects;
CREATE POLICY "Allow admin delete on draft-attachments"
ON storage.objects
FOR DELETE
USING (
    bucket_id = 'draft-attachments'
    AND (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
        OR
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE public.profiles.id = auth.uid()
              AND public.profiles.role::text IN ('admin', 'super_admin')
        )
    )
);

-- -----------------------------------------------------------------------------
-- 6. Verification & Inspection Queries
-- -----------------------------------------------------------------------------
-- Query 1: Verify configured buckets
SELECT 
    id, 
    name, 
    public, 
    file_size_limit, 
    allowed_mime_types, 
    created_at 
FROM storage.buckets 
WHERE id IN ('public-notifications', 'public-logos', 'draft-attachments')
ORDER BY id;

-- Query 2: Verify RLS policies on storage.objects
SELECT 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual, 
    with_check 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects'
  AND (
      policyname LIKE '%public-notifications%'
      OR policyname LIKE '%public-logos%'
      OR policyname LIKE '%draft-attachments%'
  )
ORDER BY policyname;
