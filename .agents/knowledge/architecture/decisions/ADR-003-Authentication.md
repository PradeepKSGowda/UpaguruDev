# ADR-003: Authentication & Authorization (RBAC) Strategy

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
UPA-GURU serves two distinct user personas:
1. **Public Candidates**: Browsing exam notifications, setting up channel preferences (Telegram, Web Push), and saving favorite exams.
2. **Admin & HITL Verifiers**: Reviewing raw AI-parsed draft notifications, editing extracted job parameters, publishing live notifications, and auditing crawler operations.

The system requires a unified, secure authentication mechanism that seamlessly integrates with database Row Level Security (RLS) policies and Role-Based Access Control (RBAC).

## Decision Outcome
Adopt **Supabase Auth** (JWT-based identity) integrated with **Role-Based Access Control (RBAC)** embedded directly in JWT token claims (`auth.jwt() ->> 'role'`).

## Authorization Model & Roles

| Role | Access Level | Description |
| :--- | :--- | :--- |
| **`Guest`** | Public Read Only | Can view published notifications, search exams, and view static SEO pages. |
| **`Candidate`** | User Self-Service | Can register, sign in, manage own subscription preferences, and save bookmarks. |
| **`Moderator`** | Content Editor | Can view and edit raw scraper output in `draft_notifications`. |
| **`Admin`** | Full Control | Full CRUD on `exams` and `notifications`, approves/publishes drafts, writes `audit_logs`. |
| **`Super Admin`** | System & Security | Manages team permissions, database migrations, and scraper configuration. |

## Authentication Flow & Security

### 1. Token Strategy
- **Access Tokens**: Short-lived JSON Web Tokens (JWT) (15-60 minute expiry).
- **Refresh Tokens**: Long-lived HTTP-only secure cookies with automatic rotation.

### 2. Supported Auth Methods
- **Email + Password**: Mandatory email confirmation before session issuance (`enable_confirmations = true`), preventing unverified accounts.
- **Social Login (Google OAuth 2.0)**: PKCE flow via `@supabase/ssr` with credentials managed through environment variables (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).
- **Passwordless Magic Links**: Secure email-based OTP/Magic Link with a 300-second expiration window.

### 3. Database RLS & Custom Claims Hook Integration
Supabase passes the user's JWT context directly to PostgreSQL. To provide zero-latency RLS verification, a custom access token hook (`public.custom_access_token_hook`) injects the user's authoritative role from `public.profiles` directly into JWT claims (`auth.jwt() ->> 'role'`).

Row Level Security policies evaluate access rules automatically without requiring intermediate application-level checks:
```sql
CREATE POLICY "Admin Full Access Notifications" ON public.notifications
    FOR ALL USING (auth.jwt() ->> 'role' = 'admin');
```

Detailed technical design and DDL migrations:
- **Design Spec**: [auth-provider-design.md](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/architecture/auth-provider-design.md)
- **Database Schema**: [auth-schema-v1.sql](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/database/auth-schema-v1.sql)

## Consequences

### Positive
- Zero server state: Stateless JWT authentication scales across Vercel Edge functions.
- Tight database coupling: PostgreSQL RLS prevents unauthorized data leaks even if an API route handler omits an explicit check.
- Built-in rate limiting, brute-force mitigation, and automated email verification handling.
- Deterministic profile synchronization via `public.handle_new_auth_user()` trigger.

### Negative
- Custom claims require explicit database triggers and security definer functions to manage role assignments and prevent privilege escalation.

## Compliance & Guardrails
- Complies strictly with `.agents/rules/AGENTS.md` Rule 1 (No Hardcoded Secrets), Rule 2 (No symptom masking), and Rule 3 (Role-Based Access Control & RLS).
- Implemented via Task [TASK-01020101](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/architecture/auth-provider-design.md) (Auth Providers & Schema) and [TASK-01020102](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/architecture/supabase-client-wrappers-design.md) (Next.js 15 Client Wrappers).