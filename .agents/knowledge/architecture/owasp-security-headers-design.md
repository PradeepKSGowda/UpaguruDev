# OWASP Security Headers & CORS Configuration Design

**Task ID**: `TASK-01030103`  
**Subtasks**: `SUB-0103010301`  
**Epic / Feature**: `EPIC-01` / `FEAT-0103`  
**Architecture Reference**: [ADR-001-Frontend.md](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/architecture/decisions/ADR-001-Frontend.md), [ADR-013-Security.md](file:///d:/Prajna%20Development/Dev%20Projects/upaguru/.agents/knowledge/architecture/decisions/ADR-013-Security.md)

---

## 1. Executive Summary

`TASK-01030103` completes the production hardening of the Next.js 15 App Router platform by embedding defense-in-depth HTTP security headers into `next.config.mjs`. These headers eliminate or mitigate the most severe web vulnerabilities highlighted in the OWASP Top 10, including:
- Cross-Site Scripting (XSS)
- Clickjacking and UI Redressing
- MIME Sniffing attacks
- Insecure Transport & Man-in-the-Middle (MitM) eavesdropping
- Unauthorized Cross-Origin API exploitation

---

## 2. Security Headers Specification

### 2.1 Content-Security-Policy (CSP)
- `default-src 'self'`: Restricts external resources by default to the application origin.
- `script-src`: Restricts executable JavaScript to `'self'`, verified analytical providers (Google Analytics, PostHog), and Supabase endpoints.
- `style-src`: Permits local styles and Google Fonts stylesheets.
- `img-src`: Whitelists Supabase storage buckets (`*.supabase.co`), Google user avatars (`lh3.googleusercontent.com`), and inline data URIs.
- `connect-src`: Permits fetch/WebSocket communication exclusively with trusted backend services (Supabase, Upstash Redis, Sentry telemetry).
- `frame-ancestors 'none'`: Fully blocks framing attempts, providing dual protection alongside `X-Frame-Options: DENY`.
- `upgrade-insecure-requests`: Automatically elevates any residual HTTP asset requests to HTTPS.

### 2.2 Clickjacking & Framing Mitigation
- `X-Frame-Options: DENY`: Prevents the UPA-GURU Candidate Portal and Admin HITL dashboards from being embedded in `<iframe>`, `<frame>`, or `<object>` elements.

### 2.3 MIME Confusion & Content Sniffing
- `X-Content-Type-Options: nosniff`: Forces browsers to respect the server-declared `Content-Type`, preventing malicious file uploads disguised as images or text from executing script payloads.

### 2.4 Transport Security & Protocol Enforcement
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`: Enforces strict HTTPS encryption across all subdomains for 2 years and requests inclusion in browser HSTS preload lists.

### 2.5 Privacy & Hardware APIs
- `Referrer-Policy: strict-origin-when-cross-origin`: Strips URL paths and parameters when linking cross-origin, protecting sensitive query params.
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()`: Disables high-risk hardware and tracking APIs.

---

## 3. Cross-Origin Resource Sharing (CORS) Policy

CORS policies are applied specifically to `/api/:path*`:
- `Access-Control-Allow-Origin`: Dynamically bound to `process.env.NEXT_PUBLIC_SITE_URL` (or `https://upaguru.in`).
- `Access-Control-Allow-Methods`: `GET,POST,PUT,DELETE,OPTIONS`.
- `Access-Control-Allow-Headers`: Strictly whitelisted request headers.
- `Access-Control-Allow-Credentials: true`: Enables secure cookie authentication for cross-subdomain administrative calls.

---

## 4. Verification Protocol (Manual)

To verify the presence of all configured headers without running automated test suites:
```bash
curl -I http://localhost:3000/
curl -I -X OPTIONS http://localhost:3000/api/v1/health
```
Every declared security header will be returned in the HTTP response headers.
