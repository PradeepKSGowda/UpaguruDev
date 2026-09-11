/**
 * @file app/search/page.tsx
 * @module SearchPage
 * @description Candidate Portal full-text search results page.
 * Reads search query parameters (?q=...), calls searchNotifications() data access layer,
 * and renders matching notification cards, results count, pagination, and zero-state recovery.
 * 
 * Task ID: TASK-02040103 (Subtasks: SUB-0204010301, SUB-0204010302)
 * Architecture Reference: ADR-001 (Frontend App Router RSC), ADR-008 (SEO Strategy)
 * 
 * Complies with:
 * - Next.js 15 App Router asynchronous searchParams contract (`await searchParams`)
 * - Pure React Server Component (0KB client hydration overhead for cards grid)
 * - Google Search Central SEO best practice (`noindex, follow` on dynamic search result pages)
 * - Complete Playwright test landmarks
 */

import type { Metadata } from "next";
import Link from "next/link";
import { searchNotifications } from "@/lib/data/notifications";
import type { ExamCategory } from "@/types/notifications";
import SearchBar from "@/components/search/SearchBar";
import NotificationCard from "@/components/notifications/NotificationCard";
import Pagination from "@/components/notifications/Pagination";
import Breadcrumb from "@/components/notifications/Breadcrumb";
import { Search, AlertCircle, Sparkles, BookOpen, Compass } from "lucide-react";

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    state?: string;
    page?: string;
  }>;
}

/**
 * Dynamic Metadata Generator for Search Results
 * Implements noindex, follow to prevent search engine index bloat on internal query pages
 */
export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const { q } = await searchParams;
  const trimmed = (q || "").trim();

  const title = trimmed
    ? `Search: "${trimmed}" | UPA-GURU`
    : "Search Exam Notifications | UPA-GURU";

  const description = trimmed
    ? `Find government job notifications, vacancy counts, and application deadlines matching "${trimmed}".`
    : "Search across 1,200+ central and state government competitive exam notifications.";

  return {
    title,
    description,
    robots: {
      index: false,
      follow: true,
    },
  };
}

const POPULAR_SEARCH_TERMS = [
  "UPSC Civil Services",
  "KPSC Gazetted",
  "SSC CGL",
  "IBPS PO",
  "RRB NTPC",
  "Karnataka Police",
  "Defense NDA",
];

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedParams = await searchParams;
  const query = (resolvedParams.q || "").trim();
  const category = (resolvedParams.category as ExamCategory) || undefined;
  const state = resolvedParams.state || undefined;
  const page = parseInt(resolvedParams.page || "1", 10);
  const pageSize = 12;

  // Execute full-text search when query is non-empty
  const results = query
    ? await searchNotifications({
        query,
        category,
        state,
        page,
        pageSize,
      })
    : { data: [], total: 0, page: 1, pageSize, totalPages: 0 };

  const { data: notifications, total, totalPages } = results;
  const hasQuery = query.length > 0;
  const hasResults = notifications.length > 0;

  return (
    <main
      id="search-results-page"
      data-testid="search-results-page"
      className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8"
    >
      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Search", isCurrent: true },
        ]}
      />

      {/* Hero Search Section */}
      <section
        id="search-hero-banner"
        data-testid="search-hero-banner"
        className="rounded-3xl border border-border bg-gradient-to-b from-surface via-surface to-surface-elevated/30 p-6 sm:p-10 shadow-sm space-y-6"
      >
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
            <Sparkles className="h-3.5 w-3.5" />
            <span>High-Speed Full-Text Search</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-text tracking-tight">
            Find Exam Notifications & Jobs
          </h1>
          <p className="text-base text-text-muted">
            Search by exam name, conducting body (e.g., UPSC, KPSC, SSC, RRB), designation, or notification number.
          </p>
        </div>

        {/* Large Search Input */}
        <div className="max-w-3xl">
          <SearchBar
            variant="large"
            placeholder="e.g., KPSC Gazetted Probationers, SSC CGL 2026, Assistant Engineer..."
            autoFocus={!hasQuery}
          />
        </div>

        {/* Popular Keywords Chips */}
        <div className="flex flex-wrap items-center gap-2 pt-2 text-xs">
          <span className="text-text-muted font-semibold flex items-center gap-1">
            <Compass className="h-3.5 w-3.5 text-primary" /> Popular searches:
          </span>
          {POPULAR_SEARCH_TERMS.map((term) => (
            <Link
              key={term}
              href={`/search?q=${encodeURIComponent(term)}`}
              className="px-3 py-1.5 rounded-lg border border-border bg-surface dark:bg-surface-elevated/50 text-text font-medium hover:border-primary/50 hover:text-primary transition-colors"
            >
              {term}
            </Link>
          ))}
        </div>
      </section>

      {/* Results or Zero-State Container */}
      {!hasQuery ? (
        /* Empty State: Prompt user to search */
        <section
          id="search-empty-state"
          data-testid="search-empty-state"
          className="rounded-2xl border border-dashed border-border/80 bg-surface/50 p-12 text-center space-y-4"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
            <Search className="h-8 w-8" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-lg font-bold text-text">Enter an exam or authority name</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Type any keyword above to search through our verified database of central and state government recruitment notifications.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/#notifications"
              className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:underline"
            >
              <BookOpen className="h-4 w-4" />
              <span>Browse all live notifications on Homepage</span>
            </Link>
          </div>
        </section>
      ) : hasResults ? (
        /* Matching Results Grid */
        <section
          id="search-results-section"
          data-testid="search-results-section"
          className="space-y-6"
        >
          {/* Results Count Summary */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-border/60">
            <p
              id="search-results-count"
              data-testid="search-results-count"
              className="text-sm font-medium text-text-muted"
            >
              Found <span className="font-bold text-text">{total}</span>{" "}
              {total === 1 ? "notification" : "notifications"} matching{" "}
              <span className="font-bold text-primary">"{query}"</span>
            </p>
          </div>

          {/* Cards Grid */}
          <div
            id="search-results-grid"
            data-testid="search-results-grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {notifications.map((item) => (
              <NotificationCard key={item.id} notification={item} />
            ))}
          </div>

          {/* Server-Side Pagination */}
          {totalPages > 1 && (
            <div className="pt-8 border-t border-border/60">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={pageSize}
                hasNextPage={page < totalPages}
                hasPreviousPage={page > 1}
              />
            </div>
          )}
        </section>
      ) : (
        /* Zero Results Fallback */
        <section
          id="search-no-results"
          data-testid="search-no-results"
          className="rounded-2xl border border-border bg-surface p-10 text-center space-y-6"
        >
          <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <AlertCircle className="h-8 w-8" />
          </div>
          <div className="max-w-lg mx-auto space-y-2">
            <h2 className="text-xl font-bold text-text">
              No notifications found for <span className="text-primary">"{query}"</span>
            </h2>
            <p className="text-sm text-text-muted leading-relaxed">
              We couldn't find any published exam announcements matching your keywords.
            </p>
          </div>

          {/* Suggestions List */}
          <div className="max-w-md mx-auto rounded-xl border border-border/70 bg-surface-elevated/40 p-5 text-left text-xs space-y-2 text-text-muted">
            <span className="font-bold text-text block mb-1 text-sm">Suggestions:</span>
            <ul className="list-disc list-inside space-y-1">
              <li>Check your spelling for typos (e.g. "KPSC" instead of "KPSSC")</li>
              <li>Try searching by authority name (e.g. "UPSC", "SSC", "RRB", "IBPS")</li>
              <li>Try generic designation keywords (e.g. "Engineer", "Officer", "Clerk")</li>
              <li>Remove specific category or region constraints</li>
            </ul>
          </div>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-sm hover:bg-primary/90 transition"
            >
              Browse All Live Exams
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}
