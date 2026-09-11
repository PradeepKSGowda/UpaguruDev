/**
 * @file components/notifications/Breadcrumb.tsx
 * @module Breadcrumb
 * @description Accessible, SEO-friendly breadcrumb navigation component with structured microdata.
 * 
 * Task ID: TASK-02030102 (Subtask: SUB-0203010201)
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-008 (SEO Breadcrumbs)
 */

import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export default function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav
      id="notification-breadcrumb"
      data-testid="notification-breadcrumb"
      aria-label="Breadcrumb"
      className="flex items-center text-xs text-text-muted overflow-x-auto py-2"
    >
      <ol className="flex items-center space-x-2 whitespace-nowrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center">
              {index > 0 && (
                <svg
                  className="mx-2 h-3.5 w-3.5 text-border"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}

              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-primary transition-colors focus:outline-none focus:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={isLast ? "font-semibold text-text-primary truncate max-w-[200px] sm:max-w-xs" : ""}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
