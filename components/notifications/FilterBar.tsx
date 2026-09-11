/**
 * @file components/notifications/FilterBar.tsx
 * @module FilterBar
 * @description Interactive Client Component for filtering the public notification feed by
 * exam categories, Indian states/regions, keyword search, and sorting criteria via Next.js App Router URL searchParams.
 * 
 * Task ID: TASK-02020103 (Subtasks: SUB-0202010301, SUB-0202010302)
 * Architecture Reference: ADR-001 (Next.js App Router RSC/Client integration), ADR-008 (SEO-friendly query URLs)
 * 
 * Complies with:
 * - Next.js 15 URL search parameter synchronization (useRouter, usePathname, useSearchParams)
 * - Zero full-page reload on filter transitions (startTransition)
 * - Reset pagination to page 1 on filter mutation
 * - Interactive landmarks and unique IDs for Playwright test automation
 * - Mobile responsive horizontal scroll with accessible touch targets
 */

"use client";

import { useTransition, useState, useEffect, type FormEvent } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CATEGORY_FILTER_OPTIONS, INDIAN_STATES_AND_REGIONS, SORT_OPTIONS } from "@/lib/constants";
import type { ExamCategory } from "@/types/notifications";

export default function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Extract current filter state from URL params
  const currentCategory = (searchParams.get("category") as ExamCategory | "all") || "all";
  const currentState = searchParams.get("state") || "all";
  const currentSortBy = searchParams.get("sortBy") || "deadline_soonest";
  const urlSearch = searchParams.get("search") || "";

  // Local input state for search box
  const [searchInput, setSearchInput] = useState(urlSearch);

  // Sync search input if URL changes externally
  useEffect(() => {
    setSearchInput(urlSearch);
  }, [urlSearch]);

  /**
   * Helper to build and push updated URL search parameters
   */
  const updateUrlParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    // Reset pagination to page 1 whenever any filter changes
    params.delete("page");

    Object.entries(updates).forEach(([key, value]) => {
      if (!value || value === "all" || (key === "sortBy" && value === "deadline_soonest")) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });

    const queryString = params.toString();
    const targetUrl = queryString ? `${pathname}?${queryString}` : pathname;

    startTransition(() => {
      router.push(targetUrl, { scroll: false });
    });
  };

  /**
   * Category pill toggle handler
   */
  const handleCategorySelect = (category: ExamCategory | "all") => {
    updateUrlParams({ category });
  };

  /**
   * State select dropdown handler
   */
  const handleStateChange = (state: string) => {
    updateUrlParams({ state });
  };

  /**
   * Sort option dropdown handler
   */
  const handleSortChange = (sortBy: string) => {
    updateUrlParams({ sortBy });
  };

  /**
   * Search form submit handler
   */
  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    updateUrlParams({ search: searchInput.trim() || null });
  };

  /**
   * Reset all active filters
   */
  const handleClearAll = () => {
    setSearchInput("");
    startTransition(() => {
      router.push(pathname, { scroll: false });
    });
  };

  // Check if any non-default filters are active
  const hasActiveFilters =
    currentCategory !== "all" ||
    currentState !== "all" ||
    currentSortBy !== "deadline_soonest" ||
    urlSearch.length > 0;

  return (
    <div
      id="notification-filter-bar"
      data-testid="notification-filter-bar"
      className="w-full space-y-4 rounded-xl border border-border bg-surface dark:bg-surface-elevated/30 p-4 shadow-sm"
    >
      {/* Top Row: Search Input + State Dropdown + Sort Dropdown */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Keyword Search Form */}
        <form
          onSubmit={handleSearchSubmit}
          className="relative flex-1"
          id="filter-search-form"
        >
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted">
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              id="filter-search-input"
              data-testid="filter-search-input"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by exam name, conducting body (UPSC, SSC), or advt no..."
              className="w-full rounded-lg border border-border bg-surface-elevated/50 py-2 pl-9 pr-20 text-xs text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {searchInput && (
              <button
                type="button"
                id="filter-search-clear-btn"
                onClick={() => {
                  setSearchInput("");
                  updateUrlParams({ search: null });
                }}
                className="absolute inset-y-0 right-14 flex items-center pr-2 text-xs text-text-muted hover:text-text-primary"
                aria-label="Clear search text"
              >
                ✕
              </button>
            )}
            <button
              type="submit"
              id="filter-search-submit-btn"
              data-testid="filter-search-submit-btn"
              className="absolute inset-y-1 right-1 rounded-md bg-primary px-3 text-xs font-semibold text-primary-contrast transition-colors hover:bg-primary-dark"
            >
              Search
            </button>
          </div>
        </form>

        {/* State & Sort Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* State Selection Dropdown */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="state-filter-select"
              className="text-xs font-medium text-text-muted whitespace-nowrap hidden sm:inline"
            >
              Region:
            </label>
            <select
              id="state-filter-select"
              data-testid="state-filter-select"
              value={currentState}
              onChange={(e) => handleStateChange(e.target.value)}
              className="rounded-lg border border-border bg-surface-elevated/60 px-3 py-2 text-xs font-medium text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Filter by state or central region"
            >
              <option value="all">All India & States</option>
              {INDIAN_STATES_AND_REGIONS.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="sort-by-select"
              className="text-xs font-medium text-text-muted whitespace-nowrap hidden sm:inline"
            >
              Sort:
            </label>
            <select
              id="sort-by-select"
              data-testid="sort-by-select"
              value={currentSortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="rounded-lg border border-border bg-surface-elevated/60 px-3 py-2 text-xs font-medium text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              aria-label="Sort notifications by criteria"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear All Filters Button */}
          {hasActiveFilters && (
            <button
              type="button"
              id="clear-all-filters-btn"
              data-testid="clear-all-filters-btn"
              onClick={handleClearAll}
              className="inline-flex items-center gap-1 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-2 text-xs font-medium text-danger hover:bg-danger/20 transition-colors"
              title="Reset all filters"
            >
              <span>Reset</span>
              <span>✕</span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Row: Category Pills Scrollable Container */}
      <div>
        <div
          id="category-pills-container"
          data-testid="category-pills-container"
          role="tablist"
          aria-label="Filter by exam categories"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none"
        >
          {CATEGORY_FILTER_OPTIONS.map((cat) => {
            const isActive = currentCategory === cat.category;

            return (
              <button
                key={cat.id}
                type="button"
                id={cat.id}
                data-testid={`category-pill-${cat.category}`}
                data-active={isActive}
                role="tab"
                aria-selected={isActive}
                onClick={() => handleCategorySelect(cat.category)}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/40 ${
                  isActive
                    ? "bg-primary text-primary-contrast shadow-sm border border-primary font-semibold"
                    : "bg-surface-elevated text-text-secondary hover:bg-surface-elevated/90 hover:text-text-primary border border-border/80"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading Transition Indicator */}
      {isPending && (
        <div
          id="filter-loading-indicator"
          className="flex items-center gap-2 text-[11px] text-text-muted animate-pulse"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
          <span>Updating notification feed...</span>
        </div>
      )}
    </div>
  );
}
