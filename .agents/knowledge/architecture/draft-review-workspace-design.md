# Side-by-Side Draft Review Workspace Architecture Design

## 1. Document Metadata
* **Document ID**: DESIGN-DRAFT-REVIEW-001
* **Task Reference**: TASK-03020103 (Subtasks: SUB-0302010301, SUB-0302010302, SUB-0302010303)
* **Epic Reference**: EPIC-03 (Admin HITL Verification Portal & Audit System)
* **Feature Reference**: FEAT-0302 (Draft HITL Review Dashboard & Approval Workflow)
* **User Story**: STORY-030201 (As an admin, I want to review AI-extracted draft notifications so I can verify accuracy before publishing)
* **Assigned Role**: Frontend Engineer
* **Architecture References**: ADR-001 (Frontend RSC & Server Actions), ADR-002 (Database), ADR-003 (RBAC), ADR-013 (Security)
* **Status**: APPROVED

---

## 2. Objective & System Architecture
The Side-by-Side Draft Review Workspace (`app/admin/drafts/[id]/page.tsx`) provides administrative operators with an ergonomic comparison environment to verify AI-extracted notifications against the raw OCR / text source discovered from government PDFs and websites.

Key architectural responsibilities:
1. **Side-by-Side Ergonomic Layout**:
   - **Left Panel (`RawTextPanel.tsx`)**: Displays full `raw_extracted_text` in a scrollable, high-contrast monospace container with client-side text searching, character/word counters, and one-click copy to clipboard.
   - **Right Panel (`ParsedFieldsForm.tsx`)**: Pre-populates all structured fields extracted by the AI engine (`title`, `conducting_body`, `category`, `vacancies`, `deadlines`, `age_limits`, `qualifications`, `application_urls`) into an editable form with inline Zod validation.
2. **Human-In-The-Loop (HITL) Verification Controls**:
   - **Approve / Update Action**: Operators modify any incorrect or missing fields (e.g. notification title) and submit. For pending drafts, it publishes a new notification. For already-approved drafts, it performs an idempotent update on both `draft_notifications` and the published `notifications` record, records a `NOTIFICATION_UPDATED` audit entry in `public.audit_logs`, and preserves operator context with feedback. Includes a one-click "Decode & Clean Title" helper for raw URL-encoded filenames.
   - **Reject Action**: Requires an explicit reason string ($\ge 10$ characters) via an interactive modal before executing `rejectDraftAction`, marking status as `rejected` and logging the audit event.
3. **Server Actions Contract (`app/admin/drafts/actions.ts`)**:
   - Executes with cryptographic session validation via `createServerClient()`.
   - Adheres to `AGENTS.md` Rule 3: every verification and approval action writes to `public.audit_logs`.
   - Triggers Next.js cache revalidation via `revalidatePath("/admin/drafts")`.
4. **Automated Testing Landmarks**: Comprehensive Playwright IDs: `draft-review-page`, `raw-text-panel`, `raw-text-search-input`, `parsed-fields-form`, `draft-approve-btn`, `draft-reject-btn`, `rejection-reason-modal`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Draft Review Workspace (app/admin/drafts/[id])              │
├─────────────────────────────────────────────────────────────────────────────┤
│  Breadcrumb: Dashboard > Draft Queue > Review Draft (ID: a4b1c2...)         │
│  [Source Document ↗] [Confidence Score: 87%] [Back to Queue]               │
├──────────────────────────────────────┬──────────────────────────────────────┤
│  LEFT PANEL: RawTextPanel (Client)   │  RIGHT PANEL: ParsedFieldsForm       │
│  - Search in OCR Text: [_________]   │  - Title: [UPSC Civil Services 2026] │
│  - [Copy Text] [14,210 characters]   │  - Conducting Body: [UPSC]           │
│                                      │  - Category: [Civil Services ▾]      │
│  ┌────────────────────────────────┐  │  - Total Vacancies: [1056]           │
│  │ UNION PUBLIC SERVICE COMM...   │  │  - Start Date: [2026-02-01]          │
│  │ EXAMINATION NOTICE NO. 05/2026 │  │  - End Date:   [2026-02-28]          │
│  │ Candidates applying for the... │  │  - Exam Date:  [2026-05-24]          │
│  │ ...                            │  │  - Qualifications: [Degree, ...]     │
│  │ (Scrollable Monospace Container│  │  - Apply URL: [https://upsconline...] │
│  │  max-h-[calc(100vh-240px)])    │  ├──────────────────────────────────────┤
│  └────────────────────────────────┘  │  [ Reject Draft ] [ Approve & Save ] │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 3. Component Breakdown & Specifications

### 3.1 `RawTextPanel.tsx` (`components/admin/RawTextPanel.tsx`)
* **State Management**: Controls text search filter query and clipboard copy state.
* **Layout Safeguards**: `flex-1 min-h-0 overflow-y-auto break-words whitespace-pre-wrap font-mono`. Header and search bar pinned with `flex-shrink-0`. Prevents layout breakage and empty voids regardless of document length.

### 3.2 `ParsedFieldsForm.tsx` (`components/admin/ParsedFieldsForm.tsx`)
* **Form Inputs**: Supports all key schema fields in a clean scrollable container (`flex-1 min-h-0 overflow-y-auto space-y-4`).
* **Pinned Action Controls Bar**: Pinned at the bottom (`flex-shrink-0 bg-slate-950/90 border-t border-slate-800/80 p-4`) containing `Reject Draft` and `Approve & Publish` buttons. Buttons are always visible and accessible to the operator without requiring scrolling past all fields or suffering from height clipping.
* **Blank Void Elimination**: Removed artificial `max-h-[calc(100vh-320px)]` constraint that previously left 200-300px blank gaps on 768p/800p displays.
* **Rejection Workflow**: Opens a modal dialog with mandatory rejection reason text before submitting.
* **Server Action Hooks**: Uses `useTransition` to provide instant pending visual feedback.

---

## 4. Security & Compliance Guardrails
1. **Mandatory Row Level Security (RLS)**: Enforced via PostgreSQL policies on `draft_notifications`, `audit_logs`, and `draft_verification_sessions`.
2. **Audit Logging**: Every approve/reject decision logs `admin_id`, `action`, `target_id`, and `metadata`.
3. **Execution Safety**: Complies with "Do not test. Do not deploy." during code generation.
