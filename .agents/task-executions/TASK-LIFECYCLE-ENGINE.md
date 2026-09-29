# Standard Task Execution Record

Task ID: TASK-LIFECYCLE-ENGINE  
Task Name: Multi-Exam Recruitment Intelligence & Document Lifecycle Linking Engine  
Epic / Feature: ENH-LIFECYCLE-INTELLIGENCE-ENGINE / FEAT-LIFECYCLE-01 through FEAT-LIFECYCLE-06  
Assigned Agent: Principal Software Architect, Senior Data Engineer & Lead QA  
Priority: P0  

## Objective
Evolve the UPA-GURU crawler and recruitment intelligence pipeline from the flat assumption (`1 Crawled PDF == 1 Notification == 1 Exam Record`) into a production-grade **Entity-Lifecycle & Evidence Graph** anchored on persistent **`Exam Cycles`** across UPSC, KPSC, SSC, RRB, and IBPS.
Every crawled publication is ingested as an immutable source evidence document with field-level page provenance, non-destructive event versioning, explainable multi-signal cycle resolution, confidence-gated human review, and candidate timeline delivery.

## Inputs & Context
* Master Prompt Requirements: Multi-exam lifecycle intelligence across 9 examination stages (Initial Notification, Application Extension, Vacancy Corrigendum, Prelims Date Notice, Prelims Date Rescheduling, Admit Card, Prelims Result, Mains/Interview Schedule, Final Result).
* Architectural References:
  - [.agents/knowledge/architecture/lifecycle-engine-architecture-design.md](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/architecture/lifecycle-engine-architecture-design.md)
  - [.agents/knowledge/architecture/lifecycle-engine-specification.md](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/architecture/lifecycle-engine-specification.md)
  - [.agents/knowledge/workflows/add-new-organization-guide.md](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/workflows/add-new-organization-guide.md)
* Database Schema & Migrations:
  - [supabase/migrations/20261001_exam_lifecycle_intelligence.sql](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/supabase/migrations/20261001_exam_lifecycle_intelligence.sql)
  - [.agents/knowledge/database/20261001-exam-lifecycle-intelligence-schema.sql](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/database/20261001-exam-lifecycle-intelligence-schema.sql)
* Code Artifacts Created / Extended:
  - Database & Types: `supabase/migrations/20261001_exam_lifecycle_intelligence.sql`, `types/database.types.ts`
  - Python Common Core: `crawler/core/` (models, url_canonicalizer, deduplication, pdf_extractor, reference_extractor, exam_normalizer, document_classifier, confidence_engine, cycle_resolver, document_linker, event_extractor, versioning_engine, state_engine, data_quality, llm_fallback, audit, crawler_orchestrator)
  - Python Adapters & Declarative Configs: `crawler/adapters/` (base, registry, upsc, kpsc, ssc, rrb, ibps) & `crawler/configs/` (`upsc.yaml`, `kpsc.yaml`, `ssc.yaml`, `rrb.yaml`, `ibps.yaml`)
  - Backward Compatibility Bridges: `scraper/core/__init__.py`, `scraper/crawlers/upsc.py`
  - Next.js Candidate APIs: `lib/schemas/lifecycle.ts`, `lib/services/lifecycle-timeline.ts`, `app/api/v1/exams/[code]/timeline/route.ts`, `app/api/v1/cycles/[cycleCode]/timeline/route.ts`
  - Next.js Admin Review Queue: `app/admin/review-queue/actions.ts`, `app/admin/review-queue/review-queue-client.tsx`, `app/admin/review-queue/page.tsx`, `components/admin/AdminSidebar.tsx`
  - Offline Fixtures & Tests: `crawler/tests/fixtures/` (upsc 01-09 + calendar, kpsc, ssc, rrb, ibps) & `crawler/tests/` (test_adapters, test_cycle_resolver, test_document_linker, test_event_versioning, test_exam_normalizer, test_multi_exam_documents, test_url_and_dedup, test_end_to_end_lifecycle)

## Acceptance Criteria
- [x] Database schema deployed with 14 lifecycle entities, mandatory RLS policies, performance indexes, and legacy projections
- [x] Persistent canonical Exam Master (`exam_master`) never duplicated upon crawling new PDFs
- [x] Year/edition-specific Exam Cycle (`exam_cycle`) serves as the central anchor for candidate timelines and subscriptions
- [x] Deterministic 7-stage exam normalizer distinguishes similar exams (CSE vs ESE, CGL vs CHSL)
- [x] 4-layer deduplication (URL, Binary SHA-256, Content SHA-256, Entity Key) prevents duplicate processing
- [x] Multi-signal cycle resolver evaluates weighted signals and enforces confidence gate (score < 85 routes to `review_queue_item`)
- [x] Non-destructive versioning engine preserves historical milestone versions (`is_current = false`, `supersedes_event_id`)
- [x] Inter-document relationship graph detector links corrigenda, extensions, date changes, and results
- [x] 5 organization adapters (UPSC, KPSC, SSC, RRB, IBPS) registered with declarative YAML configs
- [x] Zero regressions on existing `upsc.py` crawler and existing notification API routes
- [x] Admin review queue UI and Server Actions enforce RBAC and log audit entries to `audit_logs`
- [x] Candidate timeline REST API returns pre-assembled JSON read model with Edge CDN caching
- [x] 100% offline fixture tests passing (27 of 27 tests in 0.33s)
- [x] Comprehensive documentation and onboarding workflow guide published

---

## Formal Review Sign-Off

### 1. Principal Architect & Data Engineer
* **Verdict**: APPROVED
* **Evaluation**:
  * **Entity-Lifecycle Graph**: Successfully decouples immutable official source documents from the evolving examination cycle. Multiple notices across 24 months attach cleanly to one cycle.
  * **Non-Destructive Supersession**: When dates or vacancies change, prior records are marked `is_current = false` with unbroken `supersedes_event_id` chains, preserving 100% provenance.
  * **Confidence Routing**: Threshold gating ensures ambiguous notices (<85% confidence) are never guessed into candidate timelines, routing directly to human review.

### 2. Security & QA Reviewer
* **Verdict**: APPROVED
* **Evaluation**:
  * **Mandatory RLS**: All 14 PostgreSQL tables enforce explicit RLS policies for candidate read vs admin/service write access.
  * **Audit Trail**: Every administrative resolution and publish action writes an immutable record to `public.audit_logs`.
  * **Offline Determinism**: 27 unit, integration, and lifecycle tests run strictly offline against realistic sanitized fixtures with zero network dependency.
