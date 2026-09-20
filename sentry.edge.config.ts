/**
 * @file sentry.edge.config.ts
 * @description Edge runtime Sentry configuration for UPA-GURU Next.js 15 Middleware and Edge Routes.
 * Captures edge routing exceptions and session validation failures.
 * 
 * Task ID: TASK-07010101 (Subtask: SUB-0701010101)
 * Architecture Reference: ADR-012 (Monitoring & Observability), ADR-013 (Security)
 */

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,

  environment: process.env.NODE_ENV || "development",

  // 10% sampling on edge middleware invocations
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});
