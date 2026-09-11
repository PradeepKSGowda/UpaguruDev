/**
 * @file components/notifications/NotificationCard.tsx
 * @module NotificationCard
 * @description React Server Component (RSC) rendering an individual exam notification card
 * with conducting body branding, deadline countdown logic, urgency pulse styling, and responsive layout.
 * 
 * Task ID: TASK-02020102 (Subtask: SUB-0202010201)
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-008 (SEO)
 * 
 * Complies with:
 * - Pure React Server Component (0 client bundle overhead)
 * - WCAG 2.1 AA text contrast across light and dark themes
 * - Interactive landmarks with unique IDs for Playwright test automation
 * - Responsive CSS grid compatibility
 */

import Link from "next/link";
import type { NotificationListItem } from "@/types/notifications";
import { calculateDaysRemaining, formatVacancies, formatDisplayDate, getCategoryBadge } from "@/lib/utils";

interface NotificationCardProps {
  notification: NotificationListItem;
}

/**
 * Server Component rendering an individual exam notification card
 */
export default function NotificationCard({ notification }: NotificationCardProps) {
  const { exam } = notification;
  const urgency = calculateDaysRemaining(notification.applicationEndDate);
  const categoryMeta = getCategoryBadge(exam.category);

  return (
    <article
      id={`notification-card-${notification.slug}`}
      data-testid="notification-card"
      data-slug={notification.slug}
      data-category={exam.category}
      data-urgency={urgency.level}
      className="group relative flex flex-col justify-between rounded-xl border border-border bg-surface dark:bg-surface-elevated/40 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-primary/50 hover:shadow-md"
    >
      {/* Top Meta Bar: Conducting Body & Category */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <span
              id={`card-conducting-body-${notification.slug}`}
              className="text-xs font-semibold uppercase tracking-wider text-text-muted"
            >
              {exam.conductingBody}
            </span>
            <span className="text-border">•</span>
            <span
              id={`card-state-${notification.slug}`}
              className="inline-flex items-center rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] font-medium text-text-secondary border border-border/60"
            >
              {exam.stateOrCentral}
            </span>
          </div>

          {/* Category Badge */}
          <span
            id={`card-category-${notification.slug}`}
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${categoryMeta.badgeClass}`}
          >
            {categoryMeta.label}
          </span>
        </div>

        {/* Notification Title & Notification Number */}
        <div className="pt-3">
          {notification.notificationNumber && (
            <span
              id={`card-notif-number-${notification.slug}`}
              className="text-[11px] font-mono text-text-muted block mb-1"
            >
              Advt. No: {notification.notificationNumber}
            </span>
          )}

          <h3 className="font-heading text-lg font-bold text-text-primary leading-snug group-hover:text-primary transition-colors line-clamp-2">
            <Link
              href={`/notification/${notification.slug}`}
              id={`notification-title-link-${notification.slug}`}
              className="focus:outline-none focus:underline"
            >
              {notification.title}
            </Link>
          </h3>
        </div>

        {/* Key Metrics: Vacancies & Education */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs py-2.5 px-3 rounded-lg bg-surface-elevated/70 border border-border/40">
          <div>
            <span className="text-text-muted block text-[11px]">Total Vacancies</span>
            <span
              id={`card-vacancies-${notification.slug}`}
              className="font-bold text-text-primary text-sm tracking-tight"
            >
              {formatVacancies(notification.totalVacancies)}
            </span>
          </div>
          <div>
            <span className="text-text-muted block text-[11px]">Qualification</span>
            <span
              id={`card-qualification-${notification.slug}`}
              className="font-medium text-text-secondary truncate block"
              title={notification.qualificationRequired.join(", ") || "Refer Notification"}
            >
              {notification.qualificationRequired[0] || "Refer Notification"}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Footer: Deadline Countdown & Action CTA */}
      <div className="mt-5 pt-3 border-t border-border/50 flex items-center justify-between gap-2">
        {/* Deadline Badge with Urgency Pulse */}
        <div className="flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-text-muted tracking-wider">
            Last Date: {formatDisplayDate(notification.applicationEndDate)}
          </span>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              id={`card-deadline-badge-${notification.slug}`}
              data-testid="deadline-badge"
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs border ${urgency.badgeClass} ${urgency.pulseClass}`}
            >
              {urgency.isUrgent && (
                <span className="h-1.5 w-1.5 rounded-full bg-danger animate-ping" />
              )}
              {urgency.label}
            </span>
          </div>
        </div>

        {/* View Details Link Button */}
        <Link
          href={`/notification/${notification.slug}`}
          id={`notification-action-btn-${notification.slug}`}
          data-testid="view-details-btn"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-dark transition-colors group-hover:translate-x-0.5 duration-200"
          aria-label={`View details for ${notification.title}`}
        >
          <span>Details</span>
          <svg
            className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </article>
  );
}
