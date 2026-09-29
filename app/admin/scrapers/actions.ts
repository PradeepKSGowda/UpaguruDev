"use server";

/**
 * @file app/admin/scrapers/actions.ts
 * @description Next.js 15 Server Actions for initiating manual crawler extractions,
 * updating dynamic extraction URLs with audit history, verifying portal live connectivity,
 * and enforcing strict administrator authorization.
 * 
 * Architecture Reference: ADR-001 (Server Actions), ADR-002 (Database), ADR-003 (RBAC)
 */

import { revalidatePath } from "next/cache";
import { createServerClient } from "../../../lib/supabase/server";
import {
  normalizePortalCode,
  portalTriggerSchema,
  updatePortalUrlSchema,
  getPortalConfig,
  type ManualExtractResult,
  type PortalUrlHistoryEntry,
  type UpdatePortalUrlInput,
  type CrawlerParserTestResult,
  type CrawlerParserTestItem,
} from "../../../lib/scrapers/registry";

const AUTHORIZED_ROLES = new Set(["admin", "super_admin"]);

/**
 * Helper to authenticate and verify administrator privileges.
 */
async function authorizeAdmin() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authorized: false, supabase, user: null, error: "Authentication required as administrator." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role || (user.app_metadata?.role as string) || "candidate";
  if (!AUTHORIZED_ROLES.has(role)) {
    return { authorized: false, supabase, user, error: "Forbidden: Administrator privileges required." };
  }

  return { authorized: true, supabase, user, error: null };
}

/**
 * Triggers a manual crawl extraction for a specified recruitment organization portal.
 */
export async function triggerManualExtraction(
  rawPortalCode: string
): Promise<ManualExtractResult> {
  const parsed = portalTriggerSchema.safeParse({ portalCode: rawPortalCode });
  const portalCode = parsed.success ? parsed.data.portalCode : normalizePortalCode(rawPortalCode);
  
  const auth = await authorizeAdmin();
  if (!auth.authorized || !auth.user) {
    return {
      success: false,
      portal: portalCode,
      message: auth.error || "Authorization failed",
      timestamp: new Date().toISOString(),
    };
  }

  const supabase = auth.supabase;
  const user = auth.user;

  // 1. Insert a new run in `crawl_runs` with 'running' status
  let runId: string | undefined;
  try {
    const { data: run, error: runError } = await supabase
      .from("crawl_runs")
      .insert({
        portal_code: portalCode,
        started_at: new Date().toISOString(),
        status: "running",
        pdfs_found: 0,
        pdfs_new: 0,
        pdfs_failed: 0,
        logs: [
          {
            timestamp: new Date().toISOString(),
            level: "INFO",
            message: `Manual crawl extraction dispatched by admin ${user.email}`,
          },
        ],
      })
      .select("id")
      .single();

    if (!runError && run) {
      runId = run.id;
    }
  } catch (dbErr) {
    console.warn("[ScraperActions] Could not record initial crawl_runs row:", dbErr);
  }

  // 2. Dispatch trigger to Scraper Microservice if configured
  const scraperServiceUrl = process.env.SCRAPER_SERVICE_URL || "http://localhost:8000";
  const scraperApiSecret = process.env.SCRAPER_API_SECRET || "";
  let microserviceNotified = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${scraperServiceUrl}/api/trigger/${portalCode}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(scraperApiSecret ? { Authorization: `Bearer ${scraperApiSecret}` } : {}),
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      microserviceNotified = true;
    }
  } catch {
    // Scraper microservice might be running as a standalone scheduled script or daemon
    microserviceNotified = false;
  }

  // 3. In local development or standalone mode, attempt child process execution if microservice is offline
  if (!microserviceNotified && process.env.NODE_ENV !== "production") {
    try {
      const { spawn } = await import("child_process");
      // Fire-and-forget background Python extraction job
      const child = spawn("python", ["-m", "scraper.run_crawler", "--portal", portalCode], {
        detached: true,
        stdio: "ignore",
        cwd: process.cwd(),
      });
      child.unref();
      microserviceNotified = true;
    } catch (procErr) {
      console.warn("[ScraperActions] Local python trigger fallback skipped:", procErr);
    }
  }

  // 4. Revalidate Admin paths
  revalidatePath("/admin");
  revalidatePath("/admin/scrapers");

  const message = microserviceNotified
    ? `Manual extraction job for ${portalCode} dispatched successfully.`
    : `Extraction job for ${portalCode} recorded and queued for next runner cycle.`;

  return {
    success: true,
    portal: portalCode,
    message,
    runId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Updates the live extraction URL for a recruitment portal and logs the change to history.
 */
export async function updatePortalTargetUrlAction(
  rawInput: UpdatePortalUrlInput
): Promise<{ success: boolean; message: string; portalCode?: string }> {
  const parsed = updatePortalUrlSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message || "Invalid input data",
    };
  }

  const { portalCode, newUrl, reason } = parsed.data;
  const auth = await authorizeAdmin();
  if (!auth.authorized || !auth.user) {
    return { success: false, message: auth.error || "Authorization failed" };
  }

  const supabase = auth.supabase;
  const user = auth.user;

  // Retrieve current active URL
  const { data: existing } = await supabase
    .from("crawler_portals")
    .select("current_target_url, portal_name, official_website")
    .eq("portal_code", portalCode)
    .maybeSingle();

  const defaultConfig = getPortalConfig(portalCode);
  const previousUrl = existing?.current_target_url || defaultConfig.targetUrl;

  // Record into crawler_portal_url_history if the URL is changing
  if (previousUrl !== newUrl) {
    try {
      await supabase.from("crawler_portal_url_history").insert({
        portal_code: portalCode,
        previous_url: previousUrl,
        new_url: newUrl,
        reason: reason || "Target URL modified via Admin Cockpit",
        changed_by: user.id,
        changed_by_email: user.email,
      });
    } catch (histErr) {
      console.warn("[ScraperActions] Failed to write history record:", histErr);
    }
  }

  // Upsert crawler_portals
  const { error: upsertError } = await supabase.from("crawler_portals").upsert(
    {
      portal_code: portalCode,
      portal_name: existing?.portal_name || defaultConfig.name,
      official_website: existing?.official_website || defaultConfig.officialWebsite,
      current_target_url: newUrl,
      updated_at: new Date().toISOString(),
      notes: reason || null,
    },
    { onConflict: "portal_code" }
  );

  if (upsertError) {
    return { success: false, message: upsertError.message };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/scrapers");

  return {
    success: true,
    portalCode,
    message: `Target extraction URL for ${portalCode} updated successfully to ${newUrl}.`,
  };
}

/**
 * Retrieves the URL transition audit history for a given portal.
 */
export async function getPortalUrlHistoryAction(
  rawPortalCode: string
): Promise<{ success: boolean; data: PortalUrlHistoryEntry[]; error?: string }> {
  const portalCode = normalizePortalCode(rawPortalCode);
  const supabase = await createServerClient();

  const { data, error } = await supabase
    .from("crawler_portal_url_history")
    .select("id, portal_code, previous_url, new_url, reason, changed_by_email, created_at")
    .eq("portal_code", portalCode)
    .order("created_at", { ascending: false });

  if (error) {
    return { success: false, data: [], error: error.message };
  }

  const history: PortalUrlHistoryEntry[] = (data || []).map((row) => ({
    id: row.id,
    portalCode: row.portal_code,
    previousUrl: row.previous_url,
    newUrl: row.new_url,
    reason: row.reason,
    changedByEmail: row.changed_by_email,
    createdAt: row.created_at,
  }));

  return { success: true, data: history };
}

/**
 * Server-side connectivity test checking whether a target portal URL is reachable and resolves properly.
 */
export async function verifyPortalUrlAction(rawUrl: string): Promise<{
  success: boolean;
  status?: number;
  finalUrl?: string;
  isRedirect?: boolean;
  responseTimeMs?: number;
  message: string;
}> {
  try {
    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(rawUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    const responseTimeMs = Date.now() - startTime;

    const isRedirect = res.url !== rawUrl && res.url !== `${rawUrl}/` && `${res.url}/` !== rawUrl;

    return {
      success: res.ok,
      status: res.status,
      finalUrl: res.url,
      isRedirect,
      responseTimeMs,
      message: res.ok
        ? `Reachable (HTTP ${res.status} in ${responseTimeMs}ms)${isRedirect ? ` — Redirects to: ${res.url}` : ""}`
        : `Server returned HTTP ${res.status}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message:
        err.name === "AbortError"
          ? "Connection timed out after 8s"
          : err.message || "Failed to reach portal URL",
    };
  }
}

/**
 * Executes an in-portal dry-run test of the crawler parser against the target URL.
 * Inspects DOM structure, detects whether page is single-tier direct PDF or two-tier subpage,
 * samples candidate examination items, and outputs diagnostic alerts if portal has changed.
 */
export async function testCrawlerParserAction(
  rawPortalCode: string,
  customUrl?: string
): Promise<CrawlerParserTestResult> {
  const portalCode = normalizePortalCode(rawPortalCode);
  const config = getPortalConfig(portalCode);

  let targetUrl = customUrl?.trim() || config.targetUrl;

  // If no custom URL supplied, check if DB has an active override in crawler_portals
  if (!customUrl) {
    try {
      const supabase = await createServerClient();
      const { data } = await supabase
        .from("crawler_portals")
        .select("current_target_url")
        .eq("portal_code", portalCode)
        .single();
      if (data?.current_target_url) {
        targetUrl = data.current_target_url;
      }
    } catch {
      // Use config fallback
    }
  }

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    const res = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeout);
    const responseTimeMs = Date.now() - startTime;
    const finalUrl = res.url || targetUrl;

    const isRedirect =
      finalUrl !== targetUrl &&
      finalUrl !== `${targetUrl}/` &&
      `${finalUrl}/` !== targetUrl;

    if (!res.ok) {
      return {
        success: false,
        portalCode,
        targetUrl,
        finalUrl,
        isRedirect,
        httpStatus: res.status,
        responseTimeMs,
        totalElementsFound: 0,
        structureType: "unrecognized",
        diagnosticMessage: `Server responded with HTTP ${res.status}. The target page could not be loaded.`,
        diagnosticType: "error",
        items: [],
      };
    }

    const html = await res.text();

    const items: CrawlerParserTestItem[] = [];
    const seenUrls = new Set<string>();

    // Extract <a> tags with regex for cross-environment server-side execution
    const anchorRegex = /<a\s+(?:[^>]*?\s+)?href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gis;
    let match: RegExpExecArray | null;

    let directPdfCount = 0;
    let subpageCount = 0;

    while ((match = anchorRegex.exec(html)) !== null) {
      const rawHref = match[1]?.trim();
      const rawText = match[2]?.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

      if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:")) {
        continue;
      }

      let absoluteUrl = rawHref;
      try {
        absoluteUrl = new URL(rawHref, finalUrl).toString();
      } catch {
        continue;
      }

      if (seenUrls.has(absoluteUrl)) continue;

      const isDirectPdf = absoluteUrl.toLowerCase().includes(".pdf");
      const isSubpage =
        absoluteUrl.toLowerCase().includes("/examinations/") ||
        absoluteUrl.toLowerCase().includes("/recruitment/") ||
        absoluteUrl.toLowerCase().includes("/notification");

      if (!isDirectPdf && !isSubpage) {
        continue;
      }

      // Filter out utility and navigation links
      const lowerText = rawText.toLowerCase();
      if (
        !rawText ||
        lowerText === "home" ||
        lowerText === "about us" ||
        lowerText === "site map" ||
        lowerText === "sitemap" ||
        lowerText === "help" ||
        lowerText === "contact us" ||
        lowerText === "skip to main content" ||
        lowerText === "website policies" ||
        lowerText === "privacy policy" ||
        lowerText === "disclaimer" ||
        lowerText.length < 4
      ) {
        continue;
      }

      if (isDirectPdf) directPdfCount++;
      if (isSubpage && !isDirectPdf) subpageCount++;

      seenUrls.add(absoluteUrl);
      if (items.length < 8) {
        items.push({
          title: rawText,
          url: absoluteUrl,
          isDirectPdf,
        });
      }
    }

    const totalElementsFound = items.length;
    let structureType: "direct_pdf" | "two_tier_subpages" | "unrecognized" = "unrecognized";
    let diagnosticMessage = "";
    let diagnosticType: "success" | "warning" | "error" = "info" as any;

    if (isRedirect && !finalUrl.includes("/examinations") && !finalUrl.includes("/recruitment")) {
      structureType = "unrecognized";
      diagnosticType = "error";
      diagnosticMessage = `⚠️ Website Redirect Detected: The URL redirected to "${finalUrl}". The target page endpoint has moved or changed. Please update the target URL.`;
    } else if (directPdfCount > 0) {
      structureType = "direct_pdf";
      diagnosticType = "success";
      diagnosticMessage = `✅ Direct Circulars Detected: Found ${directPdfCount} direct PDF document link(s) on the index page. Crawlers can extract notifications directly without subpage traversal.`;
    } else if (subpageCount > 0) {
      structureType = "two_tier_subpages";
      diagnosticType = "warning";
      diagnosticMessage = `ℹ️ Two-Tier Examination Subpages Detected: Found ${subpageCount} individual exam landing pages (no direct PDFs on index). The crawler uses two-tier subpage traversal to extract circular PDFs from each landing page.`;
    } else {
      structureType = "unrecognized";
      diagnosticType = "error";
      diagnosticMessage = `🚨 Website Structure Changed: 0 examination notifications or circular links were found in the page DOM. The portal HTML structure, table layout, or URL has changed.`;
    }

    return {
      success: totalElementsFound > 0,
      portalCode,
      targetUrl,
      finalUrl,
      isRedirect,
      httpStatus: res.status,
      responseTimeMs,
      totalElementsFound,
      structureType,
      diagnosticMessage,
      diagnosticType,
      items,
    };
  } catch (err: any) {
    return {
      success: false,
      portalCode,
      targetUrl,
      finalUrl: targetUrl,
      isRedirect: false,
      httpStatus: 0,
      responseTimeMs: Date.now() - startTime,
      totalElementsFound: 0,
      structureType: "unrecognized",
      diagnosticMessage: `Connection Failed: ${err.message || "Could not connect to target URL"}`,
      diagnosticType: "error",
      items: [],
    };
  }
}

