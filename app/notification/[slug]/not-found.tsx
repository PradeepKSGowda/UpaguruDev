/**
 * @file app/notification/[slug]/not-found.tsx
 * @module NotificationNotFound
 * @description Branded 404 page displayed when an exam notification slug does not exist or is not published.
 * 
 * Task ID: TASK-02030102
 * Architecture Reference: ADR-001 (Frontend RSC)
 */

import Link from "next/link";

export default function NotificationNotFound() {
  return (
    <div
      id="notification-not-found-container"
      data-testid="notification-not-found"
      className="flex-1 flex flex-col items-center justify-center min-h-[60vh] px-4 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger/10 text-danger mb-4">
        <svg
          className="h-8 w-8"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
          />
        </svg>
      </div>

      <h1 className="font-heading text-2xl sm:text-3xl font-bold text-text-primary mb-2">
        Exam Notification Not Found
      </h1>

      <p className="max-w-md text-sm text-text-secondary leading-relaxed mb-6">
        The exam notification you are looking for may have expired, been archived, or the URL slug might be incorrect.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          id="not-found-home-btn"
          className="rounded-lg bg-primary px-4 py-2.5 text-xs font-semibold text-primary-contrast shadow-sm transition-colors hover:bg-primary-dark"
        >
          Back to Live Feed
        </Link>
        <Link
          href="/categories"
          id="not-found-categories-btn"
          className="rounded-lg border border-border bg-surface px-4 py-2.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-elevated"
        >
          Browse All Categories
        </Link>
      </div>
    </div>
  );
}
