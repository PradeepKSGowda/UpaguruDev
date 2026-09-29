-- ============================================================================
-- UPA-GURU: Synthetic Candidate Test Population Seeder (SQL Script)
-- Enhancement: ENH-CANDIDATE-TEST-MATRIX (v2.0)
-- Purpose: Deterministic seeding of test candidates for eligibility validation
-- Safety: Restricted strictly to domain '@upaguru.test'
--
-- Note on Foreign Keys:
-- public.profiles.id REFERENCES auth.users(id) ON DELETE CASCADE.
-- Therefore, synthetic identities are created in auth.users FIRST to satisfy
-- the profiles_id_fkey constraint before populating profiles & user_profiles.
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Starting synthetic candidate test matrix SQL seeding...';
END $$;

-- ----------------------------------------------------------------------------
-- 1. Populate auth.users with deterministic test identities
-- ----------------------------------------------------------------------------
INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  is_super_admin,
  created_at,
  updated_at
)
VALUES
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0001@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"AGE18 Min-2d Kumar"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0002@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"AGE18 Min-1d Kumar"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0003@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"AGE18 Min-Exact Kumar"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0004@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"AGE18 Min+1d Kumar"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0005@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"AGE19 Min+1y Kumar"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0006@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"AGE24 Mid-Range Kumar"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0007@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"AGE26 Max-1y Kumar"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000008', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0008@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"AGE27 Max-1d Kumar"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000009', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0009@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"AGE27 Max-Exact Kumar"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000010', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0010@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"AGE27 Max+1d Kumar"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000011', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0011@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"AGE28 Max+1y Kumar"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000012', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0012@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"AGE30 Max+3y Kumar"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000013', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0013@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"OBC AGE29 Patel"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000014', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0014@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"OBC AGE30-Exact Patel"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000015', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0015@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"OBC AGE30+1d Patel"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000017', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0017@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"SC AGE31 Kamble"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000018', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0018@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"SC AGE32-Exact Kamble"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000019', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0019@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"SC AGE32+1d Kamble"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000026', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0026@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"SSLC Kumar"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000030', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0030@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"DIPLOMA Civil Gowda"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000033', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0033@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"BE CS Gowda"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000061', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0061@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"KK Kalaburagi Certified Patil"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000062', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0062@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"KK Kalaburagi Uncertified Patil"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000069', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0069@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"MAH Mumbai Deshmukh"}'::jsonb, false, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000100', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'tc0100@upaguru.test', '$2a$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGPEWJqOz8Gqr6vKa', NOW(), '{"provider":"email","providers":["email"],"role":"candidate"}'::jsonb, '{"full_name":"COMBO Multi-Fail All-Three"}'::jsonb, false, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  updated_at = NOW();

-- ----------------------------------------------------------------------------
-- 2. Synchronize public.profiles (Satisfies profiles_id_fkey)
-- ----------------------------------------------------------------------------
INSERT INTO public.profiles (
  id,
  email,
  full_name,
  role,
  email_verified,
  auth_provider,
  created_at,
  updated_at
)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'tc0001@upaguru.test', 'AGE18 Min-2d Kumar', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000002', 'tc0002@upaguru.test', 'AGE18 Min-1d Kumar', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000003', 'tc0003@upaguru.test', 'AGE18 Min-Exact Kumar', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000004', 'tc0004@upaguru.test', 'AGE18 Min+1d Kumar', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000005', 'tc0005@upaguru.test', 'AGE19 Min+1y Kumar', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000006', 'tc0006@upaguru.test', 'AGE24 Mid-Range Kumar', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000007', 'tc0007@upaguru.test', 'AGE26 Max-1y Kumar', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000008', 'tc0008@upaguru.test', 'AGE27 Max-1d Kumar', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000009', 'tc0009@upaguru.test', 'AGE27 Max-Exact Kumar', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000010', 'tc0010@upaguru.test', 'AGE27 Max+1d Kumar', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000011', 'tc0011@upaguru.test', 'AGE28 Max+1y Kumar', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000012', 'tc0012@upaguru.test', 'AGE30 Max+3y Kumar', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000013', 'tc0013@upaguru.test', 'OBC AGE29 Patel', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000014', 'tc0014@upaguru.test', 'OBC AGE30-Exact Patel', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000015', 'tc0015@upaguru.test', 'OBC AGE30+1d Patel', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000017', 'tc0017@upaguru.test', 'SC AGE31 Kamble', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000018', 'tc0018@upaguru.test', 'SC AGE32-Exact Kamble', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000019', 'tc0019@upaguru.test', 'SC AGE32+1d Kamble', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000026', 'tc0026@upaguru.test', 'SSLC Kumar', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000030', 'tc0030@upaguru.test', 'DIPLOMA Civil Gowda', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000033', 'tc0033@upaguru.test', 'BE CS Gowda', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000061', 'tc0061@upaguru.test', 'KK Kalaburagi Certified Patil', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000062', 'tc0062@upaguru.test', 'KK Kalaburagi Uncertified Patil', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000069', 'tc0069@upaguru.test', 'MAH Mumbai Deshmukh', 'candidate', true, 'email', NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000100', 'tc0100@upaguru.test', 'COMBO Multi-Fail All-Three 29y SSLC GM MAH', 'candidate', true, 'email', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  email_verified = EXCLUDED.email_verified,
  updated_at = NOW();

-- ----------------------------------------------------------------------------
-- 3. Populate public.user_profiles with KYC demographics
-- ----------------------------------------------------------------------------
INSERT INTO public.user_profiles (
  id,
  first_name,
  last_name,
  phone,
  gender,
  marital_status,
  date_of_birth,
  category,
  state,
  district,
  is_phone_verified,
  profile_completion_percentage,
  created_at,
  updated_at
)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'AGE18', 'Min-2d Kumar', '+919999000001', 'male', 'unmarried', '2009-01-03', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000002', 'AGE18', 'Min-1d Kumar', '+919999000002', 'male', 'unmarried', '2009-01-02', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000003', 'AGE18', 'Min-Exact Kumar', '+919999000003', 'male', 'unmarried', '2009-01-01', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000004', 'AGE18', 'Min+1d Kumar', '+919999000004', 'male', 'unmarried', '2008-12-31', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000005', 'AGE19', 'Min+1y Kumar', '+919999000005', 'male', 'unmarried', '2008-01-01', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000006', 'AGE24', 'Mid-Range Kumar', '+919999000006', 'male', 'unmarried', '2003-01-01', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000007', 'AGE26', 'Max-1y Kumar', '+919999000007', 'male', 'unmarried', '2001-01-01', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000008', 'AGE27', 'Max-1d Kumar', '+919999000008', 'male', 'unmarried', '2000-01-02', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000009', 'AGE27', 'Max-Exact Kumar', '+919999000009', 'male', 'unmarried', '2000-01-01', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000010', 'AGE27', 'Max+1d Kumar', '+919999000010', 'male', 'unmarried', '1999-12-31', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000011', 'AGE28', 'Max+1y Kumar', '+919999000011', 'male', 'unmarried', '1999-01-01', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000012', 'AGE30', 'Max+3y Kumar', '+919999000012', 'male', 'unmarried', '1997-01-01', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000013', 'OBC', 'AGE29 Patel', '+919999000013', 'male', 'unmarried', '1998-01-01', 'OBC', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000014', 'OBC', 'AGE30-Exact Patel', '+919999000014', 'male', 'unmarried', '1997-01-01', 'OBC', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000015', 'OBC', 'AGE30+1d Patel', '+919999000015', 'male', 'unmarried', '1996-12-31', 'OBC', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000017', 'SC', 'AGE31 Kamble', '+919999000017', 'male', 'unmarried', '1996-01-01', 'SC', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000018', 'SC', 'AGE32-Exact Kamble', '+919999000018', 'male', 'unmarried', '1995-01-01', 'SC', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000019', 'SC', 'AGE32+1d Kamble', '+919999000019', 'male', 'unmarried', '1994-12-31', 'SC', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000026', 'SSLC', 'Kumar', '+919999000026', 'male', 'unmarried', '2003-01-01', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000030', 'DIPLOMA', 'Civil Gowda', '+919999000030', 'male', 'unmarried', '2003-01-01', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000033', 'BE', 'CS Gowda', '+919999000033', 'male', 'unmarried', '2003-01-01', 'GM', 'Karnataka', 'Bengaluru Urban', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000061', 'KK', 'Kalaburagi Certified Patil', '+919999000061', 'male', 'unmarried', '2003-01-01', 'OBC', 'Karnataka', 'Kalaburagi', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000062', 'KK', 'Kalaburagi Uncertified Patil', '+919999000062', 'male', 'unmarried', '2003-01-01', 'OBC', 'Karnataka', 'Kalaburagi', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000069', 'MAH', 'Mumbai Deshmukh', '+919999000069', 'male', 'unmarried', '2003-01-01', 'GM', 'Maharashtra', 'Mumbai', true, 100, NOW(), NOW()),
  ('00000000-0000-4000-8000-000000000100', 'COMBO', 'Multi-Fail All-Three', '+919999000100', 'male', 'unmarried', '1998-01-01', 'GM', 'Maharashtra', 'Pune', true, 100, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  date_of_birth = EXCLUDED.date_of_birth,
  category = EXCLUDED.category,
  state = EXCLUDED.state,
  district = EXCLUDED.district,
  updated_at = NOW();

DO $$
BEGIN
  RAISE NOTICE 'Synthetic candidate seeding completed successfully!';
END $$;
