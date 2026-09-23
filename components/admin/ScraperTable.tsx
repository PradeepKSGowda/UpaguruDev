"use client";

/**
 * @file components/admin/ScraperTable.tsx
 * @description Interactive administrative table monitoring crawler status across recruitment bodies
 * (KPSC, UPSC, SSC, RRB, IBPS), displaying discovered timestamps, active vs expired counts,
 * and providing manual extraction execution triggers.
 * 
 * Architecture Reference: ADR-001 (Frontend RSC/Client), ADR-002 (Database), ADR-003 (RBAC)
 */

import React, { useState, useTransition } from "react";
import {
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Calendar,
  Layers,
  Sparkles,
  ArrowRight,
  Filter,
} from "lucide-react";
import Link from "next/link";
import type { ScraperOrgStats, ScraperOverviewData } from "../../lib/data/scrapers";
import { triggerManualExtraction } from "../../app/admin/scrapers/actions";

export interface ScraperTableProps {
  scrapers?: ScraperOrgStats[] | ScraperOverviewData | null;
  lastUpdated?: string | null;
}

/**
 * Formats ISO date into human-readable Indian Standard Time format (e.g., "18 Sept 2026, 06:00 AM")
 */
function formatDiscoveredAt(isoString?: string | null): string {
  if (!isoString) return "Never extracted";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Invalid date";

    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    }).format(date);
  } catch {
    return "Invalid date";
  }
}

export default function ScraperTable({ scrapers, lastUpdated }: ScraperTableProps) {
  const [activePortalAction, setActivePortalAction] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{
    portal: string;
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [searchFilter, setSearchFilter] = useState("");
  const [, startTransition] = useTransition();

  // Defensively extract scraper list whether scrapers is an array or the full overview object
  const scraperList: ScraperOrgStats[] = React.useMemo(() => {
    if (!scrapers) return [];
    if (Array.isArray(scrapers)) return scrapers;
    if (typeof scrapers === "object" && "scrapers" in scrapers && Array.isArray(scrapers.scrapers)) {
      return scrapers.scrapers;
    }
    return [];
  }, [scrapers]);

  const rawLastUpdated =
    lastUpdated ||
    (scrapers && typeof scrapers === "object" && "lastUpdated" in scrapers ? scrapers.lastUpdated : null);

  const formattedLastUpdated = React.useMemo(() => {
    try {
      const d = rawLastUpdated ? new Date(rawLastUpdated) : new Date();
      if (isNaN(d.getTime())) return "Just now";
      return new Intl.DateTimeFormat("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "Asia/Kolkata",
      }).format(d);
    } catch {
      return "Just now";
    }
  }, [rawLastUpdated]);

  const filteredScrapers = scraperList.filter((s) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return s.portalCode.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
  });

  const handleManualExtract = (portalCode: string) => {
    setActivePortalAction(portalCode);
    setActionMessage(null);

    startTransition(async () => {
      try {
        const res = await triggerManualExtraction(portalCode);
        if (res.success) {
          setActionMessage({
            portal: portalCode,
            type: "success",
            text: res.message,
          });
        } else {
          setActionMessage({
            portal: portalCode,
            type: "error",
            text: res.message,
          });
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Manual extraction request failed";
        setActionMessage({
          portal: portalCode,
          type: "error",
          text: msg,
        });
      } finally {
        setActivePortalAction(null);
      }
    });
  };

  return (
    <div
      id="admin-scrapers-section"
      data-testid="admin-scrapers-section"
      className="space-y-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden"
    >
      {/* Header Bar */}
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <Layers className="w-4 h-4" />
            </div>
            <h2 className="text-lg sm:text-xl font-heading font-black text-slate-900 dark:text-white tracking-tight">
              Recruitment Portal Scrapers
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
              {scraperList.length} Supported
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Real-time crawler telemetry, extraction discovery timestamps, and manual trigger controls.
          </p>
        </div>

        {/* Filter input & last refresh timestamp */}
        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <div className="relative">
            <Filter className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter by portal (e.g. UPSC, KPSC)..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-60"
            />
          </div>

          <div className="text-[11px] text-slate-400 font-medium hidden md:block">
            Updated: <span className="font-mono text-slate-600 dark:text-slate-300">{formattedLastUpdated} IST</span>
          </div>
        </div>
      </div>

      {/* Action Status Feedback Alert */}
      {actionMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`mx-4 sm:mx-6 p-3 rounded-xl border flex items-center justify-between text-xs font-medium animate-in fade-in duration-200 ${
            actionMessage.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300"
              : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/60 text-red-800 dark:text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
            )}
            <span>
              <strong>[{actionMessage.portal}]</strong> {actionMessage.text}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table
          id="admin-scrapers-table"
          data-testid="admin-scrapers-table"
          className="w-full text-left border-collapse text-xs sm:text-sm"
        >
          {/* Table Header Styled with Rich Blue Theme per Sample Design */}
          <thead>
            <tr className="bg-blue-700 text-white font-heading text-xs uppercase tracking-wider select-none">
              <th className="py-3 px-4 sm:px-6 font-bold rounded-tl-none">Organisation</th>
              <th className="py-3 px-4 font-bold">DISCOVERED AT</th>
              <th className="py-3 px-4 font-bold text-center">Total Notifications</th>
              <th className="py-3 px-4 font-bold text-center">Expired</th>
              <th className="py-3 px-4 font-bold text-center">Ongoing</th>
              <th className="py-3 px-4 font-bold text-center">Queue Status</th>
              <th className="py-3 px-4 sm:px-6 font-bold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
            {filteredScrapers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 text-xs">
                  No matching recruitment portals found.
                </td>
              </tr>
            ) : (
              filteredScrapers.map((item, idx) => {
                const isExecuting = activePortalAction === item.portalCode;
                const isEven = idx % 2 === 0;

                return (
                  <tr
                    key={item.portalCode}
                    data-testid={`scraper-row-${item.portalCode.toLowerCase()}`}
                    className={`transition-colors hover:bg-blue-50/60 dark:hover:bg-slate-800/60 ${
                      isEven ? "bg-white dark:bg-slate-900" : "bg-slate-50/50 dark:bg-slate-850/40"
                    }`}
                  >
                    {/* 1. Organisation */}
                    <td className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-heading font-black text-xs flex items-center justify-center border border-blue-200/80 dark:border-blue-800/80 shrink-0">
                          {item.portalCode}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-heading font-bold text-sm text-slate-900 dark:text-white">
                              {item.portalCode}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 text-[9px] font-bold uppercase rounded ${
                                item.stateOrCentral === "Central"
                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
                              }`}
                            >
                              {item.stateOrCentral}
                            </span>
                          </div>
                          <a
                            href={item.officialWebsite}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-300 truncate max-w-xs sm:max-w-sm inline-flex items-center gap-1 transition"
                            title={item.name}
                          >
                            <span>{item.name}</span>
                            <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                          </a>
                        </div>
                      </div>
                    </td>

                    {/* 2. DISCOVERED AT */}
                    <td className="py-3.5 px-4 font-mono text-xs">
                      {item.discoveredAt ? (
                        <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-semibold">{formatDiscoveredAt(item.discoveredAt)}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 dark:text-slate-500 italic text-[11px]">
                          Pending first run
                        </span>
                      )}
                    </td>

                    {/* 3. Total Notifications */}
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-full font-bold text-xs bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700">
                        {item.totalNotifications}
                      </span>
                    </td>

                    {/* 4. Expired */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-full font-semibold text-xs ${
                          item.expiredCount > 0
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60"
                            : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                        }`}
                      >
                        {item.expiredCount}
                      </span>
                    </td>

                    {/* 5. Ongoing */}
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-full font-bold text-xs ${
                          item.ongoingCount > 0
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60"
                            : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
                        }`}
                      >
                        {item.ongoingCount}
                      </span>
                    </td>

                    {/* 6. Queue Status / Extra Telemetry */}
                    <td className="py-3.5 px-4 text-center">
                      {item.pendingDraftsCount > 0 ? (
                        <Link
                          href={`/admin/drafts?search=${item.portalCode}`}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-200 transition"
                          title="View pending drafts for this organization"
                        >
                          <Clock className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                          <span>{item.pendingDraftsCount} to review</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>Clean</span>
                        </span>
                      )}
                    </td>

                    {/* 7. Manual Extract Action Button */}
                    <td className="py-3.5 px-4 sm:px-6 text-right">
                      <button
                        type="button"
                        id={`btn-extract-${item.portalCode.toLowerCase()}`}
                        data-testid={`btn-manual-extract-${item.portalCode.toLowerCase()}`}
                        onClick={() => handleManualExtract(item.portalCode)}
                        disabled={isExecuting}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:border-blue-400 dark:hover:border-blue-500 shadow-xs transition hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
                        title={`Trigger manual crawl for ${item.portalCode}`}
                      >
                        {isExecuting ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
                            <span>Extracting...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                            <span>Manual Extract</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer Insight */}
      <div className="p-3.5 sm:px-6 bg-slate-50/60 dark:bg-slate-850/40 border-t border-slate-200/80 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>
            Scrapers operate under strict HITL invariants: Extracted circulars route exclusively to the draft verification queue.
          </span>
        </div>
        <Link
          href="/admin/drafts"
          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0 flex items-center gap-1"
        >
          <span>Open Review Queue</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
