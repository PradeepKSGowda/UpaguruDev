# Architecture & Security Design Specification: Default Role Assignment & PL/pgSQL Function

**Task ID**: TASK-01020201  
**Epic / Feature**: EPIC-01 / FEAT-0102  
**Author**: Solution Architect Agent  
**Reviewers**: SecurityReviewer, CodeReviewer, ArchitectureReviewer  
**Status**: APPROVED  
**Target Platform**: PostgreSQL 15+, Supabase Auth GoTrue Engine  

---

## 1. Executive Summary

In Supabase Auth, user tokens carry claims parsed from `auth.users`. However, Supabase segregates user metadata into two separate JSONB dictionaries:
1. `raw_user_meta_data`: User-writable during client signup and update (`supabase.auth.signUp({ options: { data: { ... } } })`). **Untrusted**.
2. `raw_app_meta_data`: Server-only and administrative (`service_role`). **Trusted**. Embedded directly into the resulting JWT `app_metadata` dictionary.

To guarantee that every new user unconditionally receives the **`candidate`** role without any possibility of client-side privilege escalation, a dedicated PL/pgSQL function and database trigger are established on `auth.users`.

---

## 2. Security Architecture & Threat Model

```
                                  [ Client Signup Payload ]
                                (Contains untrusted user_metadata)
                                             │
                                             ▼
                               ┌───────────────────────────┐
                               │       auth.users          │
                               │      (INSERT event)       │
                               └─────────────┬─────────────┘
                                             │
                       ┌─────────────────────┴─────────────────────┐
                       │ BEFORE INSERT Trigger                     │
                       │ tr_set_default_user_role                  │
                       │ - Forces raw_app_meta_data.role           │
                       │   = 'candidate'                           │
                       │ - Overrides any malicious injected claim  │
                       └─────────────────────┬─────────────────────┘
                                             │
                                             ▼
                       ┌───────────────────────────────────────────┐
                       │ AFTER INSERT Sync Trigger                 │
                       │ on_auth_user_created                      │
                       │ - Synchronizes to public.profiles         │
                       │ - Initializes public.user_subscriptions   │
                       └─────────────────────┬─────────────────────┘
                                             │
                                             ▼
                       ┌───────────────────────────────────────────┐
                       │ Token Issuance Hook                       │
                       │ custom_access_token_hook                  │
                       │ - Reads authoritative role from profiles  │
                       │ - Injects role claim into auth.jwt()      │
                       └───────────────────────────────────────────┘
```

### Key Security Safeguards:
1. **Search Path Isolation**: All functions specify `SET search_path = public, auth` to neutralize schema search path hijacking vulnerabilities (CWE-426).
2. **Security Definer Containment**: Functions execute with elevated owner privileges to update `auth.users`, but permissions are strictly revoked from `anon`, `authenticated`, and `public`.
3. **Audit Log Mandate**: Any administrative invocation of `set_user_role` writes an immutable record to `public.audit_logs`.

---

## 3. Function & Trigger Specifications

### 3.1 `public.set_user_role(target_user_id UUID, new_role app_role_enum)`
* **Purpose**: Programmatic procedure allowing verified administrators or secure background routines to alter a user's access level.
* **Operations**:
  1. Asserts caller authorization (`auth.jwt() ->> 'role' IN ('admin', 'super_admin')` or internal security definer).
  2. Updates `public.profiles.role`.
  3. Synchronizes `auth.users.raw_app_meta_data = jsonb_set(..., '{role}', to_jsonb(new_role))`.
  4. Writes event to `public.audit_logs`.

### 3.2 `public.set_default_user_role_trigger()`
* **Event**: `BEFORE INSERT ON auth.users`
* **Purpose**: Intercepts the raw user row prior to physical persistence and guarantees that `NEW.raw_app_meta_data` has `{ "role": "candidate" }`.
* **Behavior**:
  - If `NEW.raw_app_meta_data` is NULL, initializes it to `{}`.
  - Injects `role = 'candidate'` unless an authorized migration script has explicitly flagged super admin seeding.

---

## 4. Compliance Matrix

| Rule / Requirement | Implementation Mechanism | Validation Status |
| :--- | :--- | :--- |
| **Mandatory RLS & RBAC** (`AGENTS.md` Rule 3) | Guarantees all signups possess `candidate` role; prevents unprivileged access to admin portals. | PASSED |
| **Audit Logging** (`AGENTS.md` Rule 3) | Role modifications log to `public.audit_logs`. | PASSED |
| **Stored Procedure Audits** (`SecurityReviewer` 4) | Explicit `SECURITY DEFINER` and `SET search_path = public, auth`. | PASSED |
| **Idempotency** | Uses `CREATE OR REPLACE` and conditional trigger creation guards. | PASSED |
