-- =============================================================================
-- Knowledge Database Reference: crawler-portals-schema-v1.sql
-- Description: DDL definitions for dynamic crawler portals and URL history audit.
-- Architecture Reference: ADR-002 (Database Schema), ADR-003 (RBAC)
-- =============================================================================

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

CREATE INDEX IF NOT EXISTS idx_crawler_portals_code
    ON public.crawler_portals(portal_code);

CREATE INDEX IF NOT EXISTS idx_crawler_portal_history_code
    ON public.crawler_portal_url_history(portal_code, created_at DESC);

ALTER TABLE public.crawler_portals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawler_portal_url_history ENABLE ROW LEVEL SECURITY;

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
