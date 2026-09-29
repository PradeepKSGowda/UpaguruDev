# Multi-Exam Recruitment Intelligence & Document Lifecycle Linking Engine Specification

## Executive Summary

The **Multi-Exam Recruitment Intelligence & Document Lifecycle Linking Engine** upgrades **UPA-GURU** from the flat assumption (`1 Crawled PDF == 1 Notification == 1 Exam Record`) to an **evolving, state-driven lifecycle graph** anchored to canonical **`Exam Cycle`** entities.

In government recruitment across India (UPSC, KPSC, SSC, RRB, IBPS), a single examination unfolds over 6 to 24+ months, generating dozens of official documents (Annual Calendars, Advertisements, Corrigenda, Time-Tables, Rescheduling Notices, Admit Cards, Answer Keys, Provisional Results, DAF Notices, Interviews, Final Merit Lists).

This engine ingests every official PDF or HTML notice as an **independent, immutable source evidence document** with verbatim page provenance, linking facts and dates across time without destroying historical records.

---

## 1. Domain & Entity-Lifecycle Model (14 Entities)

```text
Organizations (UPSC, KPSC, SSC, RRB, IBPS, RBI...)
      │
      ▼
Exam Master (Persistent Canonical Series: UPSC_CSE, SSC_CGL, RRB_NTPC, IBPS_PO)
      │
      ▼
Exam Cycle (Specific Iteration/Year: UPSC_CSE_2026, CEN 01/2026)
      │
      ├──► Recruitment (Opportunity / Post / Cadre / Zonal Layer)
      │
      ├──► Exam Documents (Immutable source PDFs / HTML pages with SHA-256 binary & content hashes)
      │          │
      │          ├──► Document-to-Cycle Many-to-Many Join (`document_exam_cycle`)
      │          │
      │          └──► Directed Document Relationships (`exam_document_relationship`)
      │               (CORRIGENDUM_OF, EXTENSION_OF, DATE_CHANGE_OF, RESULT_FOR...)
      │
      ├──► Normalized Exam Events (`exam_event`)
      │          └──► Revision Chains (`is_current`, `version_number`, `supersedes_event_id`)
      │
      ├──► Versioned Cycle Attributes (`cycle_field_version`)
      │          └──► Vacancy updates, eligibility revisions, fee amendments
      │
      ├──► Granular Document Evidence (`document_evidence`)
      │          └──► Verbatim snippet, page number, section, extraction method, confidence
      │
      ├──► Human Review Queue (`review_queue_item`)
      │          └──► Confidence-gated review gate (confidence < 85%)
      │
      ├──► Forensic Audit Log (`audit_log` / `audit_logs`)
      │
      ├──► Operations (`crawler_run`, `crawler_error`)
      │
      └──► Alerts Outbox (`cycle_domain_event`)
```

---

## 2. Multi-Signal Cycle Matching & Confidence Engine

Every discovered document is evaluated against candidate active cycles using an additive, penalized scoring function:

| Signal Category | Signal Condition | Weight |
|:---|:---|:---|
| **Very Strong** | Exact normalized `reference_number` / `CEN` / `CRP` match | `+100` |
| **Very Strong** | Explicit citation (`"in continuation of notice..."`) matching target document | `+95` |
| **Very Strong** | Exact canonical `exam_master` + explicit `cycle_year` in header | `+90` |
| **Strong** | Exact canonical `exam_master` + inferred year from milestone dates | `+80` |
| **Strong** | Exact alias match + explicit `cycle_year` | `+75` |
| **Medium** | Compatible stage progression (e.g. Mains follows Prelims) | `+20` |
| **Medium** | High title similarity within same organization | `+15` |
| **Weak** | Temporal proximity to expected cycle window | `+5` |
| **Penalty** | Conflicting explicit reference number belonging to different cycle | `-100` |
| **Penalty** | Conflicting explicit cycle year (e.g. 2025 vs 2026) | `-90` |
| **Penalty** | Stage regression without corrigendum/revision keywords | `-25` |

### Threshold Routing Rules:
- **`score >= 85.0` (`AUTO_LINK`):** Automatically links document to cycle and marks events `AUTO_VERIFIED`.
- **`70.0 <= score < 85.0` (`REVIEW_RECOMMENDED`):** Enqueues item into `review_queue_item` (`status = PENDING`) with top 3 candidate cycles.
- **`score < 70.0` (`DO_NOT_LINK`):** Ambiguous exam/cycle routed to admin review queue for triage.

---

## 3. Non-Destructive Event & Field Supersession

When an authority publishes a corrigendum, rescheduling notice, or application extension:

```text
[Notice 01: Initial Notification]
└── Prelims Exam: 24.05.2026 (v1, is_current = True, status = SCHEDULED)
         │
         ▼ (rescheduled via Notice 05)
[Notice 05: Rescheduling Notice]
├── Prelims Exam: 24.05.2026 (v1, is_current = False, status = SUPERSEDED)
└── Prelims Exam: 14.06.2026 (v2, is_current = True, status = SCHEDULED, supersedes_event_id = v1.id)
```

1. **Idempotency Guard:** If the parsed date is identical to the existing current version (`active_dt == new_dt`), no duplicate version is created.
2. **Supersession Transaction:**
   - Old event updated: `is_current = false`, `status = 'SUPERSEDED'`.
   - New event inserted: `is_current = true`, `version_number = old.version_number + 1`, `supersedes_event_id = old.id`.
   - Directed relationship created: `exam_document_relationship` (`DATE_CHANGE_OF` or `CORRIGENDUM_OF`).
   - Verbatim evidence attached: `document_evidence` preserves exact text snippet from the new notice.

---

## 4. 4-Layer Document Deduplication

1. **Layer 1 (Canonical URL):** Strips tracking parameters (`utm_*`, `fbclid`, `gclid`), normalizes slashes and case, while preserving CMS identifiers (`?id=`, `?file=`, `?notice=`).
2. **Layer 2 (Binary Hash):** SHA-256 of raw downloaded file bytes.
3. **Layer 3 (Content Hash):** SHA-256 of whitespace-normalized, lowercase extracted text.
4. **Layer 4 (Identity Key):** `(organization_id, normalized_reference_number, document_type, publication_date)`.

---

## 5. Candidate Timeline REST API (`/api/v1/exams/[code]/timeline`)

Exposes a pre-assembled timeline read model:
- `exam`: Master code, name, category, organization.
- `cycle`: Status, current stage, vacancies, reference number.
- `latest_update`: Highest-priority verified update based on publication date.
- `important_dates`: Key milestones (application open/close, prelims, mains, admit card, result).
- `events`: Versioned events with `previous_versions` revision chain and source document link.
- `documents`: All attached notices with directed relationship types.
- `recruitments`: Breakdown of posts, cadres, and vacancies.

---

## 6. Admin Review Queue Governance

- Route: `/admin/review-queue`
- Server Actions: `app/admin/review-queue/actions.ts`
- Supported Triage Actions:
  - `Approve`: Verifies document-to-cycle link and publishes proposed events.
  - `Reject`: Rejects ambiguous link and archives item.
  - `Reassign Cycle`: Reassigns document to a specific target cycle ID.
  - `Merge Cycles`: Merges two redundant cycles into a single canonical target cycle.
- **Audit Logging:** Every administrative action writes an immutable record to `public.audit_logs`.
