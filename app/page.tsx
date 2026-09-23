/**
 * @file app/page.tsx
 * @module HomePage
 * @description Candidate Portal Homepage assembling the interactive FilterBar, streaming NotificationFeed
 * with zero-CLS Suspense boundary, and accessible pagination.
 * 
 * Task ID: TASK-02020104 (Subtask: SUB-0202010401)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-008 (SEO & Lighthouse Performance >= 95)
 * 
 * Complies with:
 * - Next.js 15 App Router async searchParams contract (`await props.searchParams`)
 * - React 15 Suspense streaming with Skeleton fallback
 * - WCAG 2.1 AA contrast and typography hierarchy
 * - Automated testing landmarks for Playwright
 */

import { Suspense } from "react";
import { FilterBar, NotificationFeed, NotificationFeedSkeleton } from "@/components/notifications";
import type { NotificationFilterParams, ExamCategory, NotificationSortBy } from "@/types/notifications";

interface HomePageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  // In Next.js 15, searchParams is an asynchronous promise
  const resolvedParams = await searchParams;

  const category = typeof resolvedParams.category === "string" ? (resolvedParams.category as ExamCategory) : undefined;
  const state = typeof resolvedParams.state === "string" ? resolvedParams.state : undefined;
  const search = typeof resolvedParams.search === "string" ? resolvedParams.search : undefined;
  const sortBy = typeof resolvedParams.sortBy === "string" ? (resolvedParams.sortBy as NotificationSortBy) : undefined;
  const page = typeof resolvedParams.page === "string" ? parseInt(resolvedParams.page, 10) || 1 : 1;

  const filters: NotificationFilterParams = {
    category,
    state,
    search,
    sortBy,
    page,
    pageSize: 12,
  };

  // Generate unique Suspense key based on active query params to trigger fresh streaming on changes
  const suspenseKey = JSON.stringify({ category, state, search, sortBy, page });

  return (
    <div
      id="homepage-main-container"
      data-testid="homepage-container"
      className="flex-1 flex flex-col items-center w-full min-h-screen"
    >
      {/* Hero Header Section */}
      <section
        id="homepage-hero-section"
        data-testid="homepage-hero"
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8 text-center flex flex-col items-center"
      >
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-4">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Real-Time Government Recruitment Feed • 2026</span>
        </div>

        <h1 className="w-full text-center font-heading text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mb-4">
          <span className="block sm:inline">Official Government Exam</span>{" "}
          <span className="block sm:inline bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-600 dark:from-blue-400 dark:via-indigo-400 dark:to-emerald-400 bg-clip-text text-transparent">
            Notifications & Deadlines
          </span>
        </h1>

        <p className="max-w-3xl mx-auto text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed mb-6 text-center">
          Direct, authenticated notices from UPSC, SSC, IBPS, Railways, and State PSCs.
          Verified vacancies, application deadlines, syllabus outlines, and official PDFs with zero AI hallucinations.
        </p>

        {/* Value Prop Badges */}
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 text-xs text-text-muted">
          <div className="flex items-center gap-1.5">
            <svg
              className="h-4 w-4 text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium text-text-secondary">Direct Official Sources</span>
          </div>

          <div className="flex items-center gap-1.5">
            <svg
              className="h-4 w-4 text-primary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span className="font-medium text-text-secondary">Human-Verified Data</span>
          </div>

          <div className="flex items-center gap-1.5">
            <svg
              className="h-4 w-4 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium text-text-secondary">Urgent Deadline Reminders</span>
          </div>
        </div>
      </section>

      {/* Main Feed Section with Filters & Suspense Streaming Grid */}
      <section
        id="homepage-feed-section"
        data-testid="homepage-feed-section"
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-6"
      >
        {/* Interactive Filter Bar */}
        <FilterBar />

        {/* Asynchronously Streamed Notification Feed with Shimmer Fallback */}
        <Suspense key={suspenseKey} fallback={<NotificationFeedSkeleton />}>
          <NotificationFeed filters={filters} />
        </Suspense>
      </section>
    </div>
  );
}
