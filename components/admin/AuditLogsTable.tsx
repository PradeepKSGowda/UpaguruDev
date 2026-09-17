"use client";

/**
 * @file components/admin/AuditLogsTable.tsx
 * @description Forensic audit log inspection table with action filtering, date ranges,
 * search, and structured metadata JSON inspector modal.
 * 
 * Task ID: TASK-03040101 (Subtask: SUB-0304010102)
 * Architecture Reference: ADR-001 (App Router), ADR-013 (Security)
 */

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  ShieldAlert,
  Calendar,
  Filter,
  User,
  Eye,
  X,
  Copy,
  Check,
  FileCode,
  Tag,
} from "lucide-react";
import { AuditLogEntry } from "@/lib/data/audit-logs";
import { AUDIT_ACTIONS } from "@/lib/schemas/audit-logs";

export interface AuditLogsTableProps {
  logs: AuditLogEntry[];
  total: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  searchQuery?: string;
  selectedAction?: string;
  startDate?: string;
  endDate?: string;
}

const ACTION_LABELS: Record<string, string> = {
  all: "All Administrative Actions",
  approve_and_publish: "Approve & Publish Draft",
  reject: "Reject AI Draft",
  create_exam: "Create Examination Series",
  update_exam: "Update Examination Series",
  delete_exam: "Delete Examination Series",
  create_notification: "Author Job Notification",
  update_notification: "Update Job Notification",
  delete_notification: "Delete Job Notification",
};

const ACTION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  approve_and_publish: { bg: "bg-emerald-50 dark:bg-emerald-950/40", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  create_exam: { bg: "bg-blue-50 dark:bg-blue-950/40", text: "text-blue-700 dark:text-blue-300", border: "border-blue-200 dark:border-blue-800" },
  create_notification: { bg: "bg-teal-50 dark:bg-teal-950/40", text: "text-teal-700 dark:text-teal-300", border: "border-teal-200 dark:border-teal-800" },
  update_exam: { bg: "bg-indigo-50 dark:bg-indigo-950/40", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  update_notification: { bg: "bg-purple-50 dark:bg-purple-950/40", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  reject: { bg: "bg-amber-50 dark:bg-amber-950/40", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  delete_exam: { bg: "bg-red-50 dark:bg-red-950/40", text: "text-red-700 dark:text-red-300", border: "border-red-200 dark:border-red-800" },
  delete_notification: { bg: "bg-rose-50 dark:bg-rose-950/40", text: "text-rose-700 dark:text-rose-300", border: "border-rose-200 dark:border-rose-800" },
};

export default function AuditLogsTable({
  logs,
  total,
  currentPage,
  pageSize,
  totalPages,
  searchQuery = "",
  selectedAction = "all",
  startDate = "",
  endDate = "",
}: AuditLogsTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(searchQuery);
  const [action, setAction] = useState(selectedAction);
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);

  const [inspectingEntry, setInspectingEntry] = useState<AuditLogEntry | null>(null);
  const [copied, setCopied] = useState(false);

  const applyFilters = (newSearch: string, newAction: string, newStart: string, newEnd: string, newPage = 1) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    if (newSearch.trim()) {
      params.set("q", newSearch.trim());
    } else {
      params.delete("q");
    }

    if (newAction && newAction !== "all") {
      params.set("action", newAction);
    } else {
      params.delete("action");
    }

    if (newStart) {
      params.set("startDate", newStart);
    } else {
      params.delete("startDate");
    }

    if (newEnd) {
      params.set("endDate", newEnd);
    } else {
      params.delete("endDate");
    }

    if (newPage > 1) {
      params.set("page", String(newPage));
    } else {
      params.delete("page");
    }

    router.push(`/admin/audit-logs?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(search, action, start, end, 1);
  };

  const handleClearFilters = () => {
    setSearch("");
    setAction("all");
    setStart("");
    setEnd("");
    router.push("/admin/audit-logs");
  };

  const handleCopyJson = () => {
    if (!inspectingEntry?.metadata) return;
    navigator.clipboard.writeText(JSON.stringify(inspectingEntry.metadata, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimestamp = (iso: string) => {
    const date = new Date(iso);
    return {
      formatted: date.toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "medium",
      }),
      relative: getRelativeTime(date),
    };
  };

  function getRelativeTime(d: Date): string {
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }

  return (
    <div className="space-y-6" data-testid="admin-audit-logs-page">
      {/* Filters Container */}
      <div className="bg-white dark:bg-gray-900 p-5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm space-y-4">
        <form onSubmit={handleSearchSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Keyword Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search action or entity ID..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
              data-testid="audit-logs-search"
            />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={action}
              onChange={(e) => {
                const nextAction = e.target.value;
                setAction(nextAction);
                applyFilters(search, nextAction, start, end, 1);
              }}
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100 font-medium"
              data-testid="audit-logs-action-filter"
            >
              <option value="all">All Actions</option>
              {AUDIT_ACTIONS.map((act) => (
                <option key={act} value={act}>
                  {ACTION_LABELS[act] || act}
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
              data-testid="audit-logs-start-date"
            />
          </div>

          {/* End Date */}
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-gray-100"
              data-testid="audit-logs-end-date"
            />
          </div>

          {/* Action Buttons */}
          <div className="sm:col-span-2 lg:col-span-4 flex items-center justify-end gap-3 pt-1">
            {(search || action !== "all" || start || end) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3 py-1.5 text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:underline"
              >
                Clear Filters
              </button>
            )}
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </form>
      </div>

      {/* Audit Log Table Card */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" data-testid="audit-logs-table">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50/75 dark:bg-gray-800/50 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="py-3.5 px-4 sm:px-6">Timestamp</th>
                <th className="py-3.5 px-4">Operator / Admin</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Target Entity</th>
                <th className="py-3.5 px-4">Target ID</th>
                <th className="py-3.5 px-4 sm:px-6 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 px-4 text-center">
                    <div className="max-w-sm mx-auto flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 mb-3">
                        <ShieldAlert className="w-6 h-6" />
                      </div>
                      <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        No audit events recorded
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        {search || action !== "all" || start || end
                          ? "No audit records match the current filter criteria."
                          : "Administrative operations will automatically appear here as they are executed."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((entry) => {
                  const { formatted, relative } = formatTimestamp(entry.created_at);
                  const color = ACTION_COLORS[entry.action] || {
                    bg: "bg-gray-100 dark:bg-gray-800",
                    text: "text-gray-700 dark:text-gray-300",
                    border: "border-gray-200 dark:border-gray-700",
                  };

                  return (
                    <tr
                      key={entry.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                      data-testid={`audit-log-row-${entry.id}`}
                    >
                      {/* Timestamp */}
                      <td className="py-3.5 px-4 sm:px-6 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                            {relative}
                          </span>
                          <span className="text-[11px] text-gray-400 dark:text-gray-500">
                            {formatted}
                          </span>
                        </div>
                      </td>

                      {/* Admin User */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {entry.admin ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center text-xs font-bold shrink-0">
                              {(entry.admin.full_name || entry.admin.email)[0]?.toUpperCase()}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-gray-900 dark:text-gray-200">
                                {entry.admin.full_name || entry.admin.email.split("@")[0]}
                              </span>
                              <span className="text-[11px] text-gray-400">
                                {entry.admin.email}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <User className="w-3.5 h-3.5" />
                            <span className="font-mono text-[11px]">System / Unknown</span>
                          </div>
                        )}
                      </td>

                      {/* Action Pill */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${color.bg} ${color.text} ${color.border}`}
                        >
                          {ACTION_LABELS[entry.action] || entry.action}
                        </span>
                      </td>

                      {/* Target Entity */}
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                          <Tag className="w-3 h-3 text-gray-400" />
                          {entry.target_entity}
                        </span>
                      </td>

                      {/* Target ID */}
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate max-w-[140px] block">
                          {entry.target_id || "N/A"}
                        </span>
                      </td>

                      {/* Details / Metadata Inspector */}
                      <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                        {entry.metadata ? (
                          <button
                            type="button"
                            onClick={() => setInspectingEntry(entry)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                            data-testid={`btn-inspect-metadata-${entry.id}`}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Inspect</span>
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400 italic">None</span>
                        )}
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
              <span className="font-semibold text-gray-700 dark:text-gray-300">{total}</span> audit records
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => applyFilters(search, action, start, end, currentPage - 1)}
                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => applyFilters(search, action, start, end, currentPage + 1)}
                className="px-3 py-1.5 text-xs font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Metadata Inspector Modal */}
      {inspectingEntry && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
          data-testid="metadata-inspector-modal"
        >
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[85vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    Audit Metadata & Change Diff
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Action: {ACTION_LABELS[inspectingEntry.action] || inspectingEntry.action} | Entity:{" "}
                    {inspectingEntry.target_entity}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyJson}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setInspectingEntry(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Context Summary Cards */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 block mb-0.5">Operator</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {inspectingEntry.admin?.email || inspectingEntry.admin_id}
                  </span>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-gray-400 block mb-0.5">Target ID</span>
                  <span className="font-mono text-gray-800 dark:text-gray-200">
                    {inspectingEntry.target_id || "None"}
                  </span>
                </div>
              </div>

              {/* Formatted Code Box */}
              <div>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">
                  Payload / Mutation Metadata:
                </span>
                <pre className="p-4 bg-gray-900 text-gray-100 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed border border-gray-800 max-h-[350px]">
                  {JSON.stringify(inspectingEntry.metadata, null, 2)}
                </pre>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectingEntry(null)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 text-xs font-semibold rounded-lg transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
