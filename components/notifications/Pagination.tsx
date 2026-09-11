/**
 * @file components/notifications/Pagination.tsx
 * @module Pagination
 * @description Accessible pagination navigation component supporting SEO-friendly links,
 * search parameter preservation, ellipsis windowing, and automated Playwright testing landmarks.
 * 
 * Task ID: TASK-02020104 (Subtask: SUB-0202010402)
 * Architecture Reference: ADR-001 (Next.js App Router), ADR-008 (SEO Crawlability)
 */

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Builds a pagination window array with ellipsis (e.g. [1, 2, '...', 7, 8, 9, '...', 20])
 */
function getPaginationRange(currentPage: number, totalPages: number): (number | string)[] {
  const delta = 1;
  const range: number[] = [];
  const rangeWithDots: (number | string)[] = [];

  for (
    let i = Math.max(2, currentPage - delta);
    i <= Math.min(totalPages - 1, currentPage + delta);
    i++
  ) {
    range.push(i);
  }

  if (currentPage - delta > 2) {
    rangeWithDots.push(1, "...");
  } else {
    rangeWithDots.push(1);
  }

  rangeWithDots.push(...range);

  if (currentPage + delta < totalPages - 1) {
    rangeWithDots.push("...", totalPages);
  } else if (totalPages > 1) {
    rangeWithDots.push(totalPages);
  }

  return rangeWithDots;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  hasNextPage,
  hasPreviousPage,
}: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (totalPages <= 1) {
    return null;
  }

  /**
   * Generates a URL for a given page number preserving all existing filter query params
   */
  const createPageUrl = (pageNumber: number): string => {
    const params = new URLSearchParams(searchParams.toString());
    if (pageNumber <= 1) {
      params.delete("page");
    } else {
      params.set("page", pageNumber.toString());
    }
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const fromItem = Math.min((currentPage - 1) * pageSize + 1, totalItems);
  const toItem = Math.min(currentPage * pageSize, totalItems);
  const pages = getPaginationRange(currentPage, totalPages);

  return (
    <nav
      id="pagination-container"
      data-testid="pagination-nav"
      role="navigation"
      aria-label="Exam Notifications Pagination"
      className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-border pt-6 sm:flex-row"
    >
      {/* Result Count Summary */}
      <p
        id="pagination-summary-text"
        className="text-xs text-text-muted"
      >
        Showing <span className="font-semibold text-text-primary">{fromItem}</span> to{" "}
        <span className="font-semibold text-text-primary">{toItem}</span> of{" "}
        <span className="font-semibold text-text-primary">{totalItems}</span> notifications
      </p>

      {/* Page Navigation Controls */}
      <div className="flex items-center gap-1.5">
        {/* Previous Page Link */}
        {hasPreviousPage ? (
          <Link
            href={createPageUrl(currentPage - 1)}
            id="pagination-prev-btn"
            data-testid="pagination-prev-btn"
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-elevated hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Go to previous page"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Prev</span>
          </Link>
        ) : (
          <span
            id="pagination-prev-btn-disabled"
            aria-disabled="true"
            className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-surface/50 px-3 py-1.5 text-xs font-medium text-text-muted opacity-50 cursor-not-allowed"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Prev</span>
          </span>
        )}

        {/* Numbered Page Links */}
        <div className="flex items-center gap-1">
          {pages.map((item, idx) => {
            if (typeof item === "string") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1 text-xs text-text-muted"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }

            const isCurrent = item === currentPage;

            return isCurrent ? (
              <span
                key={item}
                id={`pagination-page-${item}`}
                data-testid={`pagination-page-${item}`}
                aria-current="page"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-contrast shadow-sm"
              >
                {item}
              </span>
            ) : (
              <Link
                key={item}
                href={createPageUrl(item)}
                id={`pagination-page-${item}`}
                data-testid={`pagination-page-${item}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-xs font-medium text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
                aria-label={`Go to page ${item}`}
              >
                {item}
              </Link>
            );
          })}
        </div>

        {/* Next Page Link */}
        {hasNextPage ? (
          <Link
            href={createPageUrl(currentPage + 1)}
            id="pagination-next-btn"
            data-testid="pagination-next-btn"
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-elevated hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            aria-label="Go to next page"
          >
            <span>Next</span>
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : (
          <span
            id="pagination-next-btn-disabled"
            aria-disabled="true"
            className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-surface/50 px-3 py-1.5 text-xs font-medium text-text-muted opacity-50 cursor-not-allowed"
          >
            <span>Next</span>
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </span>
        )}
      </div>
    </nav>
  );
}
