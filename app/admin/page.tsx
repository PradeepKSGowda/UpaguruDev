/**
 * @file app/admin/page.tsx
 * @description Admin Dashboard Overview Page displaying real-time KPI statistic cards
 * (pending review drafts, published today, total notifications, exams count),
 * high-priority quick action links, and recent pending draft verification queue.
 * 
 * Task ID: TASK-03010102 (Subtask: SUB-0301010201)
 * Architecture Reference: ADR-001 (Frontend Architecture), ADR-002 (Database), ADR-013 (Security)
 */

import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  ClipboardCheck,
  CheckCircle2,
  Bell,
  GraduationCap,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
  PlusCircle,
  FileSearch,
  Sparkles,
} from "lucide-react";
import { StatsCard, ScraperTable } from "../../components/admin";
import { getAdminDashboardStats } from "../../lib/data/admin-dashboard";
import { getScraperManagementData } from "../../lib/data/scrapers";

export const metadata: Metadata = {
  title: "Dashboard Overview | Admin Portal - UPA-GURU",
  description: "Human-In-The-Loop (HITL) Verification pipeline and system operational stats.",
};

function formatConfidenceScore(score: number): { label: string; bg: string; text: string } {
  const percentage = Math.round(score * 100);
  if (percentage >= 90) {
    return {
      label: `${percentage}% High`,
      bg: "bg-emerald-100 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-300",
    };
  }
  if (percentage >= 85) {
    return {
      label: `${percentage}% Moderate`,
      bg: "bg-amber-100 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800",
      text: "text-amber-700 dark:text-amber-300",
    };
  }
  return {
    label: `${percentage}% Low`,
    bg: "bg-red-100 dark:bg-red-950/60 border-red-200 dark:border-red-800",
    text: "text-red-700 dark:text-red-300",
  };
}

export default async function AdminDashboardPage() {
  const [stats, scraperOverview] = await Promise.all([
    getAdminDashboardStats(),
    getScraperManagementData(),
  ]);

  const formattedDate = new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(stats.calculatedAt));

  return (
    <div id="admin-dashboard-page" className="space-y-8 max-w-7xl mx-auto">
      {/* 1. Header Banner & System Health Status */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-slate-900 dark:text-white tracking-tight">
              HITL Verification Cockpit
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Real-time pipeline monitoring, AI draft extraction queue, and master exam catalog.
          </p>
        </div>

        {/* Refresh / Server Time Badge */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm self-start md:self-auto">
          <span>IST:</span>
          <span className="font-mono text-slate-900 dark:text-slate-200 font-semibold">{formattedDate}</span>
        </div>
      </div>

      {/* 2. Quick Action Bar (SUB-03010102 Acceptance Criteria) */}
      <section id="admin-quick-actions" aria-label="Admin Quick Actions" className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Operational Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link
            id="admin-action-draft-queue-btn"
            href="/admin/drafts"
            className="flex items-center justify-between p-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm shadow-blue-500/20 transition group focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <div className="flex items-center gap-2.5">
              <ClipboardCheck className="w-5 h-5 text-blue-100" />
              <span>Review Drafts Queue</span>
            </div>
            {stats.pendingDraftsCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-400 text-slate-950 shadow-sm">
                {stats.pendingDraftsCount}
              </span>
            ) : (
              <ArrowRight className="w-4 h-4 text-blue-200 group-hover:translate-x-1 transition-transform" />
            )}
          </Link>

          <Link
            id="admin-action-manage-exams-btn"
            href="/admin/exams"
            className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm shadow-sm transition group focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <div className="flex items-center gap-2.5">
              <PlusCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <span>Manage Exam Series</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            id="admin-action-notifications-btn"
            href="/admin/notifications"
            className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm shadow-sm transition group focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <div className="flex items-center gap-2.5">
              <Bell className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <span>Published Notifications</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Link>

          <Link
            id="admin-action-audit-logs-btn"
            href="/admin/audit-logs"
            className="flex items-center justify-between p-3.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm shadow-sm transition group focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              <span>System Audit Logs</span>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* 3. Operational KPI Statistics Cards (SUB-0301010201) */}
      <section aria-label="Operational Metrics">
        <div id="admin-stats-grid" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
          <StatsCard
            testId="admin-stat-pending-drafts"
            title="Pending Review Drafts"
            value={stats.pendingDraftsCount}
            description="AI-extracted notifications requiring HITL review"
            icon={ClipboardCheck}
            colorScheme="amber"
            href="/admin/drafts"
            badgeText={stats.pendingDraftsCount > 0 ? "Action Required" : "Queue Empty"}
          />

          <StatsCard
            testId="admin-stat-published-today"
            title="Published Today"
            value={stats.publishedTodayCount}
            description="Live notifications published since 00:00 UTC"
            icon={CheckCircle2}
            colorScheme="emerald"
            href="/admin/notifications"
            badgeText="Today"
          />

          <StatsCard
            testId="admin-stat-total-published"
            title="Total Published Notifications"
            value={stats.totalPublishedCount}
            description="Active notifications across all categories"
            icon={Bell}
            colorScheme="blue"
            href="/admin/notifications"
            badgeText="Live Portal"
          />

          <StatsCard
            testId="admin-stat-total-exams"
            title="Exam Series Registered"
            value={stats.totalExamsCount}
            description="Master competitive exam boards and entities"
            icon={GraduationCap}
            colorScheme="purple"
            href="/admin/exams"
            badgeText="Master Taxonomy"
          />
        </div>
      </section>

      {/* 4. Examination Scrapers & Crawlers (Dynamic Discovery & Manual Extraction) */}
      <section aria-label="Examination Scrapers" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-heading font-bold text-slate-900 dark:text-white">
              Recruitment Portals & Scrapers
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Live crawler status, recent extraction timestamps, and manual trigger controls.
            </p>
          </div>
          <Link
            id="admin-view-all-scrapers-link"
            href="/admin/scrapers"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 group"
          >
            <span>Dedicated Scrapers View</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        <ScraperTable
          scrapers={scraperOverview.scrapers}
          lastUpdated={scraperOverview.lastUpdated}
        />
      </section>

      {/* 5. Recent Pending Review Drafts Preview */}
      <section aria-label="Recent Pending Drafts" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-heading font-bold text-slate-900 dark:text-white">
              Recent Drafts Awaiting Verification
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              High-priority scraper extractions requiring administrator validation.
            </p>
          </div>
          <Link
            id="admin-view-all-drafts-link"
            href="/admin/drafts"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1 group"
          >
            <span>View Full Queue ({stats.pendingDraftsCount})</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {stats.recentPendingDrafts.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-heading font-bold text-base text-slate-900 dark:text-white">
              Draft Queue Clean
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              No pending drafts awaiting human review. The automated scrapers will populate new drafts as notifications are discovered.
            </p>
          </div>
        ) : (
          <div
            id="admin-recent-drafts-table"
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/40 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 sm:px-6">Source URL</th>
                    <th className="py-3 px-4">Extraction Confidence</th>
                    <th className="py-3 px-4">Discovered At</th>
                    <th className="py-3 px-4 sm:px-6 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {stats.recentPendingDrafts.map((draft) => {
                    const confidence = formatConfidenceScore(draft.extractionConfidenceScore);
                    const formattedCreated = new Date(draft.createdAt).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    });

                    return (
                      <tr
                        key={draft.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-2 max-w-sm sm:max-w-md truncate">
                            <FileSearch className="w-4 h-4 shrink-0 text-slate-400" />
                            <a
                              href={draft.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate text-xs sm:text-sm font-medium"
                              title={draft.sourceUrl}
                            >
                              {draft.sourceUrl}
                            </a>
                            <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${confidence.bg} ${confidence.text}`}
                          >
                            {confidence.label}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {formattedCreated}
                        </td>
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <Link
                            href={`/admin/drafts/${draft.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60 border border-blue-200/80 dark:border-blue-800/60 transition"
                          >
                            <span>Verify</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* 5. Verification Integrity & Audit Protocol Banner */}
      <section aria-label="Verification Architecture">
        <div className="p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-900 border border-blue-100 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Human-In-The-Loop (HITL) Protocol Enforced
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                All approved drafts trigger atomic audit trail records and on-demand ISR edge cache revalidation.
              </p>
            </div>
          </div>
          <Link
            id="admin-learn-more-audit-link"
            href="/admin/audit-logs"
            className="shrink-0 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            <span>Inspect Audit Protocol</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </section>
    </div>
  );
}
