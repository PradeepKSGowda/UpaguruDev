-- =============================================================================
-- Migration / Audit Script: Security Headers & CSP Violation Logging
-- File: security-headers-audit-v1.sql
-- Task Reference: TASK-01030103
-- Architecture Reference: ADR-013 (Application Security & Data Protection)
-- =============================================================================

-- Table: public.csp_violation_reports
-- Captures browser-reported Content-Security-Policy violations to detect active XSS attempts
CREATE TABLE IF NOT EXISTS public.csp_violation_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_uri TEXT NOT NULL,
    referrer TEXT,
    blocked_uri TEXT,
    violated_directive TEXT NOT NULL,
    effective_directive TEXT,
    original_policy TEXT,
    disposition TEXT DEFAULT 'enforce',
    user_agent TEXT,
    client_ip INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.csp_violation_reports ENABLE ROW LEVEL SECURITY;

-- Policy: Admin read-only access to CSP violation logs
CREATE POLICY "Admins have read access to csp violation logs"
    ON public.csp_violation_reports
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );

-- Policy: Allow anonymous / public INSERT of CSP reports via API route
CREATE POLICY "Allow anonymous insertion of csp violation reports"
    ON public.csp_violation_reports
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_csp_reports_directive_created
    ON public.csp_violation_reports(effective_directive, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_csp_reports_blocked_uri
    ON public.csp_violation_reports(blocked_uri);

-- Comment on table
COMMENT ON TABLE public.csp_violation_reports IS 
'Audit log of browser Content Security Policy violations, providing real-time telemetry on XSS injection attempts and untrusted script sources.';
