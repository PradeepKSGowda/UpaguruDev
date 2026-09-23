"use server";

/**
 * @file app/admin/scrapers/actions.ts
 * @description Next.js 15 Server Actions for initiating manual crawler extractions,
 * enforcing strict administrator authorization, and recording crawl run telemetry.
 * 
 * Architecture Reference: ADR-001 (Server Actions), ADR-002 (Database), ADR-003 (RBAC)
 */

import { revalidatePath } from "next/cache";
import { createServerClient } from "../../../lib/supabase/server";
import {
  normalizePortalCode,
  portalTriggerSchema,
  type ManualExtractResult,
} from "../../../lib/scrapers/registry";

const AUTHORIZED_ROLES = new Set(["admin", "super_admin"]);

/**
 * Triggers a manual crawl extraction for a specified recruitment organization portal.
 */
export async function triggerManualExtraction(
  rawPortalCode: string
): Promise<ManualExtractResult> {
  const parsed = portalTriggerSchema.safeParse({ portalCode: rawPortalCode });
  const portalCode = parsed.success ? parsed.data.portalCode : normalizePortalCode(rawPortalCode);
  const supabase = await createServerClient();

  // 1. Enforce strict Admin RBAC
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      success: false,
      portal: portalCode,
      message: "Authentication required. Please log in as an administrator.",
      timestamp: new Date().toISOString(),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role || (user.app_metadata?.role as string) || "candidate";
  if (!AUTHORIZED_ROLES.has(role)) {
    return {
      success: false,
      portal: portalCode,
      message: "Forbidden: You lack administrative privileges to trigger extractions.",
      timestamp: new Date().toISOString(),
    };
  }

  // 2. Insert a new run in `crawl_runs` with 'running' status
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

  // 3. Dispatch trigger to Scraper Microservice if configured
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

  // 4. In local development or standalone mode, attempt child process execution if microservice is offline
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

  // 5. Revalidate Admin paths
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
