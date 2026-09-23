"use client";

/**
 * @file components/admin/UserDirectoryTable.tsx
 * @description Interactive administrative user directory table with search, role filters,
 * block/reactivate toggles, and role reassignment controls.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import React, { useState, useTransition } from "react";
import {
  Search,
  Filter,
  Shield,
  ShieldAlert,
  UserX,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  MoreVertical,
  Mail,
  Calendar,
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
  const [actionFeedback, setActionFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [processingUserId, setProcessingUserId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchQuery.trim() ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.fullName && u.fullName.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

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
      <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-800/30">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Roles ({totalCount})</option>
            <option value="super_admin">Super Admins</option>
            <option value="admin">Admins</option>
            <option value="moderator">Moderators</option>
            <option value="support">Support</option>
            <option value="candidate">Candidates</option>
          </select>
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
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-slate-400">
                  No matching users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const isProcessing = processingUserId === user.id && isPending;
                const formattedDate = new Date(user.createdAt).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                });

                return (
                  <tr
                    key={user.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* User Info */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0">
                          {(user.fullName || user.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-900 dark:text-white truncate">
                            {user.fullName || "Unnamed Candidate"}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 truncate text-[11px]">
                            {user.email}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-3.5 px-4">
                      <RoleBadge role={user.role} />
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
                          <option value="candidate">Candidate</option>
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
    </div>
  );
}
