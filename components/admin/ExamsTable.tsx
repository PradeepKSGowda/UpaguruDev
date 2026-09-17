"use client";

/**
 * @file components/admin/ExamsTable.tsx
 * @description Interactive data table for administrative exams management with search,
 * category filtering, pagination, and deletion confirmation modal.
 * 
 * Task ID: TASK-03030101 (Subtask: SUB-0303010101)
 * Architecture Reference: ADR-001 (Frontend Architecture)
 */

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  GraduationCap,
  AlertTriangle,
  Loader2,
  XCircle,
} from "lucide-react";
import { AdminExamListItem } from "@/lib/data/exams";
import { EXAM_CATEGORIES } from "@/lib/schemas/exams";
import { deleteExamAction } from "@/app/admin/exams/actions";

export interface ExamsTableProps {
  exams: AdminExamListItem[];
  total: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  searchQuery?: string;
  selectedCategory?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  civil_services: "Civil Services",
  banking: "Banking & Finance",
  railways: "Railways",
  defense: "Defense",
  state_psc: "State PSC",
  teaching: "Teaching",
  police: "Police",
  other: "Other",
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  civil_services: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  banking: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  railways: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  defense: { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  state_psc: { bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  teaching: { bg: "bg-teal-50 dark:bg-teal-950/40", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800" },
  police: { bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  other: { bg: "bg-gray-50 dark:bg-gray-900", text: "text-gray-700 dark:text-gray-300", border: "border-gray-200 dark:border-gray-800" },
};

export default function ExamsTable({
  exams,
  total,
  currentPage,
  pageSize,
  totalPages,
  searchQuery = "",
  selectedCategory = "all",
}: ExamsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchQuery);
  const [category, setCategory] = useState(selectedCategory);
  const [deletingExam, setDeletingExam] = useState<AdminExamListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  // Handle live search filter update
  const applyFilters = (newSearch: string, newCategory: string, newPage = 1) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (newSearch.trim()) {
      params.set("q", newSearch.trim());
    } else {
      params.delete("q");
    }

    if (newCategory && newCategory !== "all") {
      params.set("category", newCategory);
    } else {
      params.delete("category");
    }

    if (newPage > 1) {
      params.set("page", String(newPage));
    } else {
      params.delete("page");
    }

    router.push(`/admin/exams?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(search, category, 1);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCategory = e.target.value;
    setCategory(newCategory);
    applyFilters(search, newCategory, 1);
  };

  const handleConfirmDelete = () => {
    if (!deletingExam) return;
    setDeleteError(null);

    startDeleteTransition(async () => {
      const res = await deleteExamAction(deletingExam.id);
      if (res.success) {
        setDeletingExam(null);
        router.refresh();
      } else {
        setDeleteError(res.error || "Failed to delete exam");
      }
    });
  };

  return (
    <div className="space-y-6" data-testid="admin-exams-page">
      {/* Search & Actions Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by exam title, conducting body, or slug..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
              data-testid="admin-exams-search"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
          >
            Filter
          </button>
        </form>

        <div className="flex gap-3 items-center">
          {/* Category Filter */}
          <select
            value={category}
            onChange={handleCategoryChange}
            className="px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200 font-medium"
            data-testid="admin-exams-category-filter"
          >
            <option value="all">All Categories</option>
            {EXAM_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {CATEGORY_LABELS[cat] || cat}
              </option>
            ))}
          </select>

          {/* Create Button */}
          <Link
            href="/admin/exams/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shrink-0"
            data-testid="btn-create-exam"
          >
            <Plus className="w-4 h-4" />
            <span>Create Exam</span>
          </Link>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" data-testid="admin-exams-table">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/75 dark:bg-gray-800/50 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-3.5 px-4 sm:px-6">Exam Series</th>
                <th className="py-3.5 px-4">Conducting Body</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">State / Central</th>
                <th className="py-3.5 px-4 text-center">Notifications</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {exams.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-3">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        No examinations found
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
                        {search || category !== "all"
                          ? "Try clearing filters or searching for different keywords."
                          : "Get started by creating your first competitive examination series."}
                      </p>
                      <Link
                        href="/admin/exams/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create New Exam
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                exams.map((exam) => {
                  const color = CATEGORY_COLORS[exam.category] || CATEGORY_COLORS.other!;
                  return (
                    <tr
                      key={exam.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                      data-testid={`exam-row-${exam.id}`}
                    >
                      {/* Exam Title & Slug */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {exam.title}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                            /{exam.slug}
                          </span>
                        </div>
                      </td>

                      {/* Conducting Body */}
                      <td className="py-4 px-4 text-gray-700 dark:text-gray-300 font-medium">
                        {exam.conducting_body}
                      </td>

                      {/* Category Badge */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color.bg} ${color.text} ${color.border}`}
                        >
                          {CATEGORY_LABELS[exam.category] || exam.category}
                        </span>
                      </td>

                      {/* State or Central */}
                      <td className="py-4 px-4 text-gray-600 dark:text-gray-300">
                        {exam.state_or_central}
                      </td>

                      {/* Notifications Count */}
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${
                            exam.notificationCount > 0
                              ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                              : "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {exam.notificationCount}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {exam.official_website && (
                            <a
                              href={exam.official_website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              title="Official Website"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                          <Link
                            href={`/admin/exams/${exam.id}/edit`}
                            className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                            title="Edit Exam"
                            data-testid={`btn-edit-exam-${exam.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setDeletingExam(exam);
                            }}
                            className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            title="Delete Exam"
                            data-testid={`btn-delete-exam-${exam.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing <span className="font-semibold text-gray-700 dark:text-gray-300">{(currentPage - 1) * pageSize + 1}</span> to{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-300">{Math.min(currentPage * pageSize, total)}</span> of{" "}
              <span className="font-semibold text-gray-700 dark:text-gray-300">{total}</span> exams
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => applyFilters(search, category, currentPage - 1)}
                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => applyFilters(search, category, currentPage + 1)}
                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingExam && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          data-testid="delete-exam-modal"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Delete Examination
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Confirm permanent removal of master record
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to delete{" "}
              <strong className="text-gray-900 dark:text-gray-100">{deletingExam.title}</strong>{" "}
              (<span className="font-mono text-xs">/{deletingExam.slug}</span>)?
            </p>

            {deletingExam.notificationCount > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  This exam has <strong>{deletingExam.notificationCount}</strong> linked notification(s).
                  The database safeguards will reject deletion until these notifications are deleted or reassigned.
                </span>
              </div>
            )}

            {deleteError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingExam(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg shadow-sm transition-colors"
                data-testid="confirm-delete-exam-btn"
              >
                {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeleting ? "Deleting..." : "Confirm Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
