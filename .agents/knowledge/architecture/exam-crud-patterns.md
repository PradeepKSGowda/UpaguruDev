# Architecture Knowledge: Exam CRUD Patterns & Governance

**Status**: Standard Architecture Knowledge  
**Module**: Admin HITL Verification Portal (`EPIC-03` / `FEAT-0303`)  
**Applicable Tasks**: `TASK-03030101`, `TASK-03030102`  
**Last Updated**: 2026-09-17  

---

## 1. Overview
The Exam CRUD subsystem provides administrative governance over the `public.exams` master entity, acting as the parent taxonomy for all published government job notifications.

---

## 2. Established Architectural Patterns

### Pattern 1: Foreign Key Protection on Entity Deletion
- **Constraint**: `public.notifications.exam_id` strictly references `public.exams.id`.
- **Governance**: To prevent orphaned notification records or database constraint violations, `deleteExamAction` performs an initial check:
  ```ts
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", id);

  if (count && count > 0) {
    return {
      success: false,
      error: `Cannot delete exam: There are ${count} active notification(s) linked to it.`,
    };
  }
  ```
- The client UI (`ExamsTable.tsx`) warns administrators before attempting deletion and displays the linked notification count.

### Pattern 2: Live Title-to-Slug Transliteration with Reset Mechanism
- In `ExamForm.tsx`, when creating or editing an exam:
  - Entering a title automatically computes a URL-safe slug:
    `title.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-")`
  - If the user manually edits the slug, auto-sync is disconnected to respect the custom slug.
  - A "Reset / Auto-sync" button is provided to re-link slug generation to the title at any time.

### Pattern 3: Slug Uniqueness Exclusion on Update
- On update, the slug uniqueness check must explicitly exclude the record being modified:
  ```ts
  const { data: conflictingExam } = await supabase
    .from("exams")
    .select("id")
    .eq("slug", validatedData.slug)
    .neq("id", id)
    .maybeSingle();
  ```

### Pattern 4: Audit Diff Logging
- For updates, `audit_logs` records both `before` and `after` snapshots in the `metadata` JSON column:
  ```ts
  await supabase.from("audit_logs").insert({
    admin_id: user.id,
    action: "update_exam",
    target_entity: "exam",
    target_id: id,
    metadata: { before: currentExam, after: validatedData },
  });
  ```

### Pattern 5: Multi-Path Edge Cache Invalidation
- When an exam is created, modified, or deleted:
  - List route: `/admin/exams`
  - Public exam routes: `/exams`, `/exams/[slug]` (and previous slug if changed)
  - Home feed: `/`
