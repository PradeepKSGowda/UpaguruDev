-- =============================================================================
-- Migration: Site Navigation & Portal Taxonomy Schema (v1.0.0)
-- Task Reference: TASK-02010102 (Subtasks: SUB-0201010201, SUB-0201010202)
-- Architecture Reference: ADR-001 (Frontend), ADR-013 (Security)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security)
-- =============================================================================

-- Ensure uuid extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: site_navigation_items
-- Stores configurable navigation links across Header, Mobile Drawer, and Footer
-- with authorization levels and display ordering.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_navigation_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    href TEXT NOT NULL,
    section TEXT NOT NULL CHECK (section IN ('header', 'mobile_nav', 'footer_boards', 'footer_resources', 'footer_legal')),
    icon TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    requires_auth BOOLEAN NOT NULL DEFAULT false,
    required_role TEXT DEFAULT NULL,
    target_blank BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for ordering and fast section lookups
CREATE INDEX IF NOT EXISTS idx_site_navigation_section_order 
    ON public.site_navigation_items (section, display_order) 
    WHERE is_active = true;

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.site_navigation_items ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. Explicit Row Level Security Policies
-- -----------------------------------------------------------------------------

-- Policy: Anyone (authenticated or anonymous) can view active navigation links
CREATE POLICY "Public read active navigation items"
    ON public.site_navigation_items
    FOR SELECT
    TO anon, authenticated
    USING (is_active = true);

-- Policy: Only Platform Administrators can create or modify navigation items
CREATE POLICY "Admin write access on navigation items"
    ON public.site_navigation_items
    FOR ALL
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    )
    WITH CHECK (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

-- Policy: Service role has full access
CREATE POLICY "Service role full access on navigation items"
    ON public.site_navigation_items
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 3. Initial Baseline Seed Data
-- -----------------------------------------------------------------------------
INSERT INTO public.site_navigation_items (title, href, section, icon, display_order)
VALUES
    ('Home', '/', 'header', 'Home', 1),
    ('Notifications', '/#notifications', 'header', 'Bell', 2),
    ('Categories', '/#categories', 'header', 'BookOpen', 3),
    ('About', '/#about', 'header', 'ShieldCheck', 4),
    ('UPSC Civil Services', '/#categories', 'footer_boards', NULL, 1),
    ('SSC (CGL, CHSL, MTS)', '/#categories', 'footer_boards', NULL, 2),
    ('Railway Recruitment (RRB)', '/#categories', 'footer_boards', NULL, 3),
    ('Banking (IBPS, SBI, RBI)', '/#categories', 'footer_boards', NULL, 4),
    ('State PSCs (KPSC, MPPSC)', '/#categories', 'footer_boards', NULL, 5),
    ('Privacy Policy', '/#privacy', 'footer_legal', NULL, 1),
    ('Terms of Service', '/#terms', 'footer_legal', NULL, 2),
    ('Government Disclaimer', '/#disclaimer', 'footer_legal', NULL, 3),
    ('Contact & Support', '/#contact', 'footer_legal', NULL, 4)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.site_navigation_items IS 
    'Centralized catalog of portal navigation links, footer menus, and testing landmark identifiers.';
