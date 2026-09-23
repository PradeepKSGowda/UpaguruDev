/**
 * @file lib/data/scrapers.ts
 * @description Strongly-typed server-side data access layer aggregating scraper crawler telemetry,
 * dynamic portal discovery, extraction timestamps, and active vs expired notification counts.
 * 
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-002 (Database), ADR-003 (RBAC)
 */

import { createServerClient } from "../supabase/server";
import { PORTAL_REGISTRY, getPortalConfig, normalizePortalCode } from "../scrapers/registry";

export interface ScraperOrgStats {
  portalCode: string;
  name: string;
  officialWebsite: string;
  stateOrCentral: "State" | "Central";
  discoveredAt: string | null;
  totalNotifications: number;
  expiredCount: number;
  ongoingCount: number;
  pendingDraftsCount: number;
  lastRunStatus: "idle" | "running" | "completed" | "failed";
  lastRunId?: string | null;
  pdfsFoundLastRun: number;
  pdfsNewLastRun: number;
}

export interface ScraperOverviewData {
  scrapers: ScraperOrgStats[];
  totalPortalsCount: number;
  totalDraftsCount: number;
  totalExpiredCount: number;
  totalOngoingCount: number;
  lastUpdated: string;
}

/**
 * Resolves whether an application deadline has expired or is ongoing
 */
function isDateExpired(dateString?: string | null, fallbackCreatedAt?: string): boolean {
  if (!dateString) {
    if (!fallbackCreatedAt) return false;
    // If no deadline declared, consider active for 45 days after discovery
    const createdTime = new Date(fallbackCreatedAt).getTime();
    const fortyFiveDays = 45 * 24 * 60 * 60 * 1000;
    return Date.now() > createdTime + fortyFiveDays;
  }

  const parsed = new Date(dateString);
  if (isNaN(parsed.getTime())) return false;
  return parsed.getTime() < Date.now();
}

interface CrawlRunRecord {
  id: string;
  portal_code: string;
  started_at: string;
  finished_at?: string | null;
  status: string;
  pdfs_found?: number;
  pdfs_new?: number;
  pdfs_failed?: number;
  created_at?: string;
}

/**
 * Fetches all registered and dynamically discovered scraper portals with their respective metrics.
 */
export async function getScraperManagementData(): Promise<ScraperOverviewData> {
  const supabase = await createServerClient();

  // 1. Fetch all crawl_runs ordered by started_at DESC
  const { data: crawlRuns } = await supabase
    .from("crawl_runs")
    .select("id, portal_code, started_at, finished_at, status, pdfs_found, pdfs_new, pdfs_failed, created_at")
    .order("started_at", { ascending: false });

  // 2. Fetch all draft_notifications
  const { data: drafts } = await supabase
    .from("draft_notifications")
    .select("id, status, parsed_json, created_at");

  // 3. Fetch all published notifications with their parent exam
  const { data: notifications } = await supabase
    .from("notifications")
    .select("id, title, application_end_date, created_at, exams(conducting_body)");

  // Discover all distinct portal codes: static registry + crawl_runs + drafts + notifications
  const portalSet = new Set<string>(Object.keys(PORTAL_REGISTRY));

  (crawlRuns || []).forEach((run) => {
    if (run.portal_code) portalSet.add(normalizePortalCode(run.portal_code));
  });

  (drafts || []).forEach((d) => {
    const parsed = d.parsed_json as Record<string, unknown> | null;
    const body = (parsed?.conducting_body as string) || (parsed?.conductingBody as string);
    if (body) portalSet.add(normalizePortalCode(body));
  });

  (notifications || []).forEach((n) => {
    const exam = n.exams as { conducting_body?: string } | null;
    if (exam?.conducting_body) portalSet.add(normalizePortalCode(exam.conducting_body));
  });

  // Calculate metrics per portal
  const scrapers: ScraperOrgStats[] = Array.from(portalSet).map((portalCode) => {
    const config = getPortalConfig(portalCode);

    // Latest crawl run for this portal
    const runsForPortal = (crawlRuns || []).filter(
      (r) => normalizePortalCode(r.portal_code) === portalCode
    );
    const latestRun = runsForPortal[0];

    // Drafts for this portal
    const draftsForPortal = (drafts || []).filter((d) => {
      const parsed = d.parsed_json as Record<string, unknown> | null;
      const body = normalizePortalCode((parsed?.conducting_body as string) || (parsed?.conductingBody as string) || "");
      return body === portalCode;
    });

    // Published notifications for this portal
    const notifsForPortal = (notifications || []).filter((n) => {
      const exam = n.exams as { conducting_body?: string } | null;
      return normalizePortalCode(exam?.conducting_body || "") === portalCode;
    });

    // Count pending drafts
    const pendingDrafts = draftsForPortal.filter((d) => d.status === "pending_review").length;

    // Discovered at timestamp: latest from crawl runs OR latest draft created_at
    const latestDraftCreated = draftsForPortal.length > 0 ? draftsForPortal[0].created_at : null;
    const discoveredAt = latestRun?.started_at || latestDraftCreated || null;

    // Calculate Expired vs Ongoing
    let expiredCount = 0;
    let ongoingCount = 0;

    // Process drafts
    draftsForPortal.forEach((d) => {
      const parsed = d.parsed_json as Record<string, unknown> | null;
      const dates = parsed?.important_dates as Record<string, unknown> | null;
      const appEnd = (dates?.application_end as string) || null;

      if (isDateExpired(appEnd, d.created_at)) {
        expiredCount++;
      } else {
        ongoingCount++;
      }
    });

    // Process published notifications
    notifsForPortal.forEach((n) => {
      if (isDateExpired(n.application_end_date, n.created_at)) {
        expiredCount++;
      } else {
        ongoingCount++;
      }
    });

    const totalNotifications = draftsForPortal.length + notifsForPortal.length;

    // Determine status
    let lastRunStatus: "idle" | "running" | "completed" | "failed" = "idle";
    if (latestRun) {
      if (latestRun.status === "running") lastRunStatus = "running";
      else if (latestRun.status === "completed") lastRunStatus = "completed";
      else if (latestRun.status === "failed") lastRunStatus = "failed";
    }

    return {
      portalCode,
      name: config.name,
      officialWebsite: config.officialWebsite,
      stateOrCentral: config.stateOrCentral,
      discoveredAt,
      totalNotifications,
      expiredCount,
      ongoingCount,
      pendingDraftsCount: pendingDrafts,
      lastRunStatus,
      lastRunId: latestRun?.id || null,
      pdfsFoundLastRun: latestRun?.pdfs_found ?? 0,
      pdfsNewLastRun: latestRun?.pdfs_new ?? 0,
    };
  });

  // Sort: Portals with most notifications and recent activity first
  scrapers.sort((a, b) => {
    if (b.totalNotifications !== a.totalNotifications) {
      return b.totalNotifications - a.totalNotifications;
    }
    if (b.discoveredAt && a.discoveredAt) {
      return new Date(b.discoveredAt).getTime() - new Date(a.discoveredAt).getTime();
    }
    if (b.discoveredAt) return 1;
    if (a.discoveredAt) return -1;
    return a.portalCode.localeCompare(b.portalCode);
  });

  return {
    scrapers,
    totalPortalsCount: scrapers.length,
    totalDraftsCount: (drafts || []).length,
    totalExpiredCount: scrapers.reduce((acc, s) => acc + s.expiredCount, 0),
    totalOngoingCount: scrapers.reduce((acc, s) => acc + s.ongoingCount, 0),
    lastUpdated: new Date().toISOString(),
  };
}
