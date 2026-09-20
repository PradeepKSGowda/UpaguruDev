'use client';

/**
 * @file app/global-error.tsx
 * @description Global root error boundary for Next.js 15 App Router.
 * Captures unhandled exceptions at the root layout level, transmits error telemetry
 * to Sentry, and renders an accessible fallback UI with recovery controls.
 * 
 * Task Reference: TASK-07010101 (SUB-0701010101)
 * Architecture Reference: ADR-013 (Observability & Monitoring)
 */

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Transmit root-level unhandled exception to Sentry
    Sentry.captureException(error, {
      extra: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased flex items-center justify-center p-4">
        <main
          role="alert"
          aria-live="assertive"
          className="w-full max-w-md bg-white border border-slate-200 rounded-xl shadow-lg p-6 sm:p-8 text-center"
        >
          {/* Brand Header */}
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-red-100 text-red-600 mb-5">
            <svg
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mb-2">
            Something went wrong
          </h1>

          <p className="text-sm text-slate-600 mb-6 leading-relaxed">
            An unexpected error occurred while loading UPA-GURU. Our telemetry system
            has logged this incident, and our engineering team has been notified.
          </p>

          {error.digest && (
            <div className="mb-6 p-2.5 bg-slate-100 rounded-md text-xs font-mono text-slate-600 select-all break-all">
              Error Digest: {error.digest}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              type="button"
              className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Try Again
            </button>
            <a
              href="/"
              className="w-full sm:w-auto px-5 py-2.5 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-colors text-center focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            >
              Back to Home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
