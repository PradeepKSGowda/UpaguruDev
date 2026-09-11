/**
 * @file components/notifications/SkeletonCard.tsx
 * @module SkeletonCard
 * @description Zero-CLS loading skeleton matching NotificationCard exact visual dimensions
 * for React Suspense fallbacks during asynchronous notification feed streaming.
 * 
 * Task ID: TASK-02020102 (Subtask: SUB-0202010202)
 * Architecture Reference: ADR-001 (Frontend RSC & Suspense), ADR-008 (Lighthouse CLS = 0)
 * 
 * Complies with:
 * - Identical dimensions and padding to NotificationCard (eliminates layout shifts)
 * - Accessible aria-hidden placeholder styling
 * - Automated test landmarks (data-testid="skeleton-card")
 */

interface SkeletonCardProps {
  idSuffix?: string | number;
}

/**
 * Skeleton loading placeholder for NotificationCard
 */
export default function SkeletonCard({ idSuffix = "1" }: SkeletonCardProps) {
  return (
    <div
      id={`notification-card-skeleton-${idSuffix}`}
      data-testid="skeleton-card"
      aria-hidden="true"
      className="flex flex-col justify-between rounded-xl border border-border/60 bg-surface dark:bg-surface-elevated/30 p-5 shadow-sm animate-pulse"
    >
      <div>
        {/* Top Meta Bar Skeleton */}
        <div className="flex items-center justify-between pb-3 border-b border-border/40">
          <div className="flex items-center gap-2">
            {/* Conducting Body */}
            <div className="h-3.5 w-24 rounded bg-border/80" />
            <div className="h-2 w-2 rounded-full bg-border/60" />
            {/* State Pill */}
            <div className="h-4 w-16 rounded-full bg-border/60" />
          </div>
          {/* Category Badge */}
          <div className="h-4 w-20 rounded-full bg-border/70" />
        </div>

        {/* Title Block Skeleton */}
        <div className="pt-3 space-y-2">
          {/* Advt. No */}
          <div className="h-2.5 w-28 rounded bg-border/50" />
          {/* Title Lines */}
          <div className="h-5 w-full rounded bg-border/80" />
          <div className="h-5 w-3/4 rounded bg-border/70" />
        </div>

        {/* Key Metrics Skeleton Box */}
        <div className="mt-4 grid grid-cols-2 gap-2 py-2.5 px-3 rounded-lg bg-surface-elevated/50 border border-border/30">
          <div className="space-y-1.5">
            <div className="h-2.5 w-16 rounded bg-border/50" />
            <div className="h-4 w-20 rounded bg-border/80" />
          </div>
          <div className="space-y-1.5">
            <div className="h-2.5 w-16 rounded bg-border/50" />
            <div className="h-4 w-24 rounded bg-border/70" />
          </div>
        </div>
      </div>

      {/* Bottom Footer Skeleton */}
      <div className="mt-5 pt-3 border-t border-border/40 flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-2 w-20 rounded bg-border/50" />
          <div className="h-5 w-28 rounded-full bg-border/70" />
        </div>
        <div className="h-4 w-14 rounded bg-border/60" />
      </div>
    </div>
  );
}
