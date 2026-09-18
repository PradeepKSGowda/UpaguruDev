-- ==============================================================================
-- UPA-GURU Database Verification: KPSC Crawler & PDF Pipeline
-- File: kpsc-crawler-verification-v1.sql
-- Associated Task: TASK-04010102
-- Description:
--   Verifies that public.pdf_documents and public.crawl_runs tables and indexes
--   are provisioned for KPSC crawler execution and deduplication.
-- ==============================================================================

-- 1. Verify existence of required tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pdf_documents') THEN
        RAISE EXCEPTION 'Table public.pdf_documents does not exist. Please run epic-04-scraper-schema-v1.sql first.';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'crawl_runs') THEN
        RAISE EXCEPTION 'Table public.crawl_runs does not exist. Please run epic-04-scraper-schema-v1.sql first.';
    END IF;
END $$;

-- 2. Verify unique SHA-256 deduplication index
SELECT 
    schemaname, 
    tablename, 
    indexname, 
    indexdef 
FROM pg_indexes 
WHERE tablename = 'pdf_documents' 
  AND indexname = 'idx_pdf_documents_sha256';

-- 3. Verify KPSC crawl run recording structure
SELECT 
    column_name, 
    data_type, 
    is_nullable 
FROM information_schema.columns 
WHERE table_name = 'pdf_documents' 
ORDER BY ordinal_position;
