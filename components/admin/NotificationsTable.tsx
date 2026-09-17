"use client";

/**
 * @file components/admin/NotificationsTable.tsx
 * @description Interactive data table for administrative notifications management with search,
 * status filtering, pagination, and deletion modal.
 * 
 * Task ID: TASK-03030102 (Subtask: SUB-0303010201)
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
  Bell,
  AlertTriangle,
  Loader2,
  Calendar,
  Users,
  XCircle,
} from "lucide-react";
import { AdminNotificationListItem } from "@/lib/data/admin-notifications";
import { NOTIFICATION_STATUSES } from "@/lib/schemas/admin-notifications";
import { deleteNotificationAction } from "@/app/admin/notifications/actions";

export interface NotificationsTableProps {
  notifications: AdminNotificationListItem[];
  total: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  searchQuery?: string;
  selectedStatus?: string;
}

const STATUS_LABELS: Record<string, string> = {
  all: "All Notifications",
  published: "Published",
  under_review: "Under Review",
  draft: "Draft",
  archived: "Archived",
};

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  published: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  under_review: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  draft: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  archived: { bg: "bg-gray-100 dark:bg-gray-800", text: "text-gray-600 dark:text-gray-400", border: "border-gray-200 dark:border-gray-700" },
};

export default function NotificationsTable({
  notifications,
  total,
  currentPage,
  pageSize,
  totalPages,
  searchQuery = "",
  selectedStatus = "all",
}: NotificationsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchQuery);
  const [status, setStatus] = useState(selectedStatus);
  const [deletingNotif, setDeletingNotif] = useState<AdminNotificationListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();

  const applyFilters = (newSearch: string, newStatus: string, newPage = 1) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (newSearch.trim()) {
      params.set("q", newSearch.trim());
    } else {
      params.delete("q");
    }

    if (newStatus && newStatus !== "all") {
      params.set("status", newStatus);
    } else {
      params.delete("status");
    }

    if (newPage > 1) {
      params.set("page", String(newPage));
    } else {
      params.delete("page");
    }

    router.push(`/admin/notifications?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(search, status, 1);
  };

  const handleStatusTab = (newStatus: string) => {
    setStatus(newStatus);
    applyFilters(search, newStatus, 1);
  };

  const handleConfirmDelete = () => {
    if (!deletingNotif) return;
    setDeleteError(null);

    startDeleteTransition(async () => {
      const res = await deleteNotificationAction(deletingNotif.id);
      if (res.success) {
        setDeletingNotif(null);
        router.refresh();
      } else {
        setDeleteError(res.error || "Failed to delete notification");
      }
    });
  };

  return (
    <div className="space-y-6" data-testid="admin-notifications-page">
      {/* Controls Card */}
      <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        {/* Top bar: Search & Create */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
          <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by notification title, reference number, or slug..."
                className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
                data-testid="admin-notifications-search"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors"
            >
              Filter
            </button>
          </form>

          <Link
            href="/admin/notifications/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shrink-0"
            data-testid="btn-create-notification"
          >
            <Plus className="w-4 h-4" />
            <span>Create Notification</span>
          </Link>
        </div>

        {/* Status Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => handleStatusTab("all")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
              status === "all"
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            All ({total})
          </button>
          {NOTIFICATION_STATUSES.map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => handleStatusTab(st)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                status === st
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {STATUS_LABELS[st] || st}
            </button>
          ))}
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" data-testid="admin-notifications-table">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/75 dark:bg-gray-800/50 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-3.5 px-4 sm:px-6">Notification Title</th>
                <th className="py-3.5 px-4">Parent Examination</th>
                <th className="py-3.5 px-4 text-center">Vacancies</th>
                <th className="py-3.5 px-4">Application Window</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-3">
                        <Bell className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        No notifications found
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">
                        {search || status !== "all"
                          ? "Try adjusting your search criteria or status filter."
                          : "Create your first manual job notification to publish outside the automated scraper."}
                      </p>
                      <Link
                        href="/admin/notifications/new"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Create Notification
                      </Link>
                    </div>
                  </td>
                </tr>
              ) : (
                notifications.map((item) => {
                  const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.draft!;
                  const isDeadlinePassed = new Date(item.application_end_date) < new Date();

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                      data-testid={`notification-row-${item.id}`}
                    >
                      {/* Title & Slug */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-900 dark:text-gray-100 line-clamp-1">
                            {item.title}
                          </span>
                          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            {item.notification_number && (
                              <span className="font-medium bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[11px]">
                                Ref: {item.notification_number}
                              </span>
                            )}
                            <span className="font-mono">/{item.slug}</span>
                          </div>
                        </div>
                      </td>

                      {/* Parent Exam */}
                      <td className="py-4 px-4">
                        {item.exam ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-gray-900 dark:text-gray-200 line-clamp-1">
                              {item.exam.title}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {item.exam.conducting_body} ({item.exam.state_or_central})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">No parent exam</span>
                        )}
                      </td>

                      {/* Vacancies */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          <Users className="w-3 h-3" />
                          {item.total_vacancies.toLocaleString()}
                        </span>
                      </td>

                      {/* Application Window */}
                      <td className="py-4 px-4 whitespace-nowrap text-xs">
                        <div className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                          <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span>
                            Ends:{" "}
                            <strong className={isDeadlinePassed ? "text-red-600 dark:text-red-400" : ""}>
                              {item.application_end_date}
                            </strong>
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyle.bg} ${statusStyle.text} ${statusStyle.border}`}
                        >
                          {STATUS_LABELS[item.status] || item.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {item.status === "published" && (
                            <Link
                              href={`/notification/${item.slug}`}
                              target="_blank"
                              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                              title="View Public Page"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          )}
                          <Link
                            href={`/admin/notifications/${item.id}/edit`}
                            className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 rounded hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-colors"
                            title="Edit Notification"
                            data-testid={`btn-edit-notification-${item.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Link>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteError(null);
                              setDeletingNotif(item);
                            }}
                            className="p-1.5 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                            title="Delete Notification"
                            data-testid={`btn-delete-notification-${item.id}`}
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
              <span className="font-semibold text-gray-700 dark:text-gray-300">{total}</span> notifications
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => applyFilters(search, status, currentPage - 1)}
                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => applyFilters(search, status, currentPage + 1)}
                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deletingNotif && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          data-testid="delete-notification-modal"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-950/60 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Delete Notification
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Confirm permanent removal of job opening
                </p>
              </div>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to permanently delete{" "}
              <strong className="text-gray-900 dark:text-gray-100">{deletingNotif.title}</strong>?
              This will remove the publication from the candidate portal.
            </p>

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
                onClick={() => setDeletingNotif(null)}
                className="px-4 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg shadow-sm transition-colors"
                data-testid="confirm-delete-notif-btn"
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
