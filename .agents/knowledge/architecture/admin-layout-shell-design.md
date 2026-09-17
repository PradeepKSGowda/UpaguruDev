# Admin Dashboard Layout & Navigation Shell Architecture Design

## 1. Document Metadata
* **Document ID**: DESIGN-ADMIN-SHELL-001
* **Task Reference**: TASK-03010101 (Subtasks: SUB-0301010101, SUB-0301010102)
* **Epic Reference**: EPIC-03 (Admin HITL Verification Portal & Audit System)
* **Feature Reference**: FEAT-0301 (Admin Dashboard Layout & Navigation Shell)
* **User Story**: STORY-030101 (As an admin, I want a dedicated dashboard layout so I can efficiently manage the verification pipeline)
* **Assigned Role**: Frontend Engineer
* **Architecture References**: ADR-001 (Frontend Architecture), ADR-002 (Database), ADR-003 (Authentication & RBAC), ADR-013 (Security)
* **Status**: APPROVED

---

## 2. Objective & System Architecture
The Administrative Human-In-The-Loop (HITL) Verification Portal represents the secure back-office cockpit where operators review AI-extracted competitive exam notifications, manage master exam taxonomy, and audit administrative actions.

The layout shell provides:
1. **Server-Side Role Guardrail (RSC)**: Verifies user session and role (`admin` or `super_admin`) at the layout boundary, preventing unauthorized access even if edge middleware was bypassed.
2. **Persistent Sidebar Navigation (`AdminSidebar.tsx`)**:
   - Fixed desktop navigation bar (260px width) with quick access to:
     - Dashboard Overview (`/admin`)
     - Draft Review Queue (`/admin/drafts`)
     - Exam Master Management (`/admin/exams`)
     - Published Notifications (`/admin/notifications`)
     - System Audit Logs (`/admin/audit-logs`)
     - Live Candidate Portal Link (`/`)
   - Real-time active link highlighting with `usePathname()`.
   - Responsive mobile slide-out drawer with backdrop blur and touch dismiss.
3. **Administrative Header (`AdminHeader.tsx`)**:
   - Top action bar featuring mobile sidebar toggle button, page context, admin user identity (full name, email), role badge (`Admin` or `Super Admin`), and secure sign-out trigger redirecting to `/auth/login`.
4. **Shell Layout (`AdminLayoutShell.tsx` & `app/admin/layout.tsx`)**:
   - Seamless integration between Server Components (data fetching & security checks) and Client Components (interactivity, drawer state, active path matching).
   - Strict SEO `robots: { index: false, follow: false }` metadata directive to ensure no search engine indexes administrative routes.
5. **Landmark IDs for Automated Testing**: Full compliance with Playwright test automation standards via deterministic HTML element IDs.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Admin Server Layout (app/admin/layout.tsx)            │
│  [Security Check: supabase.auth.getUser() -> profiles.role in (admin, super)]│
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌───────────────────────┐ ┌───────────────────────────────────────────────┐ │
│ │  AdminSidebar (Client) │ │ AdminHeader (Client)                          │ │
│ │  - Brand: UPA-GURU    │ │ [Mobile Menu] [Breadcrumb] [User Badge] [Exit]│ │
│ │    Admin Portal       │ ├───────────────────────────────────────────────┤ │
│ │  - Dashboard          │ │                                               │ │
│ │  - Draft Queue (HITL) │ │ Admin Page Slot: <main id="admin-main-area">  │ │
│ │  - Exams Master       │ │                                               │ │
│ │  - Notifications      │ │ (/admin, /admin/drafts, /admin/audit-logs)    │ │
│ │  - Audit Logs         │ │                                               │ │
│ │  -------------------  │ │                                               │ │
│ │  - View Live Portal ↗ │ │                                               │ │
│ └───────────────────────┘ └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Breakdown & Specifications

### 3.1 Admin Sidebar (`components/admin/AdminSidebar.tsx`)
* **State & Props**:
  - `isMobileOpen`: boolean controlling mobile overlay visibility.
  - `onMobileClose`: callback invoked on backdrop click or close button.
* **Navigation Items**:
  | Route | Label | Icon | Test ID |
  | :--- | :--- | :--- | :--- |
  | `/admin` | Dashboard | `LayoutDashboard` | `admin-nav-dashboard` |
  | `/admin/drafts` | Draft Queue | `ClipboardCheck` | `admin-nav-drafts` |
  | `/admin/exams` | Exams Master | `GraduationCap` | `admin-nav-exams` |
  | `/admin/notifications` | Notifications | `Bell` | `admin-nav-notifications` |
  | `/admin/audit-logs` | Audit Logs | `ShieldAlert` | `admin-nav-audit-logs` |
  | `/` | Candidate Portal | `ExternalLink` | `admin-nav-live-portal` |

### 3.2 Admin Header (`components/admin/AdminHeader.tsx`)
* **Identity Badge**: Displays user's full name (or email fallback) and formatted role badge (`Super Admin` in purple badge or `Admin` in emerald badge).
* **Sign Out Handler**: Executes `supabase.auth.signOut()` via `@/lib/supabase/client` and pushes user to `/auth/login`.
* **Testing IDs**:
  - `admin-header`
  - `admin-sidebar-toggle-btn`
  - `admin-user-profile-badge`
  - `admin-user-role-tag`
  - `admin-logout-btn`

### 3.3 Root Admin Layout (`app/admin/layout.tsx`)
* **Server Verification**: Reads user session from `createServerClient()` and queries `profiles.role`.
* **Unauthorized Handling**:
  - Unauthenticated -> `redirect("/auth/login?returnTo=/admin")`
  - Authenticated non-admin -> `redirect("/")`
* **Metadata**: Injects `robots: { index: false, follow: false }` to block web crawlers.

---

## 4. Security & Compliance Guardrails
1. **Mandatory RLS**: All administrative sessions and audit records require PostgreSQL Row Level Security.
2. **Zero Hardcoded Secrets**: Leverages Next.js cookies and environment variables exclusively.
3. **Accessibility**: Implements ARIA landmarks (`role="navigation"`, `role="banner"`, `aria-label="Admin Navigation"`, `aria-modal="true"`).
4. **Execution Safety**: Complies with "Do not test. Do not deploy." guardrail during task generation.
