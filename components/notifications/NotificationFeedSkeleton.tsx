/**
 * @file components/notifications/NotificationFeedSkeleton.tsx
 * @module NotificationFeedSkeleton
 * @description Suspense fallback grid matching NotificationFeed exact dimensions to ensure zero Cumulative Layout Shift (CLS).
 * 
 * Task ID: TASK-02020104 (Subtask: SUB-0202010401)
 * Architecture Reference: ADR-001 (React Suspense Streaming), ADR-008 (Lighthouse CLS = 0)
 */

import SkeletonCard from "./SkeletonCard";

export default function NotificationFeedSkeleton() {
  return (
    <div
      id="notification-feed-skeleton"
      data-testid="notification-feed-skeleton"
      aria-label="Loading notifications"
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 w-full"
    >
      {Array.from({ length: 6 }).map((_, index) => (
        <SkeletonCard key={index} idSuffix={index + 1} />
      ))}
    </div>
  );
}
