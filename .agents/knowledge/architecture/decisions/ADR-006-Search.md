# ADR-006: Multi-Stage Search Engine Architecture

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
Candidate discovery is a primary feature of UPA-GURU. Candidates need to search notification titles, conducting bodies (e.g. KPSC, UPSC, SSC, RRB), qualification keywords (e.g. "Graduate", "BE Electrical"), and state names.

Search performance requirements:
- Search response latency $< 100\text{ms}$ on debounced inputs.
- Support for misspelled or partial keywords (fuzzy matching).
- Filtering by category (`exam_category_enum`), state (`state_or_central`), and active deadlines.

## Decision Outcome
Adopt a **Phased Search Architecture**:
- **Phase 1 (MVP & Launch)**: Native **PostgreSQL Full-Text Search (FTS)** using `tsvector`, `tsquery`, GIN indexes, and the `pg_trgm` (trigram) extension.
- **Phase 2 (Scale Phase)**: Dedicated search index offloading (**Typesense** or **Algolia**) when catalog size exceeds $100\text{k}$ items or query traffic requires advanced typo-tolerance rankings.

## Phase 1 PostgreSQL Search Implementation

```sql
-- Enable trigram extension for fuzzy title matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add generated tsvector column for notification search
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS fts_document tsvector 
GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(notification_number, ''))
) STORED;

-- GIN Index for sub-millisecond search execution
CREATE INDEX IF NOT EXISTS idx_notifications_fts ON public.notifications USING GIN(fts_document);
CREATE INDEX IF NOT EXISTS idx_notifications_title_trgm ON public.notifications USING GIN(title gin_trgm_ops);
```

### Search Query Flow
1. User types query into debounced search component.
2. Next.js Server Action / API Route sanitizes query via Zod.
3. Query executes against Supabase using `textSearch('fts_document', query)` or trigram similarity.
4. Results returned with pagination and state/category facet counts.

## Consequences

### Positive
- Zero added cost: PostgreSQL FTS runs directly within existing Supabase database.
- Low operational complexity: No separate search cluster synchronization or index re-indexing webhooks required for Phase 1.
- Sub-50ms execution speed for typical notification volume ($< 50\text{k}$ records).

### Negative
- PostgreSQL FTS has limited natural language typo tolerance compared to specialized search engines like Typesense or Algolia.

## Compliance & Guardrails
- Complies with `.agents/rules/AGENTS.md` Rule 1 (Zod input validation on search queries) and Rule 4 (Performance Lighthouse target).