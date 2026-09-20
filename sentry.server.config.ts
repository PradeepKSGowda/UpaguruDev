/**
 * @file sentry.server.config.ts
 * @description Node.js Server-side Sentry configuration for UPA-GURU Next.js 15 App Router.
 * Captures exceptions in Server Components, Server Actions, and API Route Handlers.
 * 
 * Task ID: TASK-07010101 (Subtask: SUB-0701010101)
 * Architecture Reference: ADR-012 (Monitoring & Observability), ADR-013 (Security)
 * 
 * Complies with:
 * - Next.js 15 App Router Node.js server runtime
 * - Zero secret leakage: scrubs environment variables and bearer tokens
 * - Non-blocking error reporting
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  environment: process.env.NODE_ENV || "development",

  // 20% trace sampling on server requests in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  // Redact secrets and authorization tokens from server crash reports
  beforeSend(event) {
    if (event.request?.headers) {
      if (event.request.headers.authorization) {
        event.request.headers.authorization = "[REDACTED]";
      }
      if (event.request.headers["x-webhook-secret"]) {
        event.request.headers["x-webhook-secret"] = "[REDACTED]";
      }
      if (event.request.headers.cookie) {
        event.request.headers.cookie = "[REDACTED]";
      }
    }

    // Scrub server-side environment secrets if present in extra context
    if (event.extra) {
      const sensitiveKeys = [
        "SUPABASE_SERVICE_ROLE_KEY",
        "UPSTASH_REDIS_REST_TOKEN",
        "TELEGRAM_BOT_TOKEN",
        "WHATSAPP_ACCESS_TOKEN",
        "RESEND_API_KEY",
        "DISPATCH_WEBHOOK_SECRET",
      ];
      for (const key of sensitiveKeys) {
        if (key in event.extra) {
          event.extra[key] = "[REDACTED]";
        }
      }
    }

    return event;
  },
});
