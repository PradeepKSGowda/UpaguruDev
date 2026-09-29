-- =============================================================================
-- Migration: 20260930_add_user_marital_status_and_gender.sql
-- Description: Add marital_status column to public.user_profiles and expand
--              gender check constraint to support all government examination options.
-- 
-- Exam Eligibility Impact:
-- - In Indian Government Exams (UPSC, KPSC, SSC, Defence NDA/CDS):
--   * Marital status is a primary eligibility criterion (e.g. Unmarried for NDA/IMA,
--     special age concessions for Divorced Women / Widows / Judicially Separated).
--   * Gender is required for category reservations, fee waivers, and physical standards.
-- =============================================================================

-- 1. Add marital_status column if it does not already exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'user_profiles' 
          AND column_name = 'marital_status'
    ) THEN
        ALTER TABLE public.user_profiles ADD COLUMN marital_status TEXT;
    END IF;
END $$;

-- 2. Add or update check constraint for marital_status
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS chk_user_profiles_marital_status;
ALTER TABLE public.user_profiles ADD CONSTRAINT chk_user_profiles_marital_status
    CHECK (marital_status IS NULL OR marital_status IN (
        'unmarried',
        'married',
        'divorced',
        'widowed',
        'widow_widower',
        'judicially_separated',
        'other'
    ));

-- 3. Update gender check constraint to include transgender and all standard choices
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_gender_check;
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS chk_user_profiles_gender;
ALTER TABLE public.user_profiles ADD CONSTRAINT chk_user_profiles_gender
    CHECK (gender IS NULL OR gender IN (
        'male',
        'female',
        'transgender',
        'other',
        'prefer_not_to_say'
    ));

-- 4. Create performance indexes for candidate eligibility matching
CREATE INDEX IF NOT EXISTS idx_user_profiles_marital_status ON public.user_profiles(marital_status);
CREATE INDEX IF NOT EXISTS idx_user_profiles_gender ON public.user_profiles(gender);

-- 5. Documentation comments
COMMENT ON COLUMN public.user_profiles.marital_status IS 
    'Candidate marital status (unmarried, married, divorced, widowed, judicially_separated, other) for exam eligibility and age relaxation evaluation.';
COMMENT ON COLUMN public.user_profiles.gender IS 
    'Candidate gender (male, female, transgender, other, prefer_not_to_say) for exam category reservations and fee exemptions.';
