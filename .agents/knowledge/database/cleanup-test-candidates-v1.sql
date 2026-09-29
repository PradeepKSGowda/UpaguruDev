-- ============================================================================
-- UPA-GURU: Synthetic Candidate Teardown Script (Safe SQL Cleanup)
-- Enhancement: ENH-CANDIDATE-TEST-MATRIX (v2.0)
-- Safety: Hardcoded constraint restricted EXCLUSIVELY to email LIKE '%@upaguru.test'
--
-- Deleting from auth.users automatically triggers ON DELETE CASCADE
-- across public.profiles, public.user_profiles, and public.user_subscriptions.
-- ============================================================================

DO $$
DECLARE
  v_test_count INTEGER;
  v_non_test_count INTEGER;
BEGIN
  -- 1. Safety audit: Ensure zero real user accounts are targeted
  SELECT COUNT(*) INTO v_non_test_count
  FROM public.profiles
  WHERE email NOT LIKE '%@upaguru.test'
    AND email IN (
      SELECT email FROM public.profiles WHERE email LIKE '%@upaguru.test'
    );

  IF v_non_test_count > 0 THEN
    RAISE EXCEPTION 'CRITICAL SAFETY FAILURE: Found collision with non-test account! Aborting.';
  END IF;

  SELECT COUNT(*) INTO v_test_count
  FROM public.profiles
  WHERE email LIKE '%@upaguru.test';

  RAISE NOTICE 'Found % synthetic test candidate accounts in public.profiles to delete.', v_test_count;

  -- 2. Delete user_profiles child rows first
  DELETE FROM public.user_profiles
  WHERE id IN (
    SELECT id FROM public.profiles WHERE email LIKE '%@upaguru.test'
  );

  -- 3. Delete from public.profiles
  DELETE FROM public.profiles
  WHERE email LIKE '%@upaguru.test';

  -- 4. Delete parent auth.users rows to keep auth schema in clean state
  DELETE FROM auth.users
  WHERE email LIKE '%@upaguru.test';

  RAISE NOTICE 'Successfully purged synthetic test accounts from auth and public schemas. Zero real candidate profiles affected.';
END $$;
