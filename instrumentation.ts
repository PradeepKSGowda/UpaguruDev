/**
 * @file instrumentation.ts
 * @description Next.js 15 App Router standard instrumentation hook.
 * Registers Sentry error tracking and performance monitoring across Node.js and Edge runtimes.
 * 
 * Task ID: TASK-07010101 (Subtask: SUB-0701010101)
 * Architecture Reference: ADR-012 (Monitoring & Observability)
 */

import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
