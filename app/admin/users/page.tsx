/**
 * @file app/admin/users/page.tsx
 * @description Admin User Management Directory Page.
 * Allows administrators to search, filter, inspect, and manage user roles and account statuses.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 * Architecture Reference: ADR-003 (RBAC), ADR-013 (Security)
 */

import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Users, UserPlus, ArrowRight, Shield } from "lucide-react";
import { getUsersDirectory, getUserKpiStats } from "./actions";
import { UserDirectoryTable, UserKpiCards } from "@/components/admin";

export const metadata: Metadata = {
  title: "User Management | Admin Portal - UPA-GURU",
  description: "Manage candidate and administrator accounts, assign roles, and audit access permissions.",
};

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const [kpiStats, usersResult] = await Promise.all([
    getUserKpiStats().catch(() => ({
      totalUsers: 0,
      activeUsers: 0,
      blockedUsers: 0,
      verifiedUsers: 0,
      totalBookmarks: 0,
      totalNotes: 0,
      newUsersToday: 0,
    })),
    getUsersDirectory({ page: 1, limit: 50 }).catch(() => ({
      users: [],
      totalCount: 0,
      activeCount: 0,
      blockedCount: 0,
    })),
  ]);

  return (
    <div id="admin-users-page" className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-slate-900 dark:text-white tracking-tight">
              User Management & Directory
            </h1>
            <p className="mt-0.5 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Manage platform users, assign role privileges, and inspect authentication status.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/settings/profile"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-sm transition"
          >
            <Shield className="w-3.5 h-3.5 text-slate-400" />
            <span>Admin Settings</span>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <section aria-label="User Statistics">
        <UserKpiCards stats={kpiStats} />
      </section>

      {/* User Directory Table */}
      <section aria-label="User Directory Table">
        <UserDirectoryTable
          initialUsers={usersResult.users}
          totalCount={usersResult.totalCount}
        />
      </section>
    </div>
  );
}
