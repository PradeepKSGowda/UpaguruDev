# Technical Design: Supabase Auth Providers & RBAC Integration

**Task ID**: `TASK-01020101`  
**Feature**: `FEAT-0102` (Supabase Auth Integration & RBAC Role Configuration)  
**Epic**: `EPIC-01` (Foundation: Database, Auth & Hosting Infrastructure)  
**Assigned Agent**: `DevOps Engineer`  
**Reviewing Agents**: `DevOps Reviewer`, `Security Reviewer`  
**Status**: `Completed` (Design & Schema Specification)  
**Compliance**: Complies with ADR-003, ADR-013, and AGENTS.md (Rules 1, 2, 3)

---

## 1. Executive Summary & Objectives
The UPA-GURU platform serves two fundamental personas:
1. **Public Candidates**: Seeking pan-India exam alerts, bookmarks, and omnichannel notifications (Web Push, Telegram, WhatsApp).
2. **Admin & HITL Operators**: Reviewing AI-extracted raw draft notifications, validating dates/eligibility, publishing notifications, and monitoring crawler tasks.

`TASK-01020101` establishes the foundational authentication layer on Supabase Auth, enabling three identity providers:
- **Email/Password Provider**: With mandatory email verification before login.
- **Google OAuth 2.0 Provider**: For frictionless single-click registration/login.
- **Magic Link Provider**: For secure passwordless authentication.

It pairs these providers with a database-backed Role-Based Access Control (RBAC) model, automated user profile synchronization, and JWT claim injection for seamless Row Level Security (RLS) enforcement.

---

## 2. Authentication Provider Architecture

```
                                  +---------------------------------------+
                                  |         Candidate / Admin UI          |
                                  |         (Next.js 15 App Router)       |
                                  +---------------------------------------+
                                        /            |             \
                     [Email + Password]              | [Google]     \ [Magic Link]
                                      /              |               \
                                     v               v                v
                 +-------------------------------------------------------------+
                 |                     Supabase Auth (GoTrue)                  |
                 +-------------------------------------------------------------+
                     |                     |                         |
            [Verify Email Link]    [Google Cloud OAuth 2.0]     [Magic Link Email]
                     |                     |                         |
                     +---------------------+-------------------------+
                                           |
                                           v [Session Established]
                 +-------------------------------------------------------------+
                 |              PostgreSQL Trigger: handle_new_auth_user()     |
                 +-------------------------------------------------------------+
                         |                                           |
                         v                                           v
                 +----------------+                          +--------------------+
                 | public.profiles|                          | user_subscriptions |
                 | (Role, Status) |                          | (Alert Preferences)|
                 +----------------+                          +--------------------+
                         |
                         v
                 +-------------------------------------------------------------+
                 |          Supabase Custom Claims Hook (custom_access_token_hook)
                 |         Embeds 'role' claim into JWT for Instant RLS        |
                 +-------------------------------------------------------------+
```

---

## 3. Detailed Provider Specifications

### 3.1 Email / Password Provider (SUB-0102010101)
* **Configuration**:
  - `auth.email.enable_signup`: `true`
  - `auth.email.enable_confirmations`: `true` (Mandatory confirmation before session issue)
  - `auth.email.double_confirm_changes`: `true` (Email updates require confirmation on old and new email)
  - `auth.email.secure_password_hash`: Bcrypt / Argon2 (Managed by Supabase GoTrue)
  - Password Policy: Minimum 8 characters, requiring at least one number, one uppercase letter, and one special character.
* **Flow**:
  1. Candidate submits email and password on `/register`.
  2. Next.js Server Action invokes `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${origin}/auth/callback` } })`.
  3. Supabase Auth creates an unconfirmed user record in `auth.users` (`email_confirmed_at = NULL`) and dispatches a verification token link.
  4. Candidate receives email: *"Confirm your UPA-GURU registration"*.
  5. Clicking verification link directs user to `/auth/callback?code=...`.
  6. Callback route exchanges code via `@supabase/ssr` PKCE exchange, setting session cookies.
  7. Trigger `on_auth_user_created` updates `public.profiles.email_verified = true`.

### 3.2 Google OAuth 2.0 Provider (SUB-0102010102)
* **Google Cloud Console Credentials**:
  - Application Type: **Web application**
  - Application Name: **UPA-GURU Identity**
  - Authorized JavaScript origins:
    - `https://upaguru.in`
    - `https://staging.upaguru.in`
    - `http://localhost:3000`
  - Authorized redirect URIs:
    - `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
* **OAuth Scopes**:
  - `openid`
  - `https://www.googleapis.com/auth/userinfo.email`
  - `https://www.googleapis.com/auth/userinfo.profile`
* **Flow**:
  1. Candidate clicks **"Sign in with Google"**.
  2. Client calls `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/callback` } })`.
  3. Redirected to Google consent screen; candidate authorizes profile and email access.
  4. Google redirects back to Supabase Auth callback URL with authorization code.
  5. Supabase Auth processes OAuth token, extracts full name and avatar URL, and upserts user into `auth.users` with `email_confirmed_at = NOW()`.
  6. Trigger `handle_new_auth_user()` populates `public.profiles` with name, avatar, and default role `candidate`.
  7. Browser redirects to candidate dashboard (`/dashboard` or previous browsing state).

### 3.3 Magic Link Passwordless Provider (SUB-0102010103)
* **Configuration**:
  - `auth.email.enable_magic_link`: `true`
  - OTP Expiration: 300 seconds (5 minutes)
  - Rate Limiting: Maximum 3 magic link requests per IP/email per 15-minute window (enforced by Upstash Redis and Supabase rate limiters).
* **Flow**:
  1. Candidate enters email on `/login/magic-link`.
  2. Client calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${origin}/auth/callback` } })`.
  3. One-time authentication link dispatched via email.
  4. User clicks link within 5 minutes.
  5. Browser exchanges OTP code for JWT session via Next.js App Router `/auth/callback` route.
  6. Auto-provisions candidate profile if new user; logs existing user in seamlessly.

---

## 4. Role-Based Access Control (RBAC) & Claims Synchronization

### 4.1 Role Hierarchy
| Role | Access Level | Description |
| :--- | :--- | :--- |
| **`guest`** | Public Read | Unauthenticated visitor; reads published exams and notifications. |
| **`candidate`** | Self-Service User | Authenticated job seeker; manages bookmarks, omnichannel alerts. |
| **`moderator`** | Content Reviewer | Reviewer; reads `draft_notifications`, edits AI-extracted fields. |
| **`admin`** | System Administrator | Full CRUD on notifications, approves drafts, views audit logs. |
| **`super_admin`** | Security Administrator | Manages team roles, system configuration, database migrations. |

### 4.2 Custom Access Token Hook
To avoid costly database roundtrips on every single API request, role information is injected directly into the user's JWT access token using the Supabase Auth Custom Access Token Hook:
```sql
SELECT public.custom_access_token_hook(event);
```
Inside the hook:
1. Looks up the user's authoritative role in `public.profiles`.
2. Injects `'role': '<user_role>'` into JWT `claims`.
3. Supabase signs the JWT with the project's secret key.
4. Subsequent database operations evaluate `auth.jwt() ->> 'role'` directly in memory inside PostgreSQL RLS engines with zero latency overhead.

### 4.3 Safe Role Modification & Audit Trail
- Candidates **cannot** update their own role (guarded by `CHECK` constraints in RLS policy `profiles_update_own`).
- Role elevation is performed exclusively through the stored procedure `public.assign_user_role(target_user_id, new_role)`.
- The procedure verifies that `auth.jwt() ->> 'role'` is `'admin'` or `'super_admin'`.
- Every role modification creates an immutable entry in `public.audit_logs` tracking `admin_id`, `target_user_id`, `previous_role`, `new_role`, and timestamp.

---

## 5. Environment Variables & Secret Configuration

The following variables must be configured in `.env.local` (local development) and Vercel/Supabase dashboard (production). No secrets are hardcoded.

```bash
# Supabase Core (Public)
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Supabase Admin / Service Role (Strictly Server-Side Only)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Google Cloud OAuth 2.0 (Supabase Dashboard > Auth > Providers > Google)
GOOGLE_CLIENT_ID="<client-id>.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="GOCSPX-<client-secret>"

# Auth Redirection & Base URLs
NEXT_PUBLIC_SITE_URL="https://upaguru.in"
NEXT_PUBLIC_AUTH_CALLBACK_URL="https://upaguru.in/auth/callback"
```

---

## 6. Verification Criteria & Acceptance Mapping

| Subtask ID | Acceptance Criteria | Design Artifact / Mechanism |
| :--- | :--- | :--- |
| **`SUB-0102010101`** | New registrations receive verification email; unverified users cannot log in | Supabase Auth `enable_confirmations = true`, `email_confirmed_at` trigger validation |
| **`SUB-0102010102`** | Google login button initiates OAuth flow and returns to callback URL | Google Cloud Console OAuth 2.0 Web Client, PKCE flow via `@supabase/ssr` callback |
| **`SUB-0102010103`** | Magic Link email sent and clicking it authenticates the user | Supabase OTP Mailer integration, 300s token expiry, auto-session establishment |
