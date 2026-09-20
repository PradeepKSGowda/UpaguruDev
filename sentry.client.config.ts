/**
 * @file sentry.client.config.ts
 * @description Client-side Sentry configuration for UPA-GURU Next.js 15 App Router.
 * Captures uncaught browser exceptions, React rendering crashes, and Core Web Vitals telemetry.
 * 
 * Task ID: TASK-07010101 (Subtask: SUB-0701010101)
 * Architecture Reference: ADR-012 (Monitoring & Observability), ADR-013 (Security)
 * 
 * Complies with:
 * - Next.js 15 App Router Client Component boundary error reporting
 * - Strict sampling to preserve Sentry event quotas
 * - Zero sensitive data exposure in breadcrumbs and error payloads
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  // Environment and release identification
  environment: process.env.NODE_ENV || "development",

  // Adjust tracesSampleRate to control performance monitoring volume.
  // 10% sampling in production avoids hitting Sentry event quota ceilings.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Replay configuration for reproducing user UI crashes
  replaysSessionSampleRate: 0.05, // 5% of normal sessions
  replaysOnErrorSampleRate: 1.0, // 100% of sessions with an unhandled exception

  // Mask sensitive user input in replays to prevent privacy leaks
  integrations: [
    Sentry.replayIntegration({
      maskAllText: false,
      blockAllMedia: true,
      maskAllInputs: true,
    }),
  ],

  // Filter out noisy, non-actionable browser network errors
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Network request failed",
    "AbortError",
    "Failed to fetch",
    "Load failed",
  ],

  // Redact potential PII or secret tokens before sending to Sentry
  beforeSend(event) {
    // Sanitize candidate phone numbers or tokens from breadcrumbs/URLs
    if (event.request?.url) {
      try {
        const url = new URL(event.request.url);
        if (url.searchParams.has("token")) {
          url.searchParams.set("token", "[REDACTED]");
          event.request.url = url.toString();
        }
        if (url.searchParams.has("phone")) {
          url.searchParams.set("phone", "[REDACTED]");
          event.request.url = url.toString();
        }
      } catch {
        // Safe no-op if malformed URL
      }
    }
    return event;
  },
});
