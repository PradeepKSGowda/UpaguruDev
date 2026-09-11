-- =============================================================================
-- Migration: Candidate Search & Filter Analytics Telemetry (v1.0.0)
-- Task Reference: TASK-02020103 (Subtasks: SUB-0202010301, SUB-0202010302)
-- Architecture Reference: ADR-002 (Database), ADR-013 (Security & RBAC)
-- Complies with: AGENTS.md Rule 3 (Mandatory Row Level Security)
-- =============================================================================

-- Ensure uuid extension exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Table: candidate_search_queries
-- Captures anonymous and candidate search keywords, category filters, and state
-- filters to identify high-volume aspirant demand patterns and zero-result queries.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_search_queries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    query_text TEXT,
    category_filter exam_category_enum,
    state_filter TEXT,
    sort_by TEXT,
    results_count INTEGER DEFAULT 0,
    client_ip_hash TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for aggregate trending keyword analysis
CREATE INDEX IF NOT EXISTS idx_search_queries_created 
    ON public.candidate_search_queries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_search_queries_category 
    ON public.candidate_search_queries (category_filter, created_at DESC) 
    WHERE category_filter IS NOT NULL;

-- Enable Mandatory Row Level Security (RLS)
ALTER TABLE public.candidate_search_queries ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. Explicit Row Level Security (RLS) Policies
-- -----------------------------------------------------------------------------

-- Policy: Anyone (authenticated or anonymous candidate) can log a search query event
CREATE POLICY "Public log search queries"
    ON public.candidate_search_queries
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Policy: Only Platform Administrators can analyze search queries
CREATE POLICY "Admins read search telemetry"
    ON public.candidate_search_queries
    FOR SELECT
    TO authenticated
    USING (
        (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'super_admin')
    );
