# Architecture Knowledge: Forensic Audit Logging & Ledger Standards

**Status**: Standard Architecture Knowledge  
**Module**: Admin HITL Verification Portal & Audit System (`EPIC-03` / `FEAT-0304`)  
**Applicable Tasks**: `TASK-03040101`  
**Last Updated**: 2026-09-17  

---

## 1. Overview
Every mutation, state transition, and publication event executed by an administrative operator is immutably recorded in `public.audit_logs`. This document details the forensic logging structure, batch identity resolution, indexing, and UI inspection patterns.

---

## 2. Established Architectural Patterns

### Pattern 1: Batch Identity Resolution (Eliminating N+1 Queries)
- `public.audit_logs.admin_id` stores the UUID of the operator from `auth.users`.
- Rather than issuing individual queries per log record, `getAuditLogs()` collects all distinct `admin_id` values on the current paginated page and executes a single query against `public.profiles`:
  ```ts
  const uniqueAdminIds = Array.from(new Set(rawLogs.map((l) => l.admin_id))).filter(Boolean);
  if (uniqueAdminIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, full_name, role, avatar_url")
      .in("id", uniqueAdminIds);
    // mapped into adminMap
  }
  ```

### Pattern 2: Mutation Diff Standard in Metadata
- For modifications (`update_exam`, `update_notification`), the `metadata` JSON object must contain explicit `before` and `after` snapshots:
  ```json
  {
    "before": { "status": "draft", "total_vacancies": 500 },
    "after": { "status": "published", "total_vacancies": 650 }
  }
  ```
- For deletions, the metadata preserves the complete deleted entity snapshot and timestamp.

### Pattern 3: Forensic Row Level Security (RLS)
- Access to `public.audit_logs` is restricted to authenticated administrators:
  ```sql
  CREATE POLICY "Admins read audit logs"
    ON public.audit_logs
    FOR SELECT
    TO authenticated
    USING (
      (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin'
      OR (auth.jwt() ->> 'role') = 'service_role'
    );
  ```
- Candidates have zero read or write permissions to `audit_logs`.

### Pattern 4: High-Performance Composite Indexing
- Because audit ledgers accumulate high volumes over time, queries are optimized with:
  1. `idx_audit_logs_created_at_desc` on `(created_at DESC)` for chronological listing.
  2. `idx_audit_logs_action_created` on `(action, created_at DESC)` for action filtering.
  3. `idx_audit_logs_admin_created` on `(admin_id, created_at DESC)` for operator auditing.
  4. `idx_audit_logs_target` on `(target_entity, target_id)` for entity history lookups.
