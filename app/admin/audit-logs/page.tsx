/**
 * @file app/admin/audit-logs/page.tsx
 * @description Administrative Audit Log Viewer page rendering forensic action logs,
 * date range filtering, action pills, and metadata JSON inspection.
 * 
 * Task ID: TASK-03040101 (Subtask: SUB-0304010101, SUB-0304010102)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-013 (Security & Audit Trail)
 */

import React from "react";
import { Metadata } from "next";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { getAuditLogs } from "@/lib/data/audit-logs";
import { ValidatedAuditLogFilter } from "@/lib/schemas/audit-logs";
import AuditLogsTable from "@/components/admin/AuditLogsTable";

export const metadata: Metadata = {
  title: "Audit Logs | Admin HITL Portal",
  description: "Forensic administrative audit trail and change history for platform accountability.",
};

interface AdminAuditLogsPageProps {
  searchParams: Promise<{
    q?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
  }>;
}

export default async function AdminAuditLogsPage({ searchParams }: AdminAuditLogsPageProps) {
  const resolvedParams = await searchParams;
  const searchQuery = resolvedParams.q || "";
  const selectedAction = (resolvedParams.action as ValidatedAuditLogFilter["action"]) || "all";
  const startDate = resolvedParams.startDate || "";
  const endDate = resolvedParams.endDate || "";
  const currentPage = parseInt(resolvedParams.page || "1", 10) || 1;

  const { logs, total, totalPages, pageSize } = await getAuditLogs({
    search: searchQuery,
    action: selectedAction,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page: currentPage,
    pageSize: 20,
  });

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-900 p-6 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800/80 flex items-center justify-center text-purple-600 dark:text-purple-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
                Administrative Audit Logs
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                <ShieldCheck className="w-3.5 h-3.5" />
                Forensic Ledger
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Immutable telemetry tracking all publication decisions, exam edits, and administrative mutations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs uppercase font-bold tracking-wider text-gray-400 block">
              Total Recorded Events
            </span>
            <span className="text-2xl font-extrabold text-gray-900 dark:text-gray-100">
              {total}
            </span>
          </div>
        </div>
      </div>

      {/* Main Table with Filters & Metadata Inspector */}
      <AuditLogsTable
        logs={logs}
        total={total}
        currentPage={currentPage}
        pageSize={pageSize}
        totalPages={totalPages}
        searchQuery={searchQuery}
        selectedAction={selectedAction}
        startDate={startDate}
        endDate={endDate}
      />
    </div>
  );
}
