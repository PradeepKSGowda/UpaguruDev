-- =============================================================================
-- Migration: 20260928_crawler_portals.sql
-- Description: Dynamic Portal Crawler URLs and Historical Audit Log.
--              Enables administrators to view, verify, and update extraction URLs
--              for recruitment portals directly from the Admin Cockpit, storing
--              full URL transition history for documentation.
-- Architecture Reference: ADR-002 (Database Schema), ADR-003 (RBAC)
-- =============================================================================

-- 1. Crawler Portals Table
CREATE TABLE IF NOT EXISTS public.crawler_portals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_code TEXT NOT NULL UNIQUE,
    portal_name TEXT NOT NULL,
    official_website TEXT NOT NULL,
    current_target_url TEXT NOT NULL,
    wait_selector TEXT,
    is_active BOOLEAN DEFAULT true,
    last_verified_at TIMESTAMPTZ,
    last_status_code INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Crawler Portal URL Transition History (Audit Log)
CREATE TABLE IF NOT EXISTS public.crawler_portal_url_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_code TEXT NOT NULL REFERENCES public.crawler_portals(portal_code) ON DELETE CASCADE,
    previous_url TEXT NOT NULL,
    new_url TEXT NOT NULL,
    reason TEXT,
    changed_by UUID REFERENCES auth.users(id),
    changed_by_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_crawler_portals_code
    ON public.crawler_portals(portal_code);

CREATE INDEX IF NOT EXISTS idx_crawler_portal_history_code
    ON public.crawler_portal_url_history(portal_code, created_at DESC);

-- 4. Mandatory Row Level Security (RLS)
ALTER TABLE public.crawler_portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawler_portal_url_history ENABLE ROW LEVEL SECURITY;

-- 4.1 Idempotent RLS Policies for crawler_portals
DROP POLICY IF EXISTS "Public can view crawler portals" ON public.crawler_portals;
CREATE POLICY "Public can view crawler portals"
    ON public.crawler_portals
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "Admins can insert crawler portals" ON public.crawler_portals;
CREATE POLICY "Admins can insert crawler portals"
    ON public.crawler_portals
    FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), 'notifications:write'));

DROP POLICY IF EXISTS "Admins can update crawler portals" ON public.crawler_portals;
CREATE POLICY "Admins can update crawler portals"
    ON public.crawler_portals
    FOR UPDATE TO authenticated
    USING (public.has_permission(auth.uid(), 'notifications:write'))
    WITH CHECK (public.has_permission(auth.uid(), 'notifications:write'));

DROP POLICY IF EXISTS "Admins can delete crawler portals" ON public.crawler_portals;
CREATE POLICY "Admins can delete crawler portals"
    ON public.crawler_portals
    FOR DELETE TO authenticated
    USING (public.has_permission(auth.uid(), 'notifications:write'));

-- 4.2 Idempotent RLS Policies for crawler_portal_url_history
DROP POLICY IF EXISTS "Public can view crawler portal url history" ON public.crawler_portal_url_history;
CREATE POLICY "Public can view crawler portal url history"
    ON public.crawler_portal_url_history
    FOR SELECT TO public
    USING (true);

DROP POLICY IF EXISTS "Admins can insert crawler portal url history" ON public.crawler_portal_url_history;
CREATE POLICY "Admins can insert crawler portal url history"
    ON public.crawler_portal_url_history
    FOR INSERT TO authenticated
    WITH CHECK (public.has_permission(auth.uid(), 'notifications:write'));

-- 5. Seed Initial Known Portals with Active Extraction URLs
INSERT INTO public.crawler_portals (portal_code, portal_name, official_website, current_target_url, wait_selector, notes)
VALUES
    (
        'UPSC',
        'Union Public Service Commission',
        'https://upsc.gov.in',
        'https://www.upsc.gov.in/examinations/active-exams',
        'table, .view-content, a[href$=".pdf"]',
        'Updated from active-examinations to active-exams per portal redirection.'
    ),
    (
        'KPSC',
        'Karnataka Public Service Commission',
        'https://kpsc.kar.nic.in',
        'https://kpsc.kar.nic.in/notification.html',
        'table, a[href$=".pdf"]',
        'Official recruitment circulars and gazetted probationers notifications.'
    ),
    (
        'SSC',
        'Staff Selection Commission',
        'https://ssc.gov.in',
        'https://ssc.gov.in/',
        'table, a[href$=".pdf"]',
        'Central CGL, CHSL, and MTS recruitment portal notices.'
    ),
    (
        'RRB',
        'Railway Recruitment Boards',
        'https://rrbcdg.gov.in',
        'https://rrbcdg.gov.in/',
        'table, a[href$=".pdf"]',
        'Indian Railways NTPC and Group D circular notices.'
    ),
    (
        'IBPS',
        'Institute of Banking Personnel Selection',
        'https://www.ibps.in',
        'https://www.ibps.in/',
        'table, a[href$=".pdf"]',
        'Public sector banking recruitments (PO, Clerk, SO).'
    )
ON CONFLICT (portal_code) DO UPDATE SET
    current_target_url = EXCLUDED.current_target_url,
    updated_at = NOW();
