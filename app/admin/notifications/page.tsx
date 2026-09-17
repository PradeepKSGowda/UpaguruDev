/**
 * @file app/admin/notifications/page.tsx
 * @description Administrative Notifications Management page rendering search, status filters,
 * responsive data table, and creation/deletion controls.
 * 
 * Task ID: TASK-03030102 (Subtask: SUB-0303010201)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-002 (Database)
 */

import React from "react";
import { Metadata } from "next";
import { Bell, ShieldCheck } from "lucide-react";
import { getAdminNotifications } from "@/lib/data/admin-notifications";
import { ValidatedAdminNotificationFilter } from "@/lib/schemas/admin-notifications";
import NotificationsTable from "@/components/admin/NotificationsTable";

export const metadata: Metadata = {
  title: "Notifications Master | Admin HITL Portal",
  description: "Manage public job notifications, deadlines, vacancies, and lifecycle states.",
};

interface AdminNotificationsPageProps {
  searchParams: Promise<{
    q?: string;
    status?: string;
    page?: string;
  }>;
}

export default async function AdminNotificationsPage({ searchParams }: AdminNotificationsPageProps) {
  const resolvedParams = await searchParams;
  const searchQuery = resolvedParams.q || "";
  const selectedStatus = (resolvedParams.status as ValidatedAdminNotificationFilter["status"]) || "all";
  const currentPage = parseInt(resolvedParams.page || "1", 10) || 1;

  const { notifications, total, totalPages, pageSize } = await getAdminNotifications({
    search: searchQuery,
    status: selectedStatus,
    page: currentPage,
    pageSize: 15,
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                Job Notifications Master
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                Live Feed Management
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Author, amend, and govern public job postings, application windows, and eligibility criteria.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs uppercase font-bold tracking-wider text-gray-400 block">
              Total Notifications
            </span>
            <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
              {total}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table with Filters */}
      <NotificationsTable
        notifications={notifications}
        total={total}
        currentPage={currentPage}
        pageSize={pageSize}
        totalPages={totalPages}
        searchQuery={searchQuery}
        selectedStatus={selectedStatus}
      />
    </div>
  );
}
