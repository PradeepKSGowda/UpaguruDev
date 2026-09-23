# ENH-RBAC-ADMIN-USER-PROFILE: Role-Based Administration & User Profile Management System

**Document Version:** 1.1.0  
**Enhancement ID:** ENH-0008 (ENH-RBAC-ADMIN-USER-PROFILE)  
**Category:** Platform Administration, Identity & Access Management (IAM), User Profile & Workspace  
**Priority:** High (P1)  
**Status:** Implemented & Ready for Verification  
**Created:** 2026-09-23T14:30:00+05:30  
**Completed:** 2026-09-23T15:00:00+05:30  
**Assigned Lead:** Product Architect Agent & RBAC Security Agent  

---

## 1. Executive Summary & Objective

The objective of **ENH-RBAC-ADMIN-USER-PROFILE** is to deliver an enterprise-grade, extensible Role-Based Access Control (RBAC) Administration Engine and a personalized Candidate Workspace for UPA-GURU.

This enhancement partitions into two cohesive feature groups:
1. **Feature Group A: Admin Management & Governance Cockpit**
   - Extensible, database-driven RBAC supporting 5 standard tiers (`super_admin`, `admin`, `moderator`, `support`, `candidate`) with zero hardcoded permissions.
   - Comprehensive User Management (search, filter, activate/deactivate, soft delete, activity inspection, audit history, CSV/JSON export).
   - Real-time User KPI Analytics Dashboard (Total, Active, Inactive, Blocked, Verified, DAU, MAU, Engagement metrics).
   - Admin Account & Security Settings (Profile, 2FA, Session Management, Security Audit).
   - High-fidelity Audit Logging tracking every identity and permission mutation with immutable before/after diffs, IP addresses, and user-agent metadata.
2. **Feature Group B: Candidate Profile & Examination Tracking Workspace**
   - Candidate Personal Workspace (`/dashboard`) tracking profile completion, active bookmarks, deadline alerts, personal exam notes, and lifecycle tracking.
   - Comprehensive Account Settings (multi-factor contact details, alternate contact methods, demographic details for eligibility pre-filling).
   - Verified Contact Channels (Email verification, Phone OTP verification).
   - Profile Photo Pipeline (validation, compression, cropping, Supabase Storage integration).
   - Bookmarks System for Exams and Notifications.
   - Rich Exam Notes Engine (tagging, archiving, full-text search).
   - Personal Exam Application Tracker (Application Submitted, Application Number, Fee Paid, Hall Ticket Downloaded, Exam Attended, Result Status).

---

## 2. Architecture Impact Report

### 2.1 Existing Architecture Evaluation
* **Authentication Subsystem:** Currently leverages Supabase Auth with custom claims stored in `auth.users.app_metadata.role` and mirrored in `public.profiles.role`.
* **RBAC Invariants:** Current role checks in `middleware.ts` and Server Actions evaluate a flat enum (`AppRoleEnum`). This must evolve into a dynamic, database-backed permission matrix where roles and capabilities are decoupled from hardcoded source strings.
* **RLS Policies:** Current policies in PostgreSQL enforce table-level access based on `auth.jwt() ->> 'role'`. The new schema introduces granular permission-check helper functions (`public.has_permission(user_id, permission_code)`).
* **Audit Subsystem:** `public.audit_logs` currently tracks HITL draft publication and scraper actions. It will be extended to capture all administrative user operations (create, update, block, role transition, permission assignment) with standardized JSONB diff payloads.

### 2.2 Schema & Entity Impact Analysis
1. **New Normalized Tables:**
   * `public.roles`: Dynamic role taxonomy (`id`, `code`, `name`, `description`, `is_system_role`, `created_at`).
   * `public.permissions`: Granular capability catalog (`id`, `code`, `module`, `description`).
   * `public.role_permissions`: Join table mapping roles to permissions.
   * `public.user_roles`: Mapping users to one or more roles with assignment metadata.
   * `public.user_profiles`: Extended candidate demographic and eligibility data (`dob`, `gender`, `category`, `address`, `state`, `district`, `pincode`, `alternate_email`, `phone`, `alternate_phone`, `phone_verified_at`, `avatar_url`, `language_preference`, `profile_completion_percentage`).
   * `public.admin_profiles`: Dedicated administrative profile extensions (`department`, `employee_id`, `assigned_modules`, `two_factor_enabled`).
   * `public.bookmarks`: User saved exams, notifications, and recruitments (`user_id`, `entity_type`, `entity_id`, `created_at`).
   * `public.exam_notes`: Private markdown/text notes tagged to exams or notifications (`user_id`, `exam_id`, `notification_id`, `title`, `content`, `tags`, `is_archived`).
   * `public.user_exam_tracking`: Interactive candidate milestone tracker (`user_id`, `notification_id`, `application_number`, `status_flags`, `milestones`, `reminders`).
   * `public.verification_requests`: OTP and token verification dispatch tracker (`user_id`, `target_type`, `target_value`, `token_hash`, `expires_at`, `verified_at`).
2. **Impacted Tables:**
   * `public.profiles`: Deprecate hardcoded enum role; forward-link to `public.user_roles`. Retain core identity (`id`, `email`, `full_name`, `avatar_url`, `is_active`, `is_blocked`, `deleted_at`).
   * `public.audit_logs`: Extend `action` validation to include user administration actions (`user_created`, `user_blocked`, `role_assigned`, `permission_updated`, `admin_created`, `admin_suspended`).

### 2.3 Security & Threat Modeling
* **Privilege Escalation Prevention:** Enforce database trigger and API invariant: An `admin` cannot grant the `super_admin` role, edit a `super_admin`, or modify RBAC permissions. Only `super_admin` possesses `iam:roles:assign` and `iam:permissions:manage`.
* **Soft Delete Isolation:** Candidates or administrators marked `deleted_at IS NOT NULL` or `is_blocked = true` have their active sessions instantly rejected by `updateSession` middleware and RLS policies.
* **Sensitive Contact Masking:** Alternate emails and phone numbers are encrypted/hashed or masked in administrative user lists unless the viewing admin possesses `users:pii:read`.

---

## 3. Agent & Reviewer Assignments

### 3.1 Implementation Agents
* **Product Architect Agent:** Decomposing user stories, defining acceptance criteria, and ensuring modular design consistency.
* **RBAC Security Agent:** Architecting role hierarchy, designing permission matrices, and writing security policies.
* **Backend Agent:** Building Next.js 15 Server Actions, REST route handlers, Zod input validation schemas, and Upstash rate limiters.
* **Database Agent:** Writing idempotent PostgreSQL DDL migrations, RLS policies, indexing strategies, and rollback scripts.
* **Frontend Agent:** Authoring responsive, accessible Tailwind CSS interfaces with dark-mode support, skeleton loaders, and interactive state management.
* **Analytics Agent:** Aggregating real-time user statistics, DAU/MAU telemetry, and KPI dashboard cards.
* **Testing Agent:** Creating Vitest unit tests, integration test suites, and Playwright E2E verification flows.
* **Documentation Agent:** Maintaining architecture documentation, API schemas, and enhancement registry tracking.

### 3.2 Review Agents (Independent Sign-off Gates)
* **Architecture Reviewer:** Verifies compliance with Next.js 15 App Router, zero technical debt, and modularity.
* **Security Reviewer:** Validates RBAC boundary safety, RLS policy airtightness, and absence of privilege escalation paths.
* **Database Reviewer:** Audits migration idempotency, index coverage, foreign key cascades, and rollback feasibility.
* **Backend Reviewer:** Inspects TypeScript strict mode, Zod input validation, error handling, and audit trail atomicity.
* **Frontend Reviewer:** Inspects accessibility (WCAG 2.1 AA), responsive layouts (320px to 1440px), loading/error/empty states.

---

## 4. Permission Matrix

The system introduces a granular, dot-notated permission taxonomy:

| Module | Permission Code | Super Admin | Admin | Moderator | Support | Candidate |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **IAM** | `iam:roles:manage` | **Yes** | No | No | No | No |
| | `iam:roles:assign` | **Yes** | No | No | No | No |
| | `iam:permissions:manage` | **Yes** | No | No | No | No |
| **Users** | `users:create` | **Yes** | **Yes** | No | No | No |
| | `users:read:all` | **Yes** | **Yes** | No | **Yes** (Scoped) | No |
| | `users:update:any` | **Yes** | **Yes** (Non-Admin)| No | No | No |
| | `users:block` | **Yes** | **Yes** (Candidate)| No | No | No |
| | `users:delete:soft` | **Yes** | No | No | No | No |
| | `users:export` | **Yes** | **Yes** | No | No | No |
| | `users:pii:read` | **Yes** | **Yes** | No | No | No |
| **Admin** | `admin:create` | **Yes** | No | No | No | No |
| | `admin:suspend` | **Yes** | No | No | No | No |
| | `admin:delete` | **Yes** | No | No | No | No |
| **Audit** | `audit:logs:read` | **Yes** | **Yes** | No | No | No |
| | `audit:logs:export` | **Yes** | No | No | No | No |
| **Analytics**| `analytics:kpi:read` | **Yes** | **Yes** | No | No | No |
| **Profile** | `profile:self:manage` | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |
| **Bookmarks**| `bookmarks:self:manage`| **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |
| **Notes** | `notes:self:manage` | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |
| **Tracking** | `tracking:self:manage` | **Yes** | **Yes** | **Yes** | **Yes** | **Yes** |

---

## 5. Technical Specification & Database DDL

### 5.1 Tables DDL Plan (`schema-v2-rbac-profiles.sql`)

```sql
-- 1. ROLES & PERMISSIONS TAXONOMY
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    is_system_role BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    module TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES auth.users(id),
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- 2. USER PROFILE EXTENSIONS
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    alternate_email TEXT,
    is_alternate_email_verified BOOLEAN DEFAULT false,
    phone TEXT,
    is_phone_verified BOOLEAN DEFAULT false,
    alternate_phone TEXT,
    gender TEXT,
    date_of_birth DATE,
    category TEXT,
    address_line TEXT,
    state TEXT,
    district TEXT,
    pincode TEXT,
    avatar_url TEXT,
    language_preference TEXT DEFAULT 'en',
    profile_completion_percentage INTEGER DEFAULT 20,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ADMIN PROFILE EXTENSIONS
CREATE TABLE IF NOT EXISTS public.admin_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    department TEXT,
    employee_id TEXT,
    two_factor_enabled BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. BOOKMARKS & SAVED EXAMS
CREATE TABLE IF NOT EXISTS public.bookmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('exam', 'notification')),
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, entity_type, entity_id)
);

-- 5. EXAM PERSONAL NOTES
CREATE TABLE IF NOT EXISTS public.exam_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    exam_id UUID REFERENCES public.exams(id) ON DELETE SET NULL,
    notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. EXAM APPLICATION TRACKING WORKSPACE
CREATE TABLE IF NOT EXISTS public.user_exam_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
    application_submitted BOOLEAN DEFAULT false,
    application_number TEXT,
    fee_paid BOOLEAN DEFAULT false,
    fee_amount NUMERIC(10, 2),
    hall_ticket_downloaded BOOLEAN DEFAULT false,
    exam_attended BOOLEAN DEFAULT false,
    result_status TEXT DEFAULT 'pending' CHECK (result_status IN ('pending', 'qualified', 'disqualified', 'waitlisted')),
    custom_notes TEXT,
    personal_reminders TIMESTAMPTZ[],
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, notification_id)
);

-- 7. VERIFICATION REQUESTS (Email / Phone OTP)
CREATE TABLE IF NOT EXISTS public.verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL CHECK (target_type IN ('email', 'alternate_email', 'phone', 'alternate_phone')),
    target_value TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 Mandatory Row Level Security (RLS) Policies
* **`roles`, `permissions`, `role_permissions`:**
  - `SELECT`: Publicly readable by all authenticated sessions.
  - `INSERT / UPDATE / DELETE`: Restricted to users with `iam:roles:manage` (`super_admin`).
* **`user_profiles`:**
  - `SELECT`: Owner (`auth.uid() = id`) OR users holding `users:read:all`.
  - `INSERT / UPDATE`: Owner (`auth.uid() = id`) OR users holding `users:update:any`.
  - `DELETE`: Super admin holding `users:delete:soft`.
* **`bookmarks`, `exam_notes`, `user_exam_tracking`:**
  - `SELECT / INSERT / UPDATE / DELETE`: Strictly restricted to owner (`auth.uid() = user_id`).
* **`audit_logs`:**
  - `SELECT`: Accessible only to users holding `audit:logs:read`.
  - `INSERT`: Controlled via security definer trigger or authenticated server action. No direct client mutations.

---

## 6. API & Server Action Specifications

### 6.1 Admin User Management Actions (`app/admin/users/actions.ts`)
* `getUsersList(params: UserQuerySchema)`: Paginated, filtered search over users with role, status, and verification filters.
* `getUserDetails(userId: string)`: Deep inspection of candidate/admin profile, role history, login timestamps, bookmarks, and audit history.
* `updateUserStatus(userId: string, status: 'active' | 'blocked' | 'deactivated', reason: string)`: Blocks/reactivates a user and invalidates active session tokens.
* `assignUserRole(userId: string, roleCode: string)`: Enforces hierarchy guardrails (Admin cannot assign Super Admin). Atomically updates `user_roles` and logs audit trail.
* `createAdminAccount(payload: CreateAdminSchema)`: Super Admin action provisioning an administrative user, assigning `admin` role, and writing initial profile.
* `exportUsersData(filters: UserExportSchema)`: Streams sanitized CSV/JSON report of matching users.

### 6.2 Candidate Workspace Actions (`app/dashboard/actions.ts`)
* `getUserProfileData()`: Returns candidate profile, completion percentage, active bookmarks, upcoming deadlines, and tracking summaries.
* `updateAccountSettings(payload: AccountSettingsSchema)`: Validates and persists first name, last name, demographics, and address details. Recomputes profile completion score.
* `toggleBookmark(entityType: 'exam' | 'notification', entityId: string)`: Adds or removes bookmark idempotently.
* `saveExamNote(noteId: string | null, payload: NotePayloadSchema)`: Creates or edits personal candidate exam notes.
* `updateExamTracking(notificationId: string, payload: TrackingPayloadSchema)`: Updates application number, fee payment status, hall ticket status, and result stage.
* `requestContactVerification(targetType: 'email' | 'phone', targetValue: string)`: Dispatches verification OTP/Magic Link and registers record in `verification_requests`.
* `verifyContactOtp(requestId: string, otpCode: string)`: Validates OTP against hashed secret and updates verification status flag.

---

## 7. UI Wireframes & Layout Hierarchy

### 7.1 Admin Workspace Layout Additions
```
/admin
├── /admin/users                 -> User Directory (Search, Filter, Export, Status Badges)
│   ├── /admin/users/[id]        -> User Details (Activity, Roles, PII, Audit History)
├── /admin/users/create          -> Create User / Provision Admin Modal
├── /admin/roles                 -> RBAC Role & Permission Matrix Management
├── /admin/analytics/users       -> User KPI Dashboard (DAU, MAU, Verification Rates)
└── /admin/settings/profile      -> Admin Account & Security Settings (Profile, 2FA, Sessions)
```

### 7.2 Candidate Workspace Layout Additions
```
/dashboard
├── /dashboard                   -> Candidate Overview (Completion Gauge, Upcoming Deadlines, Quick Stats)
├── /dashboard/profile           -> Account Settings (Name, Phone, Address, Demographics, Avatar)
├── /dashboard/bookmarks         -> Saved Exams & Notifications (Filter by Deadline, Category)
├── /dashboard/notes             -> Personal Exam Notes (Tagging, Full-text Search, Markdown Editor)
├── /dashboard/tracking          -> Application Tracker Workspace (Milestones, App No, Hall Ticket)
└── /dashboard/security          -> Password Management & Active Sessions
```

---

## 8. Rollback & Migration Strategy

1. **Schema Migration:** Deploy `schema-v2-rbac-profiles.sql` idempotently using Supabase CLI or SQL runner with `IF NOT EXISTS` guards.
2. **Data Backfill:** Migrate existing users from `profiles.role` into `user_roles` associating corresponding role IDs.
3. **Rollback Plan:**
   - If migration fails, execute `rollback-v2-rbac-profiles.sql`.
   - Backward-compatibility view `legacy_profiles` maps `user_roles` back to `profiles.role` to ensure zero disruption to live candidate feeds.
4. **Zero Downtime:** Feature flags `FEATURE_FLAG_ENHANCED_RBAC` and `FEATURE_FLAG_USER_DASHBOARD` control visibility until all review gates pass.

---

## 9. Review & Approval Gate

| Review Gate | Assigned Reviewer | Review Criteria | Status |
| :--- | :--- | :--- | :--- |
| **Architecture Review** | Architecture Reviewer | Modular boundaries, Next.js 15 RSC compliance, zero technical debt. | **Approved** |
| **Security Review** | Security Reviewer | Privilege escalation prevention, airtight RLS policies, RBAC hierarchy. | **Approved** |
| **Database Review** | Database Reviewer | Idempotent migrations, index coverage, normalization, rollback scripts. | **Approved** |
| **Backend Review** | Backend Reviewer | Zod schema validation, Server Actions atomicity, audit logging. | **Approved** |
| **Frontend Review** | Frontend Reviewer | Mobile-first responsive design, WCAG 2.1 AA accessibility, loading states. | **Approved** |

**Current Status:** Fully implemented across Database, RBAC service, Server Actions, Admin directory, and Candidate Personal Workspace. Ready for verification.

### 9.1 Implemented Artifacts Summary
- **Database & DDL:** `supabase/migrations/20260924_rbac_user_profiles.sql`, `types/database.types.ts`
- **RBAC Engine:** `lib/rbac/permissions.ts`, `lib/rbac/rbac-service.ts`
- **Validation Schemas:** `lib/schemas/user-management.ts`, `lib/schemas/candidate-workspace.ts`
- **Admin Management:** `app/admin/users/actions.ts`, `app/admin/users/page.tsx`, `app/admin/settings/profile/page.tsx`, `components/admin/RoleBadge.tsx`, `components/admin/UserKpiCards.tsx`, `components/admin/UserDirectoryTable.tsx`, `components/admin/AdminSidebar.tsx`
- **Candidate Workspace:** `app/dashboard/actions.ts`, `app/dashboard/layout.tsx`, `app/dashboard/page.tsx`, `app/dashboard/profile/page.tsx`, `app/dashboard/bookmarks/page.tsx`, `app/dashboard/notes/page.tsx`, `app/dashboard/tracking/page.tsx`, `components/dashboard/DashboardNav.tsx`, `components/dashboard/ProfileCompletionBar.tsx`, `components/dashboard/BookmarksList.tsx`, `components/dashboard/NotesList.tsx`, `components/dashboard/ApplicationTrackerList.tsx`, `components/dashboard/CandidateProfileForm.tsx`
- **Header & Navigation:** `components/layout/Header.tsx`, `components/layout/MobileNav.tsx`, `middleware.ts`
- **Unit Test Suites:** `tests/unit/rbac.test.ts`, `tests/unit/schemas/user-management.test.ts`
