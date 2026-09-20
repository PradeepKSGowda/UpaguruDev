# Sentry Full-Stack Observability & Error Tracking Architecture

## 1. Executive Summary & Context
In accordance with **ADR-013 (Observability, Analytics & Error Tracking)**, UPA-GURU requires real-time exception monitoring, stack trace demangling, and user privacy protection across all execution environments. Because government recruitment portals experience high-traffic surges during examination announcements and application deadlines, runtime failures must be detected and triaged immediately.

Executing **TASK-07010101** (`SUB-0701010101` & `SUB-0701010102`) establishes the full-stack Sentry integration for Next.js 15 App Router across browser client, Node.js server, and Edge middleware runtimes.

---

## 2. Triple-Runtime Error Capture Architecture

```
                                Candidate Browser
                                       │
                    ┌──────────────────┴──────────────────┐
                    │ Client Runtime (React 19 / Browser) │
                    │   - sentry.client.config.ts         │
                    │   - app/global-error.tsx            │
                    │   - Session replay on error (100%)  │
                    │   - PII Scrubbing (Phone, Tokens)   │
                    └──────────────────┬──────────────────┘
                                       │
                         Edge & CDN Ingestion (Vercel)
                                       │
                    ┌──────────────────┴──────────────────┐
                    │ Edge Runtime (Next.js Middleware)   │
                    │   - sentry.edge.config.ts           │
                    │   - Edge route exception handling   │
                    └──────────────────┬──────────────────┘
                                       │
                         Application Server (Node.js)
                                       │
                    ┌──────────────────┴──────────────────┐
                    │ Server Runtime (Node.js / RSC)      │
                    │   - sentry.server.config.ts         │
                    │   - instrumentation.ts              │
                    │   - onRequestError hook             │
                    │   - Secret & auth header redaction  │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                       Sentry SaaS Ingest / Dashboard
                                       │
                                       ▼
                 Supabase error_telemetry_logs (Audit Ledger)
```

---

## 3. Configuration & Runtime Components

| File | Runtime / Scope | Key Responsibilities |
| :--- | :--- | :--- |
| **`sentry.client.config.ts`** | Browser / Client | Initializes `@sentry/nextjs` for candidate browser sessions. Includes `replayIntegration`, 10% trace sampling, 100% replay sampling on error, and client-side PII masking. |
| **`sentry.server.config.ts`** | Node.js Server / RSC | Captures Server Component rendering exceptions, Server Action failures, and API route crashes. Strips `Authorization`, `cookie`, and sensitive database connection strings. |
| **`sentry.edge.config.ts`** | Edge Runtime | Monitors Edge middleware executions (`middleware.ts`), rate limiter invocations, and route redirects. |
| **`instrumentation.ts`** | Next.js 15 Lifecycle | Implements `register()` hook to dynamically load server and edge runtime sentry configs, and exports `onRequestError = Sentry.captureRequestError` for universal request error capture. |
| **`app/global-error.tsx`** | Root Error Boundary | Client component catching catastrophic root layout errors, reporting error digests to Sentry, and providing an accessible recovery UI. |
| **`next.config.mjs`** | Build & Bundling | Configures `withSentryConfig` with hidden public source maps (`hideSourceMaps: true`), source map upload via `SENTRY_AUTH_TOKEN`, and CSP directives permitting `connect-src https://*.sentry.io`. |

---

## 4. Privacy, PII Protection & Data Scrubbing

Candidate confidentiality is paramount. Sentry client and server configs implement `beforeSend` sanitization hooks:
1. **Header Scrubbing**: Sensitive HTTP headers (`authorization`, `cookie`, `set-cookie`, `x-supabase-key`) are redacted.
2. **PII Masking**: Indian mobile numbers (`+91` / 10-digit formats), email addresses, and JWT tokens are matched by regular expressions and replaced with `[REDACTED]`.
3. **Session Replay Privacy**: Mask all text inputs and block all media recording by default (`maskAllText: true`, `blockAllMedia: true`).
4. **Environment Tagging**: Events are tagged by runtime environment (`development`, `staging`, `production`) and release SHA.

---

## 5. Build Pipeline & Source Map Security

Source maps allow engineering teams to inspect original TypeScript code lines and function names without leaking proprietary code to candidate browsers:
- **`hideSourceMaps: true`**: Deletes client-accessible `.map` files from the public output directory after uploading to Sentry.
- **`widenClientFileUpload: true`**: Ensures all chunk bundles have corresponding source map coverage.
- **`disableLogger: true`**: Reduces build bundle footprint by tree-shaking Sentry logging machinery.

---

## 6. PostgreSQL Telemetry Synchronization

All fatal or unhandled application errors can be audited directly within Supabase via `public.error_telemetry_logs`:
- **RLS Policy**: Row-Level Security enabled. Admins have read access; public client and backend services can append error logs; deletions restricted to super admins.
- **Indexing**: Optimized indexes on `created_at DESC`, `(runtime, environment)`, and `error_digest` for rapid diagnosis during production incidents.
