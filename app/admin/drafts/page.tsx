/**
 * @file app/admin/drafts/page.tsx
 * @description Administrative HITL Draft Review Queue page rendering AI-extracted
 * notification drafts with confidence score thresholds, status filtering, search, and pagination.
 * 
 * Task ID: TASK-03020102 (Subtask: SUB-0302010202)
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-002 (Database), ADR-013 (Security)
 */

import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ChevronRight,
  AlertCircle,
  Inbox,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { DraftCard, DraftQueueFilterBar } from "../../../components/admin";
import { getDraftNotifications } from "../../../lib/data/drafts";
import { draftFilterSchema } from "../../../lib/schemas/drafts";
import type { DraftFilterParams } from "../../../types/drafts";

export const metadata: Metadata = {
  title: "Draft Review Queue | Admin Portal - UPA-GURU",
  description: "Human-In-The-Loop review queue for AI-extracted competitive exam notifications.",
};

interface DraftsPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function DraftsQueuePage({ searchParams }: DraftsPageProps) {
  // In Next.js 15, searchParams is an asynchronous promise
  const resolvedParams = await searchParams;

  const rawFilters: DraftFilterParams = {
    status: (resolvedParams.status as any) || "pending_review",
    sortBy: (resolvedParams.sortBy as any) || "confidence_asc",
    search: typeof resolvedParams.search === "string" ? resolvedParams.search : undefined,
    minConfidence:
      typeof resolvedParams.minConfidence === "string"
        ? parseFloat(resolvedParams.minConfidence)
        : undefined,
    maxConfidence:
      typeof resolvedParams.maxConfidence === "string"
        ? parseFloat(resolvedParams.maxConfidence)
        : undefined,
    page:
      typeof resolvedParams.page === "string"
        ? parseInt(resolvedParams.page, 10) || 1
        : 1,
    pageSize:
      typeof resolvedParams.pageSize === "string"
        ? parseInt(resolvedParams.pageSize, 10) || 20
        : 20,
  };

  const validation = draftFilterSchema.safeParse(rawFilters);
  const filters = validation.success
    ? validation.data
    : {
        status: "pending_review" as const,
        sortBy: "confidence_asc" as const,
        search: "",
        page: 1,
        pageSize: 20,
      };

  const { drafts, totalCount, page, pageSize, totalPages, hasMore } =
    await getDraftNotifications(filters);

  // Pagination bounds calculation
  const startItem = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalCount);

  const buildPaginationUrl = (targetPage: number) => {
    const p = new URLSearchParams();
    if (filters.status && filters.status !== "pending_review") p.set("status", filters.status);
    if (filters.sortBy && filters.sortBy !== "confidence_asc") p.set("sortBy", filters.sortBy);
    if (filters.search) p.set("search", filters.search);
    if (targetPage > 1) p.set("page", targetPage.toString());
    const qs = p.toString();
    return `/admin/drafts${qs ? `?${qs}` : ""}`;
  };

  return (
    <div id="draft-queue-page" className="space-y-6 max-w-7xl mx-auto">
      {/* 1. Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <Link href="/admin" className="hover:text-blue-600 dark:hover:text-blue-400 font-medium transition">
          Admin Dashboard
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
        <span className="font-semibold text-slate-900 dark:text-white" aria-current="page">
          Draft Review Queue
        </span>
      </nav>

      {/* 2. Header Title & Operational Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-slate-900 dark:text-white tracking-tight">
              Draft Review Queue
            </h1>
            <span
              id="draft-queue-total-badge"
              className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
            >
              {totalCount} {filters.status === "all" ? "Total" : filters.status.replace(/_/g, " ")}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Verify AI-extracted examination notifications before publishing them live to the candidate portal.
          </p>
        </div>
      </div>

      {/* 3. Interactive Filter & Sorting Bar */}
      <DraftQueueFilterBar
        currentStatus={filters.status}
        currentSortBy={filters.sortBy}
        currentSearch={filters.search}
      />

      {/* 4. Queue Content Area: Empty State vs DraftCards List */}
      {drafts.length === 0 ? (
        <div
          id="draft-queue-empty-state"
          className="rounded-2xl bg-white dark:bg-slate-900 p-12 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm"
        >
          <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto">
            <Inbox className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="font-heading font-bold text-lg text-slate-900 dark:text-white">
              No Drafts Found
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {filters.search
                ? `No draft notifications matching keyword "${filters.search}" in ${filters.status.replace(/_/g, " ")} queue.`
                : `There are currently zero draft notifications with status "${filters.status.replace(/_/g, " ")}".`}
            </p>
          </div>

          {(filters.search || filters.status !== "pending_review") && (
            <Link
              href="/admin/drafts"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 transition"
            >
              <span>Reset to Pending Review Queue</span>
            </Link>
          )}
        </div>
      ) : (
        <div id="draft-queue-list" className="space-y-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span>
              Showing <strong>{startItem}</strong>–<strong>{endItem}</strong> of{" "}
              <strong>{totalCount}</strong> drafts
            </span>
            {filters.sortBy === "confidence_asc" && (
              <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Lowest confidence extractions prioritized</span>
              </span>
            )}
          </div>

          {/* Render individual DraftCards */}
          <div className="grid grid-cols-1 gap-4">
            {drafts.map((draft) => (
              <DraftCard key={draft.id} draft={draft} />
            ))}
          </div>
        </div>
      )}

      {/* 5. Pagination Bar */}
      {totalPages > 1 && (
        <nav
          id="draft-queue-pagination"
          aria-label="Draft Queue Pagination"
          className="flex items-center justify-between pt-4 pb-2 border-t border-slate-200 dark:border-slate-800"
        >
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Page <strong>{page}</strong> of <strong>{totalPages}</strong>
          </div>

          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                id="draft-queue-prev-page-btn"
                href={buildPaginationUrl(page - 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" />
                <span>Previous</span>
              </span>
            )}

            {hasMore ? (
              <Link
                id="draft-queue-next-page-btn"
                href={buildPaginationUrl(page + 1)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed">
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </span>
            )}
          </div>
        </nav>
      )}

      {/* 6. Verification Protocol Guidance */}
      <aside aria-label="HITL Guidelines" className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <p className="font-semibold text-slate-900 dark:text-white">Operator Protocol Note</p>
          <p>
            The queue prioritizes drafts with lower confidence scores first so operators can quickly address ambiguous OCR text, verify vacancy totals, and correct dates before publishing.
          </p>
        </div>
      </aside>
    </div>
  );
}
