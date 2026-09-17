"use client";

/**
 * @file components/admin/DraftQueueFilterBar.tsx
 * @description Interactive client-side filter bar for the Draft Review Queue supporting
 * status tabs, live search input, priority sorting dropdown, and URL parameter synchronization.
 * 
 * Task ID: TASK-03020102
 * Architecture Reference: ADR-001 (Frontend Architecture)
 */

import React, { useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import type { DraftStatus, DraftSortBy } from "../../types/drafts";

export interface DraftQueueFilterBarProps {
  currentStatus: DraftStatus | "all";
  currentSortBy: DraftSortBy;
  currentSearch: string;
}

const STATUS_TABS: { label: string; value: DraftStatus | "all" }[] = [
  { label: "Pending Review", value: "pending_review" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "All Drafts", value: "all" },
];

const SORT_OPTIONS: { label: string; value: DraftSortBy }[] = [
  { label: "Lowest Confidence First (Priority)", value: "confidence_asc" },
  { label: "Highest Confidence First", value: "confidence_desc" },
  { label: "Newest Extracted First", value: "newest" },
  { label: "Oldest in Queue First", value: "oldest" },
];

export default function DraftQueueFilterBar({
  currentStatus,
  currentSortBy,
  currentSearch,
}: DraftQueueFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all" && value !== "") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset page to 1 whenever filters or sorting changes
    params.delete("page");

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  const handleSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const query = formData.get("search")?.toString() || "";
    updateParam("search", query);
  };

  return (
    <div
      id="draft-queue-filter-bar"
      className="space-y-4 rounded-2xl bg-white dark:bg-slate-900 p-4 sm:p-5 border border-slate-200 dark:border-slate-800 shadow-sm"
    >
      {/* Top Row: Status Tabs & Sort Dropdown */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Status Navigation Tabs */}
        <nav
          id="draft-status-tabs"
          className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 overflow-x-auto"
          aria-label="Filter Draft Status"
        >
          {STATUS_TABS.map((tab) => {
            const isActive = currentStatus === tab.value;
            return (
              <button
                key={tab.value}
                id={`draft-filter-tab-${tab.value}`}
                type="button"
                onClick={() => updateParam("status", tab.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                  isActive
                    ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Priority Sort Dropdown */}
        <div className="flex items-center gap-2 self-start lg:self-auto">
          <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
          <label htmlFor="draft-sort-select" className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Sort:
          </label>
          <select
            id="draft-sort-select"
            value={currentSortBy}
            onChange={(e) => updateParam("sortBy", e.target.value)}
            className="text-xs font-semibold rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bottom Row: Text Search on Source URLs / Extracted Content */}
      <form onSubmit={handleSearchSubmit} className="relative flex items-center">
        <Search className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
        <input
          id="draft-search-input"
          name="search"
          type="search"
          defaultValue={currentSearch}
          placeholder="Filter by source URL or keywords (e.g. upsc.gov.in, prelims)..."
          className="w-full pl-10 pr-24 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-900 transition"
        />
        <button
          id="draft-search-submit-btn"
          type="submit"
          disabled={isPending}
          className="absolute right-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-50"
        >
          {isPending ? "Filtering..." : "Search"}
        </button>
      </form>
    </div>
  );
}
