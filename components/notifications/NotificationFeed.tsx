/**
 * @file components/notifications/NotificationFeed.tsx
 * @module NotificationFeed
 * @description React Server Component (RSC) fetching and rendering the paginated grid of
 * exam notification cards, active filter count, and pagination controls.
 * 
 * Task ID: TASK-02020104 (Subtask: SUB-0202010401)
 * Architecture Reference: ADR-001 (RSC Data Fetching), ADR-008 (SEO & Lighthouse)
 * 
 * Complies with:
 * - Direct asynchronous server data access via getPublishedNotifications()
 * - Responsive 1/2/3-column CSS grid layout
 * - Automated testing landmarks for Playwright
 */

import { getPublishedNotifications } from "@/lib/data/notifications";
import type { NotificationFilterParams } from "@/types/notifications";
import NotificationCard from "./NotificationCard";
import EmptyState from "./EmptyState";
import Pagination from "./Pagination";

interface NotificationFeedProps {
  filters: NotificationFilterParams;
}

export default async function NotificationFeed({ filters }: NotificationFeedProps) {
  const result = await getPublishedNotifications(filters);
  const { data: notifications, total, page, pageSize, totalPages, hasNextPage, hasPreviousPage } = result;

  const hasActiveFilters = Boolean(
    (filters.category && filters.category !== "all") ||
    (filters.state && filters.state !== "all") ||
    (filters.search && filters.search.trim().length > 0) ||
    (filters.sortBy && filters.sortBy !== "deadline_soonest")
  );

  if (notifications.length === 0) {
    return <EmptyState hasFilters={hasActiveFilters} />;
  }

  return (
    <div className="w-full space-y-6">
      {/* Active Results Header */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        <span id="feed-results-count" className="font-medium">
          Found <strong className="text-text-primary">{total}</strong> active notification{total === 1 ? "" : "s"}
        </span>
        {hasActiveFilters && (
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
            Filtered Results
          </span>
        )}
      </div>

      {/* Cards Responsive Grid */}
      <div
        id="notification-feed-grid"
        data-testid="notification-feed-grid"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 w-full"
      >
        {notifications.map((notification) => (
          <NotificationCard key={notification.id} notification={notification} />
        ))}
      </div>

      {/* Pagination Controls */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        hasNextPage={hasNextPage}
        hasPreviousPage={hasPreviousPage}
      />
    </div>
  );
}
