# Draft Queue Page & Review Cards Architecture Design

## 1. Document Metadata
* **Document ID**: DESIGN-DRAFT-QUEUE-001
* **Task Reference**: TASK-03020102 (Subtasks: SUB-0302010201, SUB-0302010202)
* **Epic Reference**: EPIC-03 (Admin HITL Verification Portal & Audit System)
* **Feature Reference**: FEAT-0302 (Draft HITL Review Dashboard & Approval Workflow)
* **User Story**: STORY-030201 (As an admin, I want to review AI-extracted draft notifications so I can verify accuracy before publishing)
* **Assigned Role**: Frontend Engineer
* **Architecture References**: ADR-001 (Frontend RSC), ADR-002 (Database), ADR-003 (RBAC), ADR-013 (Security)
* **Status**: APPROVED

---

## 2. Objective & System Architecture
The Draft Review Queue (`app/admin/drafts/page.tsx`) serves as the primary verification workbench for human operators. It displays AI-extracted notification drafts discovered by automated web scrapers, highlighting extraction confidence scores, conducting bodies, and parsed metadata.

Key architectural responsibilities:
1. **Confidence Threshold Visualization (`DraftCard.tsx`)**:
   - $\ge 0.90$ (High Confidence): Green pill badge (`High Accuracy`).
   - $\ge 0.85$ to $< 0.90$ (Moderate Confidence): Amber pill badge (`Review Suggested`).
   - $< 0.85$ (Low Confidence): Red warning badge with `AlertTriangle` icon (`Action Required`), immediately signaling high probability of OCR errors, missing fields, or complex PDF formatting.
2. **Interactive Queue Filtering (`DraftQueueFilterBar.tsx`)**:
   - Status tabs: `Pending Review` (default queue), `Approved`, `Rejected`, `All`.
   - Priority Sorting: `Lowest Confidence First` (`confidence_asc`), `Highest Confidence First` (`confidence_desc`), `Newest First` (`newest`), `Oldest First` (`oldest`).
   - Text search on source URLs and extracted exam titles with URL parameter synchronization.
3. **Queue Page Assembly (`app/admin/drafts/page.tsx`)**:
   - Next.js 15 React Server Component (RSC) resolving asynchronous `await searchParams`.
   - Renders paginated list of `DraftCard`s with total count indicator.
   - Comprehensive zero-data empty states tailored to active filters.
   - Pagination controls (`Previous`, page indicators, `Next`).
4. **Automated Testing Landmarks**: Deterministic HTML `id` attributes compliant with Playwright test automation standards (`draft-queue-page`, `draft-queue-list`, `draft-card-${id}`, `draft-verify-btn-${id}`).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Draft Review Queue (app/admin/drafts/page.tsx)            │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │  Breadcrumb: Admin Dashboard > Draft Review Queue                       │ │
│ │  Header: Draft Queue [Count Badge: 14 Pending]                          │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │  DraftQueueFilterBar (Client Component)                                 │ │
│ │  [Status Tabs: Pending Review | Approved | Rejected | All]              │ │
│ │  [Search Source URL / Title...] [Sort: Lowest Confidence First ▾]       │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │  DraftCards List: <div id="draft-queue-list">                           │ │
│ │                                                                         │ │
│ │  ┌───────────────────────────────────────────────────────────────────┐ │ │
│ │  │ DraftCard (ID: draft-1) [Amber Badge: 86% Confidence]             │ │ │
│ │  │ UPSC Civil Services 2026 Examination (Prelims)                    │ │ │
│ │  │ Source: upsc.gov.in/notifications/exam-2026.pdf                   │ │ │
│ │  │ Vacancies: 1,056 | Deadline: 28 Feb 2026                          │ │ │
│ │  │                                             [Verify & Review ➔]   │ │ │
│ │  └───────────────────────────────────────────────────────────────────┘ │ │
│ │                                                                         │ │
│ │  ┌───────────────────────────────────────────────────────────────────┐ │ │
│ │  │ DraftCard (ID: draft-2) [Red Alert: 74% Low Confidence ⚠️]        │ │ │
│ │  │ SSC CGL 2026 Tier-I Notification                                  │ │ │
│ │  │ Source: ssc.nic.in/notices/cgl2026.pdf                            │ │ │
│ │  │                                             [Verify & Review ➔]   │ │ │
│ │  └───────────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │  Pagination Controls: [Previous] Page 1 of 3 [Next]                     │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown & Specifications

### 3.1 `DraftCard.tsx` (`components/admin/DraftCard.tsx`)
* **Confidence Badge Thresholds**:
  | Score Range | Tier | Badge Color | Icon |
  | :--- | :--- | :--- | :--- |
  | $\ge 0.90$ | High | Emerald / Green | `CheckCircle2` |
  | $0.85 - 0.89$ | Moderate | Amber / Yellow | `AlertCircle` |
  | $< 0.85$ | Low | Red | `AlertTriangle` |
* **Extracted Field Previews**: Displays title, conducting body, application deadline, and total vacancies from `draft.parsedJson`.
* **Action CTA**: Direct link to `/admin/drafts/[id]` verification route.

### 3.2 `DraftQueueFilterBar.tsx` (`components/admin/DraftQueueFilterBar.tsx`)
* **Client State**: Manages search query debouncing, tab switches, and sort selections via `useRouter()` and `usePathname()`.
* **Accessibility**: Implements tablist pattern (`role="tablist"`, `aria-selected`).

---

## 4. Security & Compliance Guardrails
1. **Server-Side Access Control**: Protected by `app/admin/layout.tsx` server verification.
2. **Mandatory Row Level Security (RLS)**: Enforced via PostgreSQL policies on `draft_notifications` and `draft_queue_audit_logs`.
3. **Execution Safety**: Complies with "Do not test. Do not deploy." during code generation.
