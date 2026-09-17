# Architecture Knowledge: Notification CRUD Patterns & Lifecycle Governance

**Status**: Standard Architecture Knowledge  
**Module**: Admin HITL Verification Portal (`EPIC-03` / `FEAT-0303`)  
**Applicable Tasks**: `TASK-03030102`  
**Last Updated**: 2026-09-17  

---

## 1. Overview
The Notification CRUD subsystem empowers administrative operators to author, amend, publish, or retire public job notifications outside or alongside the AI ingestion pipeline.

---

## 2. Established Architectural Patterns

### Pattern 1: Parent Examination Dynamic Selector & Referential Integrity
- Every notification in `public.notifications` requires a foreign key reference (`exam_id`) pointing to `public.exams.id`.
- For administrative forms, `getExamOptionsForSelector()` provides a lightweight, cached payload containing `id`, `title`, `conducting_body`, `category`, `state_or_central`, and `slug`.
- Server Actions enforce referential validity before database mutation:
  ```ts
  const { data: parentExam } = await supabase
    .from("exams")
    .select("id")
    .eq("id", validatedData.exam_id)
    .single();
  if (!parentExam) throw new Error("Invalid parent examination series");
  ```

### Pattern 2: Publication Lifecycle Transitions & Timestamps
- When authoring or updating notifications:
  - If `status === 'published'` on creation: `verified_by` is set to the current administrator's user ID and `published_at` is set to the current ISO timestamp.
  - If updating a notification from a non-published status (`draft` or `under_review`) to `'published'`: `verified_by` and `published_at` are dynamically recorded.
  - Public candidates are restricted by Row Level Security (`WHERE status = 'published'`), ensuring unverified drafts remain invisible on candidate-facing routes.

### Pattern 3: Dual-Mode Slug Synchronization
- `NotificationForm.tsx` synchronizes the canonical URL slug with the notification title in real-time.
- If an administrator manually edits the slug input, the component automatically disconnects auto-sync to preserve the custom slug.
- An inline "Auto-sync from headline" button is provided to re-link slug generation if desired.

### Pattern 4: Audit Trail Diffing
- All notification updates record a full `before` and `after` snapshot in `public.audit_logs.metadata`:
  - Changes to vacancies, deadlines, application opening dates, and publication status are forensically recorded.

### Pattern 5: Multi-Path Edge Cache Revalidation
- Mutations trigger comprehensive invalidation across both administrative listings and candidate pages:
  ```ts
  revalidatePath("/admin/notifications");
  revalidatePath("/notifications");
  revalidatePath(`/notification/${slug}`);
  revalidatePath("/admin");
  revalidatePath("/");
  revalidateTag("notifications");
  ```
