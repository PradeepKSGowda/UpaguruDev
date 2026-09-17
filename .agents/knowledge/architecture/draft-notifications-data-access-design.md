# Draft Notifications Data Access & Queue Architecture Design

## 1. Document Metadata
* **Document ID**: DESIGN-DRAFTS-DATA-001
* **Task Reference**: TASK-03020101 (Subtask: SUB-0302010101)
* **Epic Reference**: EPIC-03 (Admin HITL Verification Portal & Audit System)
* **Feature Reference**: FEAT-0302 (Draft HITL Review Dashboard & Approval Workflow)
* **User Story**: STORY-030201 (As an admin, I want to review AI-extracted draft notifications so I can verify accuracy before publishing)
* **Assigned Role**: Frontend Engineer
* **Architecture References**: ADR-001 (Frontend RSC), ADR-002 (Database), ADR-003 (RBAC), ADR-013 (Security)
* **Status**: APPROVED

---

## 2. Objective & System Architecture
The AI extraction engine continuously processes official PDF notifications and web announcements, populating the `public.draft_notifications` table with raw OCR text, structured JSON, and an extraction confidence score.

The `getDraftNotifications()` data access layer (`lib/data/drafts.ts`) bridges the database with the Administrative Human-In-The-Loop (HITL) review queue.

Key architectural responsibilities:
1. **Priority-First Queue Sorting**:
   - By default, sorts by `extraction_confidence_score ASC` (lowest confidence first). This surfaces ambiguous or edge-case extractions to human operators immediately, reducing downstream error propagation.
   - Secondary sorting options: `confidence_desc`, `newest` (`created_at DESC`), and `oldest` (`created_at ASC`).
2. **Flexible Lifecycle Filtering**:
   - Status filtering: `pending_review` (default operational queue), `approved`, `rejected`, or `all`.
   - Confidence threshold bounding: optional `minConfidence` and `maxConfidence` filters.
   - Text search on source URL and extracted title.
3. **Zod Input Validation (`lib/schemas/drafts.ts`)**:
   - Enforces type safety, integer coerce bounds, and pagination constraints (page $\ge 1$, pageSize $\le 50$) per `AGENTS.md` Rule 1.
4. **Strongly-Typed Domain Models (`types/drafts.ts`)**:
   - Decouples raw PostgreSQL schema rows from UI components, providing fully typed structures for `parsed_json` fields (title, conducting body, total vacancies, deadlines, syllabus, etc.).
5. **Single-Item Verification Fetcher (`getDraftNotificationById`)**:
   - Retrieves full raw extracted text alongside parsed JSON for the side-by-side verification screen (`app/admin/drafts/[id]/page.tsx`).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   React Server Component / Server Action                     │
│                  (Draft Queue Page / Verification Screen)                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                         Validated Parameters (Zod)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     lib/data/drafts.ts Data Access Layer                     │
│  - getDraftNotifications(params) -> PaginatedDrafts (Confidence ASC)        │
│  - getDraftNotificationById(id) -> DraftNotification | null                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                      Supabase Server Client (RSC Auth)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 PostgreSQL: public.draft_notifications                      │
│   - Compound Index: idx_drafts_status_confidence (status, score ASC)        │
│   - RLS Policy: Admins Only (SELECT, UPDATE, INSERT)                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Query Logic & Performance Specifications

### 3.1 Compound Queue Indexing
Queue operations routinely filter by `status = 'pending_review'` while ordering by `extraction_confidence_score ASC`. A composite index `(status, extraction_confidence_score ASC)` ensures index-only scans, maintaining $< 15\text{ms}$ query execution even with tens of thousands of scraped draft records.

### 3.2 Pagination & Count Strategy
Queries execute an exact count calculation:
```ts
supabase
  .from("draft_notifications")
  .select("*", { count: "exact" })
  .range(from, to);
```
Enables pagination controls (`page`, `pageSize`, `totalPages`, `hasMore`).

---

## 4. Security & Compliance Guardrails
1. **Server-Only Execution**: Runs within Server Components and Server Actions; never leaks service credentials to browser bundles.
2. **Row Level Security (RLS)**: Access restricted to authenticated users with role in `('admin', 'super_admin')`.
3. **Audit Readiness**: Prepares data models for subsequent approval (`publishNotificationAction`) and rejection (`rejectDraftAction`) audit logging.
4. **Execution Safety**: Complies with "Do not test. Do not deploy." during code generation.
