-- ==============================================================================
-- UPA-GURU Database Migration: EPIC-04 AI Extraction Engine & Scraper Infrastructure
-- File: epic-04-scraper-schema-v1.sql
-- Associated Task: TASK-04010101
-- Description:
--   1. Creates `public.pdf_documents` for PDF file deduplication, storage, and text cache.
--   2. Creates `public.crawl_runs` for scraper run audit logs and telemetry.
--   3. Extends `public.draft_notifications` with 11 enrichment columns for AI pipelines.
--   4. Configures Row Level Security (RLS) policies for admin and service_role access.
--   5. Creates performance indexes.
-- ==============================================================================

-- 1. Create `pdf_documents` table
CREATE TABLE IF NOT EXISTS public.pdf_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sha256_hash TEXT NOT NULL UNIQUE,
    source_portal TEXT NOT NULL,
    source_url TEXT NOT NULL,
    file_name TEXT,
    file_size_bytes BIGINT,
    page_count INTEGER,
    storage_path TEXT,
    extracted_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create `crawl_runs` table
CREATE TABLE IF NOT EXISTS public.crawl_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    portal_code TEXT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    pdfs_found INTEGER NOT NULL DEFAULT 0,
    pdfs_new INTEGER NOT NULL DEFAULT 0,
    pdfs_failed INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    logs JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Extend `draft_notifications` with scraper & AI extraction enrichment columns
ALTER TABLE public.draft_notifications
    ADD COLUMN IF NOT EXISTS pdf_document_id UUID REFERENCES public.pdf_documents(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS run_id UUID REFERENCES public.crawl_runs(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS raw_text TEXT,
    ADD COLUMN IF NOT EXISTS parent_draft_id UUID REFERENCES public.draft_notifications(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_corrigendum BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS extraction_model TEXT,
    ADD COLUMN IF NOT EXISTS prompt_version TEXT,
    ADD COLUMN IF NOT EXISTS completeness_score NUMERIC(5, 4),
    ADD COLUMN IF NOT EXISTS validation_warnings JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS priority_review BOOLEAN NOT NULL DEFAULT FALSE;

-- 4. Enable Row Level Security (Mandatory per AGENTS.md Rule 3)
ALTER TABLE public.pdf_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crawl_runs ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies for pdf_documents
DROP POLICY IF EXISTS "Service role can manage all pdf_documents" ON public.pdf_documents;
CREATE POLICY "Service role can manage all pdf_documents"
    ON public.pdf_documents
    FOR ALL
    TO authenticated, service_role
    USING ((auth.jwt() ->> 'role' = 'service_role') OR (auth.jwt() ->> 'role' = 'admin'))
    WITH CHECK ((auth.jwt() ->> 'role' = 'service_role') OR (auth.jwt() ->> 'role' = 'admin'));

DROP POLICY IF EXISTS "Admins can read pdf_documents" ON public.pdf_documents;
CREATE POLICY "Admins can read pdf_documents"
    ON public.pdf_documents
    FOR SELECT
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 6. Create RLS Policies for crawl_runs
DROP POLICY IF EXISTS "Service role can manage all crawl_runs" ON public.crawl_runs;
CREATE POLICY "Service role can manage all crawl_runs"
    ON public.crawl_runs
    FOR ALL
    TO authenticated, service_role
    USING ((auth.jwt() ->> 'role' = 'service_role') OR (auth.jwt() ->> 'role' = 'admin'))
    WITH CHECK ((auth.jwt() ->> 'role' = 'service_role') OR (auth.jwt() ->> 'role' = 'admin'));

DROP POLICY IF EXISTS "Admins can read crawl_runs" ON public.crawl_runs;
CREATE POLICY "Admins can read crawl_runs"
    ON public.crawl_runs
    FOR SELECT
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

-- 7. Performance Indexes
CREATE INDEX IF NOT EXISTS idx_pdf_documents_sha256 ON public.pdf_documents(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_pdf_documents_portal ON public.pdf_documents(source_portal);
CREATE INDEX IF NOT EXISTS idx_crawl_runs_portal_started ON public.crawl_runs(portal_code, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_draft_notifications_priority ON public.draft_notifications(priority_review);
CREATE INDEX IF NOT EXISTS idx_draft_notifications_pdf_doc ON public.draft_notifications(pdf_document_id);
CREATE INDEX IF NOT EXISTS idx_draft_notifications_parent ON public.draft_notifications(parent_draft_id);
