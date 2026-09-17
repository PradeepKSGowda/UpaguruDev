# HITL Verification & Publishing Patterns

**Status**: Standard Architecture Knowledge  
**Module**: Admin HITL Verification Portal (`EPIC-03` / `FEAT-0302`)  
**Applicable Tasks**: `TASK-03020101`, `TASK-03020102`, `TASK-03020103`, `TASK-03020104`  
**Last Updated**: 2026-09-17  

---

## 1. Overview
The Human-In-The-Loop (HITL) system enables operators to review, edit, approve/publish, or reject AI-extracted notifications before they appear on the public candidate portal. This document establishes verified architectural patterns, guardrails, and gotchas discovered during implementation.

---

## 2. Core Architectural Patterns

### Pattern 1: RSC Component Boundary & Lucide Icons (React 19)
- **Problem**: When a component is marked with `"use client"`, passing non-plain JavaScript objects (e.g. Lucide icon components or React element functions) from a Server Component across the boundary throws:
  ```
  Only plain objects can be passed to Client Components from Server Components. Classes or other objects with methods are not supported. <... icon={{$$typeof: ..., render: ...}}>
  ```
- **Solution**: Keep presentational cards (`StatsCard`, `DraftCard`) as **React Server Components** without `"use client"`. Only apply `"use client"` to interactive leaf components (e.g., forms, modals, filter search bars).

### Pattern 2: TypeScript `noUncheckedIndexedAccess` Safe Parsing
- **Problem**: With `"noUncheckedIndexedAccess": true`, array indexing such as `isoString.split("T")[0]` evaluates to `string | undefined`, causing TS2322 errors when assigning to strictly required database fields (`string`).
- **Solution**: Use string slicing instead of array splitting:
  ```ts
  // Avoid:
  const dateStr = now.split("T")[0]; // typed as string | undefined

  // Preferred:
  const dateStr: string = now.slice(0, 10); // typed as string
  ```

### Pattern 3: Parent Exam Auto-Provisioning
- **Problem**: `public.notifications.exam_id` has a strict foreign key constraint referencing `public.exams.id`. AI scrapers may extract notifications for newly scheduled exams that do not yet exist in `public.exams`.
- **Solution**: In `publishNotificationAction`:
  1. Check if `examId` was explicitly provided and valid.
  2. If not provided, query `public.exams` by slug or conducting body.
  3. If still missing, automatically insert a new parent exam record into `public.exams` and use its generated UUID for `notifications.exam_id`.

### Pattern 4: Collision-Resistant Notification Slugs
- **Pattern**: When publishing notifications, generate slugs from the notification title combined with 6 characters of cryptographic randomness:
  ```ts
  const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const entropy = crypto.randomBytes(3).toString("hex");
  const notificationSlug = `${baseSlug.slice(0, 60)}-${entropy}`;
  ```

### Pattern 5: Multi-Entity Forensic Audit Logging
- **Standard**: Every mutation by an admin must record:
  1. An immutable record in `public.audit_logs` capturing `admin_id`, `action`, `entity`, `entity_id`, and `changes` JSON.
  2. A verification session in `public.draft_verification_sessions` capturing the reviewed draft, duration, and operator corrections.

### Pattern 6: Multi-Path Cache Invalidation
- Upon publishing or rejecting a draft:
  ```ts
  revalidatePath("/");
  revalidatePath("/notifications");
  revalidatePath(`/notification/${notificationSlug}`);
  revalidatePath("/admin");
  revalidatePath("/admin/drafts");
  revalidateTag("notifications");
  ```

---

## 3. Database RLS Policies Reference
All admin actions must be guarded by Row Level Security:
- `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'` OR `auth.jwt() ->> 'role' = 'service_role'`.
- Candidate roles (`candidate` or anonymous) must have strictly read-only access to `public.notifications` (where `status = 'published'`) and zero write access to `audit_logs` or `draft_notifications`.
