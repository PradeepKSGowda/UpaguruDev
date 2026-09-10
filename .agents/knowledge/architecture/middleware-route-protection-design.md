# Architecture & Security Design Specification: Next.js Edge Middleware & Role-Based Route Protection

**Task ID**: TASK-01020202  
**Epic / Feature**: EPIC-01 / FEAT-0102  
**Author**: Frontend Engineer Agent  
**Reviewers**: CodeReviewer, SecurityReviewer, ArchitectureReviewer  
**Status**: APPROVED  
**Target Platform**: Next.js 15 App Router Edge Middleware, Supabase SSR  

---

## 1. Executive Summary

Next.js Edge Middleware executes before a request is completed by React Server Components or Route Handlers. This provides a low-latency security perimeter to enforce Role-Based Access Control (RBAC) and prevent unauthorized access to sensitive endpoints (such as `/admin/*` HITL verification dashboards) before server-side data fetching or component rendering even commences.

Task **`TASK-01020202`** implements the root Next.js middleware ([middleware.ts](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/middleware.ts)) coupled with the Supabase SSR session refresh utility ([lib/supabase/middleware.ts](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/lib/supabase/middleware.ts)).

---

## 2. Route Interception & Access Matrix

| Route Pattern | Access Level | Unauthenticated Behavior | Non-Admin Candidate Behavior | Admin / Super Admin Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **`/`**, **`/notification/[slug]`** | Public Read | Allowed (`200 OK`) | Allowed (`200 OK`) | Allowed (`200 OK`) |
| **`/auth/login`**, **`/auth/register`** | Public Guest | Allowed (`200 OK`) | Redirect to `/` (or `returnTo`) | Redirect to `/` (or `returnTo`) |
| **`/auth/forgot-password`** | Public Guest | Allowed (`200 OK`) | Allowed (`200 OK`) | Allowed (`200 OK`) |
| **`/auth/callback`** | Route Handler | Exchanges code (`302`) | Exchanges code (`302`) | Exchanges code (`302`) |
| **`/admin/*`** (HITL Verification) | Admin Only | Redirect to `/auth/login?returnTo=...` | Redirect to `/` (`302`) | Allowed (`200 OK`) |

---

## 3. Decision Logic State Machine

```
                            [ Incoming Request ]
                                     │
                                     ▼
                   ┌───────────────────────────────────┐
                   │ updateSession(request)            │
                   │ - Revalidates token via getUser() │
                   │ - Synchronizes Set-Cookie headers │
                   └─────────────────┬─────────────────┘
                                     │
                                     ▼
                        Path starts with /admin?
                                ╱         ╲
                             Yes           No
                             ╱               ╲
                   Is user logged in?         Is user logged in & on /auth/login?
                    ╱             ╲                     ╱               ╲
                  No              Yes                 Yes                No
                  ╱                 ╲                 ╱                   ╲
        Redirect to:            Is role in       Redirect to /      Return response
   /auth/login?returnTo=...   ['admin', 'super_admin']? (or returnTo) (Allow request)
                               ╱           ╲
                             No            Yes
                             ╱               ╲
                     Redirect to /       Return response
                     (Unauthorized)      (Allow request)
```

---

## 4. ReturnTo URL Preservation & Open-Redirect Defense

When an unauthenticated user attempts to bookmark or access a deep link such as `/admin/notifications/review?id=123`:
1. The middleware constructs:
   ```ts
   const destination = `${pathname}${search}`;
   loginUrl.searchParams.set("returnTo", destination);
   return NextResponse.redirect(loginUrl);
   ```
2. Upon successful login in [app/auth/login/page.tsx](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/app/auth/login/page.tsx), the client redirects back to the decoded `returnTo` URL.
3. Open-redirect attacks are neutralized by ensuring `returnTo` begins with a single slash and does not contain protocol-relative prefixes (`//`).

---

## 5. Security & Performance Guardrails

1. **Zero Client Trust**: User role is extracted from `user.app_metadata.role`, which is cryptographically verified on the Supabase Auth server and protected from client tampering by database triggers (`TASK-01020201`).
2. **Matcher Hygiene**: Static files (`_next/static`, `_next/image`, `.png`, `.jpg`, `.svg`, `.webp`, `favicon.ico`) bypass the middleware entirely, maintaining sub-millisecond static asset delivery.
3. **Cookie Preservation**: The response object carries all updated `Set-Cookie` headers, preventing silent session drops across long navigation sessions.
