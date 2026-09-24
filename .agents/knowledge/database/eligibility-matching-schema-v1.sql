-- =============================================================================
-- Knowledge Database Reference: eligibility-matching-schema-v1.sql
-- Enhancement: ENH-0009 (Smart Eligibility Matching Engine)
-- Description: DDL definitions for candidate eligibility preferences and cached
--              matches with Row Level Security (RLS) policies.
-- Architecture Reference: ADR-002 (Database Schema), ADR-003 (RBAC)
-- =============================================================================

-- 1. Candidate Eligibility Preferences Table
CREATE TABLE IF NOT EXISTS public.candidate_eligibility_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    qualifications TEXT[] DEFAULT '{}',
    include_all_india_exams BOOLEAN DEFAULT true,
    include_state_exams BOOLEAN DEFAULT true,
    preferred_categories TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id)
);

-- 2. Cached Eligibility Match Results Table
CREATE TABLE IF NOT EXISTS public.eligibility_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
    is_eligible BOOLEAN NOT NULL DEFAULT false,
    dimension_details JSONB DEFAULT '{}',
    matched_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    UNIQUE (user_id, notification_id)
);

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_eligibility_matches_user_eligible
    ON public.eligibility_matches(user_id, is_eligible, overall_score DESC);

CREATE INDEX IF NOT EXISTS idx_eligibility_matches_expires
    ON public.eligibility_matches(expires_at);

CREATE INDEX IF NOT EXISTS idx_candidate_prefs_user
    ON public.candidate_eligibility_preferences(user_id);

-- 4. Row Level Security (RLS)
ALTER TABLE public.candidate_eligibility_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eligibility_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Candidate can select own eligibility prefs" ON public.candidate_eligibility_preferences;
CREATE POLICY "Candidate can select own eligibility prefs"
    ON public.candidate_eligibility_preferences
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'users:read:all'));

DROP POLICY IF EXISTS "Candidate can insert own eligibility prefs" ON public.candidate_eligibility_preferences;
CREATE POLICY "Candidate can insert own eligibility prefs"
    ON public.candidate_eligibility_preferences
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Candidate can update own eligibility prefs" ON public.candidate_eligibility_preferences;
CREATE POLICY "Candidate can update own eligibility prefs"
    ON public.candidate_eligibility_preferences
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Candidate can delete own eligibility prefs" ON public.candidate_eligibility_preferences;
CREATE POLICY "Candidate can delete own eligibility prefs"
    ON public.candidate_eligibility_preferences
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Candidate can read own eligibility matches" ON public.eligibility_matches;
CREATE POLICY "Candidate can read own eligibility matches"
    ON public.eligibility_matches
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'analytics:kpi:read'));

DROP POLICY IF EXISTS "Candidate can insert or cache own eligibility matches" ON public.eligibility_matches;
CREATE POLICY "Candidate can insert or cache own eligibility matches"
    ON public.eligibility_matches
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Candidate can update own eligibility matches" ON public.eligibility_matches;
CREATE POLICY "Candidate can update own eligibility matches"
    ON public.eligibility_matches
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Candidate can delete own eligibility matches" ON public.eligibility_matches;
CREATE POLICY "Candidate can delete own eligibility matches"
    ON public.eligibility_matches
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);
