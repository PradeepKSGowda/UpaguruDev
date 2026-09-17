/**
 * @file app/admin/exams/page.tsx
 * @description Administrative Exams Master page rendering search, category filters,
 * responsive data table, and creation/deletion controls.
 * 
 * Task ID: TASK-03030101 (Subtask: SUB-0303010101)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-002 (Database)
 */

import React from "react";
import { Metadata } from "next";
import { GraduationCap, ShieldCheck } from "lucide-react";
import { getAdminExams } from "@/lib/data/exams";
import { ValidatedExamFilter } from "@/lib/schemas/exams";
import ExamsTable from "@/components/admin/ExamsTable";

export const metadata: Metadata = {
  title: "Exams Master | Admin HITL Portal",
  description: "Manage competitive examination series, conducting bodies, and state jurisdictions.",
};

interface AdminExamsPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    page?: string;
  }>;
}

export default async function AdminExamsPage({ searchParams }: AdminExamsPageProps) {
  const resolvedParams = await searchParams;
  const searchQuery = resolvedParams.q || "";
  const selectedCategory = (resolvedParams.category as ValidatedExamFilter["category"]) || "all";
  const currentPage = parseInt(resolvedParams.page || "1", 10) || 1;

  const { exams, total, totalPages, pageSize } = await getAdminExams({
    search: searchQuery,
    category: selectedCategory,
    page: currentPage,
    pageSize: 15,
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                Exams Master Series
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                Master Catalog
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Define and govern competitive examinations, conducting commissions, and category hierarchies.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs uppercase font-bold tracking-wider text-gray-400 block">
              Total Master Series
            </span>
            <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
              {total}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table with Filters */}
      <ExamsTable
        exams={exams}
        total={total}
        currentPage={currentPage}
        pageSize={pageSize}
        totalPages={totalPages}
        searchQuery={searchQuery}
        selectedCategory={selectedCategory}
      />
    </div>
  );
}
