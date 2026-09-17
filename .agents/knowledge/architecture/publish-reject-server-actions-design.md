# Architecture & Design Specification: Publish & Reject Server Actions

## 1. Document Metadata
* **Document ID**: DESIGN-SERVER-ACTIONS-001
* **Task Reference**: TASK-03020104 (Subtasks: SUB-0302010401, SUB-0302010402)
* **Epic Reference**: EPIC-03 (Admin HITL Verification Portal & Audit System)
* **Feature Reference**: FEAT-0302 (Draft HITL Review Dashboard & Approval Workflow)
* **User Story**: STORY-030201 (As an admin, I want to review AI-extracted draft notifications so I can verify accuracy before publishing)
* **Assigned Role**: Frontend / Full-Stack Engineer
* **Architecture References**: ADR-001 (Server Actions), ADR-002 (Database Schema), ADR-003 (RBAC), ADR-010 (Caching & ISR), ADR-013 (Security), ADR-014 (API Design)
* **Status**: APPROVED

---

## 2. Objective & System Flow
`TASK-03020104` builds and hardens the definitive Server Actions layer in `app/admin/drafts/actions.ts`:
1. **`publishNotificationAction`**:
   - Accepts validated human-verified fields for a draft notification.
   - Validates input using Zod (`publishNotificationInputSchema` / `draftParsedFieldsSchema`).
   - Asserts administrative authentication session via `createServerClient()`.
   - Resolves or auto-provisions the parent exam record in `public.exams` to ensure relational integrity.
   - Generates a collision-resistant, URL-safe slug for the notification (e.g. `upsc-civil-services-examination-2026`).
   - Inserts the verified notification into `public.notifications` with status `published`, `verified_by: admin_id`, and `published_at: now()`.
   - Transitions `public.draft_notifications` record from `pending_review` to `approved`.
   - Records an immutable audit log entry in `public.audit_logs`.
   - Records operator telemetry in `public.draft_verification_sessions`.
   - Triggers ISR edge cache invalidation across candidate and administrative routes via `revalidatePath` and `revalidateTag`.
2. **`rejectDraftAction`**:
   - Validates mandatory operator explanation ($\ge 10$ characters) via `draftRejectionSchema`.
   - Transitions draft record in `public.draft_notifications` to `rejected`.
   - Logs the rejection with reason in `public.audit_logs` and `public.draft_verification_sessions`.
   - Revalidates queue cache to immediately reflect updated queue counts.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              publishNotificationAction Workflow (Server Action)            │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Client Operator Form Submit (ParsedFieldsForm)                           │
│    └─> Calls publishNotificationAction(draftId, fields)                     │
│ 2. Cryptographic Session Validation (createServerClient)                     │
│    └─> supabase.auth.getUser() -> Check user in ('admin', 'super_admin')    │
│ 3. Zod Input Validation (draftParsedFieldsSchema)                           │
│    └─> Sanitize inputs, enforce ranges and URLs                             │
│ 4. Parent Exam Resolution (public.exams)                                    │
│    └─> Find or auto-provision exam series row (foreign key FK constraint)   │
│ 5. Notification Record Creation (public.notifications)                      │
│    └─> INSERT with status='published', verified_by, published_at, slug      │
│ 6. Draft Status Mutation (public.draft_notifications)                       │
│    └─> UPDATE status='approved', parsed_json=validatedData                  │
│ 7. Audit Logging & Telemetry                                                │
│    ├─> INSERT into public.audit_logs (action: 'NOTIFICATION_PUBLISHED')     │
│    └─> INSERT into public.draft_verification_sessions                       │
│ 8. ISR Edge Cache Invalidation                                              │
│    ├─> revalidatePath("/"), revalidatePath("/notifications")                │
│    ├─> revalidatePath("/notification/[slug]")                               │
│    └─> revalidatePath("/admin"), revalidatePath("/admin/drafts")            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data Integrity & Edge Cache Revalidation Strategy

### 3.1 Relational Integrity
- In `public.notifications`, `exam_id` references `public.exams.id`.
- If an extracted draft represents a new exam board or series not yet in `public.exams`, `publishNotificationAction` queries for an existing match by conducting body or title. If none exists, it provisions the exam entity row atomically, ensuring foreign key consistency.

### 3.2 Cache Invalidation Tag Matrix
| Route / Target | Revalidation Mechanism | Rationale |
| :--- | :--- | :--- |
| Candidate Homepage (`/`) | `revalidatePath("/")` | Surfaces newly published notification immediately on the feed |
| Candidate Notifications Feed (`/notifications`) | `revalidatePath("/notifications")` | Updates category and search feeds |
| Programmatic Notification Detail (`/notification/[slug]`) | `revalidatePath("/notification/" + slug)` | Pre-renders newly created notification detail page |
| Admin Dashboard Overview (`/admin`) | `revalidatePath("/admin")` | Updates KPI counters (published today, pending review) |
| Admin Draft Queue (`/admin/drafts`) | `revalidatePath("/admin/drafts")` | Removes approved draft from pending queue |
| Cache Tag (`notifications`) | `revalidateTag("notifications")` | Purges Next.js Data Cache for candidate queries |

---

## 4. Security & Compliance Guardrails
1. **Mandatory Row Level Security (RLS)**: Enforced via PostgreSQL policies on `notifications`, `exams`, `draft_notifications`, `audit_logs`, and `draft_verification_sessions`.
2. **Cryptographic Identity**: Operator UUID is derived strictly from verified Supabase session token (`user.id`), never accepted as user-controlled payload.
3. **Execution Guardrails**: Observes strict "Do not test. Do not deploy." constraints during implementation.
