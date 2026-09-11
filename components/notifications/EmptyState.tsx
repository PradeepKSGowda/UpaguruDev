/**
 * @file components/notifications/EmptyState.tsx
 * @module EmptyState
 * @description Accessible fallback presentation when no notifications match selected filter criteria.
 * 
 * Task ID: TASK-02020104 (Subtask: SUB-0202010401)
 * Architecture Reference: ADR-001 (Frontend RSC)
 */

import Link from "next/link";

interface EmptyStateProps {
  hasFilters?: boolean;
}

export default function EmptyState({ hasFilters = true }: EmptyStateProps) {
  return (
    <div
      id="notifications-empty-state"
      data-testid="empty-state"
      className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface dark:bg-surface-elevated/20 px-6 py-16 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
        <svg
          className="h-7 w-7"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"
          />
        </svg>
      </div>

      <h3 className="font-heading text-lg font-bold text-text-primary mb-2">
        No Exam Notifications Found
      </h3>

      <p className="max-w-md text-xs text-text-muted leading-relaxed mb-6">
        {hasFilters
          ? "We couldn't find any notifications matching your current filters. Try changing your category, region, or clearing active search keywords."
          : "There are currently no active published notifications. Please check back shortly or subscribe to notifications."}
      </p>

      {hasFilters && (
        <Link
          href="/"
          id="empty-state-reset-btn"
          data-testid="empty-state-reset-btn"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-contrast shadow-sm transition-colors hover:bg-primary-dark"
        >
          <span>View All Notifications</span>
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      )}
    </div>
  );
}
