/**
 * @file app/admin/scrapers/page.tsx
 * @description Dedicated Admin Scraper & Crawler Management Cockpit.
 * Allows administrators to monitor all registered and dynamically discovered recruitment portals
 * (KPSC, UPSC, RRB, SSC, IBPS, etc.), view discovery timestamps, total, expired, and ongoing notifications,
 * and trigger manual live extractions on-demand.
 * 
 * Task ID: TASK-03010103
 * Architecture Reference: ADR-001 (Frontend Architecture), ADR-003 (RBAC), ADR-004 (Scraper Pipeline)
 */

import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Bot,
  Layers,
  Sparkles,
  ArrowRight,
  Database,
  History,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { getScraperManagementData } from "@/lib/data/scrapers";
import { ScraperTable, StatsCard } from "@/components/admin";

export const metadata: Metadata = {
  title: "Scrapers Management | Admin Portal - UPA-GURU",
  description: "Monitor and trigger recruitment portal crawlers (KPSC, UPSC, RRB, SSC, IBPS) with live manual extraction.",
};

// Force dynamic fetch so recent crawl runs are always fresh
export const dynamic = "force-dynamic";

export default async function AdminScrapersPage() {
  const overview = await getScraperManagementData();
  const scrapers = overview.scrapers;

  const totalScrapers = scrapers.length;
  const activeScrapers = scrapers.filter((s) => s.lastRunStatus === "completed" || s.lastRunStatus === "running").length;
  const totalNotifications = overview.totalDraftsCount;
  const totalOngoing = overview.totalOngoingCount;

  return (
    <div id="admin-scrapers-page" className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-heading font-black text-slate-900 dark:text-white tracking-tight">
                Scraper & Crawler Operations
              </h1>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                Monitor recruitment portals, view notification lifecycles, and trigger manual extractions.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex items-center gap-3">
          <Link
            href="/admin/drafts"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-sm transition"
          >
            <span>Review Drafts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href="/admin/audit-logs"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-sm transition"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>Audit Trail</span>
          </Link>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <section aria-label="Scraper KPIs" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          testId="scraper-stat-total-portals"
          title="Monitored Portals"
          value={totalScrapers}
          description="KPSC, UPSC, RRB, SSC, IBPS & discovered portals"
          icon={Layers}
          colorScheme="blue"
          badgeText="Active Registry"
        />

        <StatsCard
          testId="scraper-stat-total-notifications"
          title="Notifications Discovered"
          value={totalNotifications}
          description="Extracted across all official government sources"
          icon={Database}
          colorScheme="purple"
          badgeText="All Time"
        />

        <StatsCard
          testId="scraper-stat-ongoing-exams"
          title="Ongoing Applications"
          value={totalOngoing}
          description="Notifications currently accepting candidate submissions"
          icon={CheckCircle2}
          colorScheme="emerald"
          badgeText="Active Window"
        />

        <StatsCard
          testId="scraper-stat-healthy-portals"
          title="Healthy Crawlers"
          value={`${activeScrapers} / ${totalScrapers}`}
          description="Portals with successful recent execution logs"
          icon={Bot}
          colorScheme="amber"
          badgeText="System Health"
        />
      </section>

      {/* Main Scraper Table Section */}
      <section aria-label="Portals Table">
        <ScraperTable scrapers={scrapers} lastUpdated={overview.lastUpdated} />
      </section>

      {/* Architectural Explainer Card */}
      <section aria-label="Pipeline Architecture">
        <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 border border-blue-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Extensible Scraper Microservice & HITL Verification
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl">
                When you click <strong className="font-semibold text-slate-800 dark:text-slate-200">Manual Extract</strong>, the admin portal triggers the Python crawler engine to fetch fresh notification PDFs from the official examination portal. Discovered documents are ingested as drafts into the verification queue for Human-In-The-Loop review before going live.
              </p>
            </div>
          </div>
          <Link
            href="/admin/drafts"
            className="shrink-0 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 transition flex items-center gap-1.5"
          >
            <span>Open Verification Queue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
