-- =============================================================================
-- Migration: User Theme & Accessibility Preferences Schema (v1.0.0)
-- Task Reference: TASK-02010101 (Subtask: SUB-0201010101)
-- Architecture Reference: ADR-001 (Frontend), ADR-013 (Security)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security)
-- =============================================================================

-- Ensure uuid extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: user_theme_preferences
-- Persists authenticated candidate appearance preferences (theme, font scale, high contrast)
-- across multiple devices and mobile sessions.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_theme_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    theme_mode TEXT NOT NULL DEFAULT 'system' CHECK (theme_mode IN ('system', 'light', 'dark')),
    font_scale TEXT NOT NULL DEFAULT 'normal' CHECK (font_scale IN ('compact', 'normal', 'large')),
    high_contrast BOOLEAN NOT NULL DEFAULT false,
    reduced_motion BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_theme_preferences_user_id UNIQUE (user_id)
);

-- Index for instant lookup during authenticated session load
CREATE INDEX IF NOT EXISTS idx_user_theme_preferences_user_id 
    ON public.user_theme_preferences (user_id);

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.user_theme_preferences ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. Explicit Row Level Security Policies
-- -----------------------------------------------------------------------------

-- Policy: Candidates can read their own theme preferences
CREATE POLICY "Users can select own theme preferences"
    ON public.user_theme_preferences
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Policy: Candidates can insert their initial theme preferences
CREATE POLICY "Users can insert own theme preferences"
    ON public.user_theme_preferences
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Policy: Candidates can update their own theme preferences
CREATE POLICY "Users can update own theme preferences"
    ON public.user_theme_preferences
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Service role can manage theme preferences (e.g. during user registration hooks)
CREATE POLICY "Service role full access on theme preferences"
    ON public.user_theme_preferences
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.user_theme_preferences IS 
    'Persisted appearance, contrast, and accessibility settings for authenticated candidates.';
