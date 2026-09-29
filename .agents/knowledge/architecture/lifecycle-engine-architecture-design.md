# Architecture Design & Gap Assessment: Exam Document Lifecycle & Intelligence Engine

**Document ID:** ADR-015 / ARCH-LIFECYCLE-01  
**Status:** Approved & Implemented  
**Date:** 2026-09-29  
**System:** UPA-GURU Recruitment Intelligence Platform  
**Target Entities:** Multi-Organization Examination Lifecycle, Document Ingestion, Non-Destructive Versioning, Provenance & Candidate Timeline

---

## 1. Executive Summary & Problem Context

The foundational architecture of the initial recruitment crawler operated under an oversimplified assumption:
$$\text{1 Crawled PDF / URL} \iff \text{1 Notification Record} \iff \text{1 Exam Record}$$

In Indian public sector recruitment (UPSC, KPSC, SSC, RRB, IBPS, State PSCs), an examination is not a single point-in-time publication. An examination cycle unfolds over **6 to 24+ months** across **dozens of distinct official documents**:
1. Annual Examination Calendars (1 PDF covering 15+ exams)
2. Detailed Advertisements / Initial Notifications
3. Application Deadline Extensions
4. Corrigenda / Addenda (revising vacancies, age criteria, syllabus, exam centers)
5. Exam Date Announcements & Rescheduling Notices
6. Admit Card / Hall Ticket Release Notices
7. Provisional Answer Keys & Objection Windows
8. Final Answer Keys
9. Preliminary / Tier-1 / CBT-1 Results & Merit Lists
10. Detailed Application Form (DAF) / Preference Windows
11. Mains / Tier-2 / Skill Test / Interview Schedules
12. Final Results, Reserve Lists & Replacement Panels

Treating each PDF as a monolithic notification resulted in:
* **Overwritten History:** Updating an exam date or vacancy count erased the original timeline, destroying official auditability.
* **Fragmented Records:** Follow-up notices (corrigenda, admit card notices) created duplicate disconnected notifications or orphaned records.
* **Missing Provenance:** Candidate-facing facts could not be traced back to the exact PDF page, paragraph, and verbatim citation.
* **Rigid Monolithic Crawlers:** Crawlers lacked a unified abstraction for multi-organization reference numbers, multi-exam PDF splitting, and stage progressions.

---

## 2. Target Architecture: Entity-Lifecycle & Evidence Graph

We transition to a layered Entity-Lifecycle and Evidence Graph:

```
Organization (e.g. UPSC, KPSC, SSC, RRB, IBPS)
      │
      ▼
Exam Master (Canonical Series across years, e.g. "UPSC Civil Services Examination")
      │
      ▼
Exam Cycle (Specific Edition, e.g. "UPSC CSE 2026", "CEN 01/2026")
      │
      ├──► Recruitment / Post / Cadre Layer (IAS/IPS, Group B/C, RPC vs HK)
      │
      ├──► Exam Documents (Immutable source PDFs/HTMLs, binary & content hashed)
      │          │
      │          └──► Document Relationships (CORRIGENDUM_OF, EXTENSION_OF, RESULT_FOR...)
      │
      ├──► Normalized Exam Events (Versioned milestones: is_current, supersedes_event_id)
      │
      ├──► Versioned Cycle Attributes (Vacancies, fees, age limits with revision history)
      │
      ├──► Granular Document Evidence (Page, section, verbatim text, confidence, extractor)
      │
      ▼
Human Verification & Audit Layer (Review Queue + Audit Logs)
      │
      ▼
Candidate Read Model / Timeline API + Domain Events Outbox
```

---

## 3. Core Entities & Schema Specifications

### 3.1 `organizations`
Canonical recruiting commission, board, or examination authority.
- `id` (UUID PK), `code` (Unique, e.g. `UPSC`, `KPSC`, `SSC`, `RRB`, `IBPS`), `name`, `short_name`, `organization_type`, `official_website`, `country`, `state`, `config_json`, `active`.

### 3.2 `exam_master`
Canonical examination definition persisting across years.
- `id` (UUID PK), `organization_id` (FK), `exam_code` (Unique, e.g. `UPSC_CSE`, `SSC_CGL`), `name`, `normalized_name`, `short_name`, `category`, `aliases` (JSONB / array), `typical_stages` (JSONB).

### 3.3 `exam_cycle`
Specific edition or advertisement iteration of an `exam_master`.
- `id` (UUID PK), `exam_master_id` (FK), `cycle_year` (INTEGER), `cycle_code` (e.g. `UPSC_CSE_2026`), `cycle_label`, `primary_reference_no`, `status`, `current_stage`, `total_vacancies_current`, `latest_update_summary`, `latest_update_at`, `latest_document_id`, `verification_status`.
- Unique constraint: `(exam_master_id, cycle_code)`.

### 3.4 `recruitment` (Post / Cadre Layer)
Services, posts, regional or zonal cadres grouped under an exam cycle.
- `id` (UUID PK), `exam_cycle_id` (FK), `post_code`, `title`, `normalized_title`, `department_or_cadre`, `vacancies_current`, `pay_level`, `eligibility_json`, `status`.

### 3.5 `exam_document`
Immutable discovered source document (PDF or official HTML notice).
- `id` (UUID PK), `organization_id` (FK), `exam_master_id` (FK, nullable), `exam_cycle_id` (FK, nullable), `document_type`, `document_subtype`, `title`, `normalized_title`, `source_url`, `canonical_url`, `file_url`, `mime_type`, `file_size_bytes`, `document_hash` (SHA-256 binary), `content_hash` (SHA-256 extracted text), `reference_type`, `reference_number`, `normalized_reference_number`, `publication_date`, `text_content`, `is_multi_exam`, `status`, `link_confidence`, `verification_status`.

### 3.6 `document_exam_cycle` (M:N Join)
Enables multi-exam documents (e.g. Annual Calendars, joint schedules) to link to multiple cycles.
- `id` (UUID PK), `document_id` (FK), `exam_cycle_id` (FK), `relationship_role`, `confidence`, `link_reasons_json`, `decision`, `verified`.

### 3.7 `exam_event` (Normalized & Versioned Milestones)
Stores all dates/milestones independently with non-destructive supersession.
- `id` (UUID PK), `exam_cycle_id` (FK), `source_document_id` (FK), `event_type`, `stage`, `event_name`, `start_datetime`, `end_datetime`, `is_date_tbd`, `date_precision`, `date_text_original`, `status`, `confidence`, `verification_status`, `is_current` (BOOLEAN), `version_number` (INTEGER), `supersedes_event_id` (Self FK), `change_reason`.

### 3.8 `exam_document_relationship` (Document Graph)
Directed relationship edges between documents.
- `id` (UUID PK), `source_document_id` (FK), `target_document_id` (FK), `relationship_type` (`CORRIGENDUM_OF`, `EXTENSION_OF`, `DATE_CHANGE_OF`, `RESULT_FOR`, etc.), `confidence`, `reason`, `signals_json`, `automated`, `verification_status`.

### 3.9 `document_evidence` & `cycle_field_version`
Granular field-level provenance and non-event attribute revisions (vacancies, fees, age cutoffs).
- `document_evidence`: `document_id`, `field_name`, `field_value_json`, `page_number`, `section`, `source_text`, `extraction_method` (`RULE`, `REGEX`, `TABLE_PARSER`, `LLM`, `MANUAL`), `confidence`.
- `cycle_field_version`: `exam_cycle_id`, `field_name`, `old_value_json`, `new_value_json`, `change_summary`, `source_document_id`, `evidence_id`, `is_current`, `supersedes_version_id`.

### 3.10 `review_queue_item` & `audit_log`
HITL governance and complete audit trail for low/medium-confidence links and conflicting events.
- `review_queue_item`: `item_type`, `priority`, `document_id`, `proposed_exam_master_id`, `proposed_exam_cycle_id`, `candidate_matches_json`, `confidence`, `reasons_json`, `status`, `resolution_action`.
- `audit_log`: `actor_type`, `actor_id`, `action`, `entity_type`, `entity_id`, `before_json`, `after_json`, `reasons_json`.

### 3.11 `crawler_run`, `crawler_error`, `cycle_domain_event`
Operational monitoring and alerts outbox.

---

## 4. Multi-Signal Cycle Resolution & Confidence Scoring

The Cycle Resolver calculates explainable composite confidence scores:

| Signal | Score Delta | Notes |
|:---|:---|:---|
| Exact Reference Number Match | `+100` | Normalized CEN, CRP, Advt No., or Notification No. |
| Explicit Text Citation | `+95` | "in continuation of Notification No..." |
| Exact Exam Master + Explicit Year | `+90` | Exact canonical code + cycle year in header |
| Inferred Exam + Context Year | `+80` | Alias match + contextual dates |
| Stage Progression Compatibility | `+20` | Follows logical progression (Prelims → Mains) |
| Discriminative Keyword Match | `+15` | Civil vs Engineering vs Medical |
| Conflicting Reference Number | `-100` | Refers to different known cycle |
| Conflicting Year | `-90` | E.g. 2025 notice while matching 2026 cycle |
| Incompatible Stage Regression | `-25` | Result before Prelims without Corrigendum |

### Decision Gate:
* **Score $\ge$ 85 (`AUTO_LINK`):** Automatically attach to cycle or create new cycle if initial notification.
* **70 $\le$ Score $<$ 85 (`REVIEW_RECOMMENDED`):** Attach with `verification_status = 'REVIEW_REQUIRED'`, create `review_queue_item`.
* **Score $<$ 70 (`DO_NOT_LINK`):** Do not link; route to review queue for human triage.

---

## 5. Non-Destructive Event Versioning Rules

When a date change or corrigendum occurs:
1. Prior row updated: `is_current = false`, `status = 'SUPERSEDED'`.
2. New row inserted: `is_current = true`, `version_number = prior.version_number + 1`, `supersedes_event_id = prior.id`.
3. Edge created: `exam_document_relationship` (`DATE_CHANGE_OF` or `CORRIGENDUM_OF`).
4. Provenance saved: `document_evidence` rows retained for both versions.
5. Partial update guarantee: Omitted fields in later notices are never treated as nulls or deletions.
