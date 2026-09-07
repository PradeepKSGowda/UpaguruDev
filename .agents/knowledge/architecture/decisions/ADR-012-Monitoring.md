# ADR-012: Observability, Error Tracking & Health Auditing

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
UPA-GURU operates automated Python web scrapers, LLM extraction pipelines, dynamic SSR candidate pages, and instant push alert engine integrations. A failure in any part of this stack (e.g. government portal HTML structure changes breaking a crawler, Gemini API rate limits, or client-side JavaScript crashes) must be detected and alerted immediately.

Monitoring requirements:
- Real-time error monitoring across Next.js frontend, Node.js server actions, and Python crawlers.
- Core Web Vitals performance auditing to maintain Lighthouse performance standards ($\ge 95$).
- Automated crawler heartbeat monitoring to alert engineering if daily government scraper jobs fail.

## Decision Outcome
Adopt a **Unified Observability Architecture**:
- **Application Error Tracking**: **Sentry** (Full-Stack JS/TS + Python).
- **Core Web Vitals & Real User Monitoring**: **Vercel Analytics & Speed Insights**.
- **Scraper Uptime & Heartbeat**: **Healthchecks.io** + **Telegram Admin Alerts**.

## Architecture Blueprint

```
     ┌────────────────────────┐    ┌────────────────────────┐    ┌────────────────────────┐
     │  Next.js Candidate App │    │ Python Scraper Worker  │    │  Supabase PostgreSQL   │
     └───────────┬────────────┘    └───────────┬────────────┘    └───────────┬────────────┘
                 │                             │                             │
                 ▼                             ▼                             ▼
     ┌────────────────────────┐    ┌────────────────────────┐    ┌────────────────────────┐
     │  Sentry Error Logger   │    │ Healthchecks Heartbeat │    │  Supabase Metrics Logs │
     └────────────────────────┘    └────────────────────────┘    └────────────────────────┘
```

## Monitoring Configuration Details

### 1. Sentry Full-Stack Integration
- Client-side error boundaries capture uncaught React rendering crashes.
- Next.js Server Actions log API failure stack traces without exposing secrets.
- Python crawler catches HTTP connection timeouts and LLM parsing exceptions.

### 2. Core Web Vitals Tracking
- Vercel Speed Insights continuously records real-user metrics for Largest Contentful Paint (LCP $< 2.5\text{s}$), Interaction to Next Paint (INP $< 200\text{ms}$), and Cumulative Layout Shift (CLS $< 0.1$).

### 3. Crawler Heartbeat & Alarm System
- Scraper sends a success ping to Healthchecks.io upon completing daily portal checks.
- If a scraper misses its ping window or encounters low confidence scores ($< 0.50$), an instant alarm is dispatched to the Admin Telegram channel.

## Consequences

### Positive
- Zero silent failures: Scraper breakdowns or LLM API outages are detected within minutes.
- Empirically verifies Core Web Vitals performance targets.
- Preserves complete diagnostic stack traces for rapid bug resolution.

### Negative
- Sentry event quota must be managed using sample rates (e.g. 10% sampling on high-volume page views).

## Compliance & Guardrails
- Complies strictly with `.agents/rules/AGENTS.md` Rule 2 (Inspect logs & stack traces before diagnosing errors; no silent swallowing of errors).
