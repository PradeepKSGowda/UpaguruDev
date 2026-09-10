# Architecture & UI/UX Design Specification: Authentication Pages & OAuth Callback

**Task ID**: TASK-01020103  
**Epic / Feature**: EPIC-01 / FEAT-0102  
**Author**: Frontend Engineer Agent  
**Reviewers**: CodeReviewer, SecurityReviewer, ArchitectureReviewer, UIUXDesigner  
**Status**: APPROVED  
**Target Platform**: Next.js 15 App Router, React 19, Supabase Auth (@supabase/ssr)  

---

## 1. Executive Summary

Authentication in UPA-GURU is designed for high candidate conversion, mobile responsiveness, and zero-trust security. 

Task **`TASK-01020103`** implements the public authentication UI layer across four distinct endpoints:
1. **`/auth/login`**: Sign-in page supporting Email/Password and Google OAuth 2.0 PKCE.
2. **`/auth/register`**: Candidate account creation with real-time Zod schema validation and email confirmation notice.
3. **`/auth/forgot-password`**: Self-service password recovery email and passwordless Magic Link dispatch.
4. **`/auth/callback`**: Next.js Route Handler exchanging cryptographic authorization codes for server cookies, featuring strict open-redirect sanitization.

All views share an accessible layout ([app/auth/layout.tsx](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/app/auth/layout.tsx)) with responsive mobile styling, dark mode support, and WCAG 2.1 AA compliant color contrast and focus rings.

---

## 2. Authentication Architecture & Flow Diagrams

### 2.1 Google OAuth 2.0 PKCE Flow
```
[ Browser Client ]                     [ Next.js Server ]                [ Google / Supabase Auth ]
        │                                      │                                      │
        │── 1. Click "Continue with Google" ───┼─────────────────────────────────────>│
        │      (Generates PKCE verifier)       │                                      │
        │                                      │                                      │
        │<───── 2. Consent Screen / Auth Callback with ?code=xyz ─────────────────────│
        │                                      │                                      │
        │── 3. GET /auth/callback?code=xyz ───>│                                      │
        │                                      │── 4. exchangeCodeForSession(code) ──>│
        │                                      │<── 5. Session JWT & Cookies ─────────│
        │<───── 6. 302 Redirect to / ──────────┼──────────────────────────────────────│
        │      (with Set-Cookie headers)       │                                      │
```

### 2.2 Email / Password Registration & Verification
```
[ Candidate Form ]                   [ Next.js Browser Client ]            [ Supabase Auth Engine ]
        │                                      │                                      │
        │── 1. Enters Name, Email, Password ───│                                      │
        │── 2. Local Zod Validation ──────────>│                                      │
        │                                      │── 3. supabase.auth.signUp() ────────>│
        │                                      │                                      │
        │                                      │                                      │ [PostgreSQL Trigger]
        │                                      │                                      │ handle_new_auth_user()
        │                                      │                                      │ -> Upserts profiles
        │                                      │                                      │ -> Inits subscriptions
        │                                      │                                      │ -> Dispatches verification
        │<── 4. Render "Check Your Email" ─────┼──────────────────────────────────────│
```

---

## 3. Zod Schema Specifications (`lib/schemas/auth.ts`)

| Schema Name | Target Form | Key Fields | Constraints |
| :--- | :--- | :--- | :--- |
| **`loginSchema`** | `/auth/login` | `email`, `password` | Valid email format, non-empty password (min 8 chars). |
| **`registerSchema`** | `/auth/register` | `fullName`, `email`, `password`, `confirmPassword` | Min 2 chars for name; min 8 chars password with uppercase, lowercase, and digit; password equality check. |
| **`forgotPasswordSchema`** | `/auth/forgot-password` | `email` | Standard email format with trim. |
| **`magicLinkSchema`** | `/auth/forgot-password` | `email` | Standard email format with trim. |

---

## 4. Open-Redirect Security Defenses (`/auth/callback`)

The callback handler strictly sanitizes the `next` destination parameter via `getSafeRedirectUrl`:
* Rejects protocol-relative URLs (e.g., `//attacker.com`).
* Rejects backslash bypasses (e.g., `/\attacker.com`).
* Rejects explicit schemas (e.g., `https://attacker.com`).
* Enforces that paths begin strictly with a single `/`.
* Falls back safely to `/` for any unverified input.

---

## 5. UI/UX Accessibility (WCAG 2.1 AA)

1. **Focus Rings**: All interactive inputs, buttons, and links feature `focus:ring-2 focus:ring-blue-600 focus:outline-none`.
2. **Error Semantics**: Error alerts use `role="alert"` and `aria-live="assertive"` for immediate screen reader announcement. Form fields reference errors using `aria-invalid` and `aria-describedby`.
3. **Contrast Ratio**: Meets minimum 4.5:1 text-to-background contrast across light and dark modes.
4. **Test Locators**: Unique `id` and `data-testid` attributes assigned to every interactive form element for automated Playwright E2E testing.
