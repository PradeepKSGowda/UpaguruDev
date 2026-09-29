"use client";

/**
 * @file components/admin/UserDirectoryTable.tsx
 * @description Interactive administrative user directory table with search, role filters,
 * test candidate toggle, pagination controls, block/reactivate toggles, and role reassignment controls.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import React, { useState, useTransition, useMemo } from "react";
import {
  Search,
  Filter,
  ShieldAlert,
  UserX,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  FlaskConical,
  Users,
} from "lucide-react";
import RoleBadge from "./RoleBadge";
import type { UserSummaryItem } from "../../app/admin/users/actions";
import { setUserBlockStatus, assignUserRoleAction } from "../../app/admin/users/actions";

interface UserDirectoryTableProps {
  initialUsers: UserSummaryItem[];
  totalCount: number;
}

export default function UserDirectoryTable({
  initialUsers,
  totalCount,
}: UserDirectoryTableProps) {
  const [users, setUsers] = useState<UserSummaryItem[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [userTypeFilter, setUserTypeFilter] = useState<"all" | "real" | "test">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Compute test vs real user counts
  const { testCount, realCount } = useMemo(() => {
    let t = 0;
    let r = 0;
    users.forEach((u) => {
      const isTest = Boolean(u.isTestUser ?? (u.email.endsWith("@upaguru.test") || u.email.includes(".test")));
      if (isTest) t++;
      else r++;
    });
    return { testCount: t, realCount: r };
  }, [users]);

  // Filter users based on search, role, and test/real user type
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const isTest = Boolean(u.isTestUser ?? (u.email.endsWith("@upaguru.test") || u.email.includes(".test")));

      const matchesSearch =
        !searchQuery.trim() ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.fullName && u.fullName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.gender && u.gender.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.maritalStatus && u.maritalStatus.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "test_candidate" && isTest) ||
        (roleFilter === "candidate" && u.role === "candidate" && !isTest) ||
        u.role === roleFilter;

      const matchesUserType =
        userTypeFilter === "all" ||
        (userTypeFilter === "test" && isTest) ||
        (userTypeFilter === "real" && !isTest);

      return matchesSearch && matchesRole && matchesUserType;
    });
  }, [users, searchQuery, roleFilter, userTypeFilter]);

  // Handle filter changes with page reset
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handleRoleFilterChange = (role: string) => {
    setRoleFilter(role);
    setCurrentPage(1);
  };

  const handleUserTypeFilterChange = (type: "all" | "real" | "test") => {
    setUserTypeFilter(type);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  };

  // Pagination calculation
  const totalFilteredCount = filteredUsers.length;
  const isAllPages = pageSize === -1;
  const totalPages = isAllPages ? 1 : Math.max(1, Math.ceil(totalFilteredCount / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = isAllPages ? 0 : (safePage - 1) * pageSize;
  const endIndex = isAllPages ? totalFilteredCount : Math.min(startIndex + pageSize, totalFilteredCount);
  const paginatedUsers = isAllPages ? filteredUsers : filteredUsers.slice(startIndex, endIndex);

  const handleBlockToggle = (user: UserSummaryItem) => {
    const newStatus = !user.isBlocked;
    setProcessingUserId(user.id);
    setActionFeedback(null);

    startTransition(async () => {
      try {
        const res = await setUserBlockStatus({
          userId: user.id,
          isBlocked: newStatus,
          reason: newStatus
            ? "Administrative block executed via User Directory"
            : "Administrative reactivation executed via User Directory",
        });

        if (res.success) {
          setUsers((prev) =>
            prev.map((u) => (u.id === user.id ? { ...u, isBlocked: newStatus } : u))
          );
          setActionFeedback({ type: "success", message: res.message });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Action failed";
        setActionFeedback({ type: "error", message: msg });
      } finally {
        setProcessingUserId(null);
      }
    });
  };

  const handleRoleChange = (userId: string, newRole: "super_admin" | "admin" | "moderator" | "support" | "candidate") => {
    setProcessingUserId(userId);
    setActionFeedback(null);

    startTransition(async () => {
      try {
        const res = await assignUserRoleAction({ userId, roleCode: newRole });
        if (res.success) {
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
          );
          setActionFeedback({ type: "success", message: res.message });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to update role";
        setActionFeedback({ type: "error", message: msg });
      } finally {
        setProcessingUserId(null);
      }
    });
  };

  return (
    <div className="space-y-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      {/* Search & Filter Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Search bar */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, TC ID..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* User Type Filter Toggle */}
            <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-0.5 border border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => handleUserTypeFilterChange("all")}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  userTypeFilter === "all"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                All ({users.length})
              </button>
              <button
                type="button"
                onClick={() => handleUserTypeFilterChange("real")}
                className={`px-3 py-1.5 rounded-lg font-medium transition ${
                  userTypeFilter === "real"
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                Real ({realCount})
              </button>
              <button
                type="button"
                onClick={() => handleUserTypeFilterChange("test")}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition ${
                  userTypeFilter === "test"
                    ? "bg-white dark:bg-slate-700 text-purple-700 dark:text-purple-300 shadow-xs font-bold"
                    : "text-slate-600 dark:text-slate-400 hover:text-purple-600 dark:hover:text-purple-300"
                }`}
              >
                <FlaskConical className="w-3 h-3 text-purple-500" />
                <span>Test Matrix ({testCount})</span>
              </button>
            </div>

            {/* Role Filter Dropdown */}
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
              <select
                value={roleFilter}
                onChange={(e) => handleRoleFilterChange(e.target.value)}
                className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles ({totalCount})</option>
                <option value="super_admin">Super Admins</option>
                <option value="admin">Admins</option>
                <option value="moderator">Moderators</option>
                <option value="support">Support</option>
                <option value="candidate">Candidates</option>
                <option value="test_candidate">Test Candidates ({testCount})</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Action Status Banner */}
      {actionFeedback && (
        <div
          role="status"
          className={`mx-4 p-3 rounded-xl border flex items-center justify-between text-xs font-medium ${
            actionFeedback.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionFeedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{actionFeedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionFeedback(null)}
            className="text-slate-400 hover:text-slate-600 text-xs"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4 sm:px-6">User</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4">Joined</th>
              <th className="py-3 px-4 sm:px-6 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Users className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    <p className="font-medium text-slate-600 dark:text-slate-400">
                      No matching users found.
                    </p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                      Try adjusting your search criteria or resetting filters.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedUsers.map((user) => {
                const isProcessing = processingUserId === user.id && isPending;
                const formattedDate = new Date(user.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });
                const isTest = Boolean(
                  user.isTestUser ?? (user.email.endsWith("@upaguru.test") || user.email.includes(".test"))
                );

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* User Info */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full font-bold flex items-center justify-center shrink-0 ${
                            isTest
                              ? "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                              : "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                          }`}
                        >
                          {(user.fullName || user.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                              {user.fullName || "Unnamed Candidate"}
                            </span>

                            {/* Test User Badge */}
                            {isTest && (
                              <span
                                title="Synthetic Test Candidate (@upaguru.test)"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                              >
                                <FlaskConical className="w-2.5 h-2.5 text-purple-500" />
                                <span>TEST</span>
                              </span>
                            )}

                            {user.gender && user.gender !== "prefer_not_to_say" && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 capitalize">
                                {user.gender}
                              </span>
                            )}
                            {user.maritalStatus && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 capitalize">
                                {user.maritalStatus.replace(/_/g, " ")}
                              </span>
                            )}
                          </div>
                          <span className="text-slate-500 dark:text-slate-400 truncate text-[11px]">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <RoleBadge role={user.role} isTestUser={isTest} />
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 text-center">
                      {user.isBlocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">
                          <ShieldAlert className="w-3 h-3" />
                          <span>Blocked</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Active</span>
                        </span>
                      )}
                    </td>

                    {/* Joined Date */}
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {formattedDate}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <div className="inline-flex items-center gap-2">
                        {/* Role selection dropdown */}
                        <select
                          disabled={isProcessing}
                          value={user.role}
                          onChange={(e) =>
                            handleRoleChange(
                              user.id,
                              e.target.value as "super_admin" | "admin" | "moderator" | "support" | "candidate"
                            )
                          }
                          className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                        >
                          <option value="candidate">
                            {isTest ? "Test Candidate" : "Candidate"}
                          </option>
                          <option value="support">Support</option>
                          <option value="moderator">Moderator</option>
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>

                        {/* Block/Unblock Button */}
                        <button
                          type="button"
                          onClick={() => handleBlockToggle(user)}
                          disabled={isProcessing}
                          className={`p-1.5 rounded-lg border transition ${
                            user.isBlocked
                              ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200"
                              : "bg-red-50 text-red-700 hover:bg-red-100 border-red-200"
                          }`}
                          title={user.isBlocked ? "Reactivate User" : "Block User"}
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : user.isBlocked ? (
                            <UserCheck className="w-3.5 h-3.5" />
                          ) : (
                            <UserX className="w-3.5 h-3.5" />
                          )}
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

      {/* Pagination Footer Toolbar */}
      <div className="px-4 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <span>
            Showing <strong className="text-slate-700 dark:text-slate-200">{totalFilteredCount > 0 ? startIndex + 1 : 0}</strong> to{" "}
            <strong className="text-slate-700 dark:text-slate-200">{endIndex}</strong> of{" "}
            <strong className="text-slate-700 dark:text-slate-200">{totalFilteredCount}</strong> users
          </span>

          <span className="text-slate-300 dark:text-slate-600">|</span>

          {/* Rows per page selector */}
          <div className="flex items-center gap-1.5">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value={15}>15</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={-1}>All</option>
            </select>
          </div>
        </div>

        {/* Page navigation buttons */}
        {!isAllPages && totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            {/* Smart page numbers */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === totalPages ||
                  (p >= safePage - 1 && p <= safePage + 1)
              )
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;

                return (
                  <React.Fragment key={p}>
                    {showEllipsis && (
                      <span className="px-1 text-slate-400">…</span>
                    )}
                    <button
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`min-w-[28px] h-7 px-2 rounded-lg font-medium text-xs transition ${
                        p === safePage
                          ? "bg-blue-600 text-white shadow-xs font-bold"
                          : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                      }`}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                );
              })}

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition"
              aria-label="Next page"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

