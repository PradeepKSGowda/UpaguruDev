-- ==============================================================================
-- UPA-GURU Database Verification: Multi-Portal Crawlers (UPSC, SSC, RRB)
-- File: multi-portal-crawlers-verification-v1.sql
-- Associated Task: TASK-04010103
-- Description:
--   Verifies database readiness for UPSC, SSC, and RRB crawl runs and document storage.
-- ==============================================================================

-- 1. Verify existence of portal indexes
SELECT 
    schemaname, 
    tablename, 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename IN ('pdf_documents', 'crawl_runs')
  AND indexname IN ('idx_pdf_documents_portal', 'idx_crawl_runs_portal_started');

-- 2. Verify audit trail query by portal code
SELECT 
    portal_code, 
    status, 
    COUNT(*) as total_runs, 
    MAX(started_at) as last_run_at
FROM public.crawl_runs
GROUP BY portal_code, status;

-- 3. Verify document distribution across portals
SELECT 
    source_portal, 
    COUNT(*) as total_documents, 
    SUM(file_size_bytes) as total_bytes, 
    AVG(page_count) as avg_pages
FROM public.pdf_documents
GROUP BY source_portal;
