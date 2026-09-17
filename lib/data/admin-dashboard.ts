/**
 * @file lib/data/admin-dashboard.ts
 * @module AdminDashboardDataAccess
 * @description Server-side data fetcher executing aggregate analytical and queue queries
 * for the Admin Dashboard Stats Overview page from Supabase PostgreSQL.
 * 
 * Task ID: TASK-03010102 (Subtask: SUB-0301010201)
 * Architecture Reference: ADR-001 (RSC Data Fetching), ADR-002 (Database), ADR-013 (Security)
 */

import { createServerClient } from "../supabase/server";
import type { Database } from "../../types/database.types";

type DraftRow = Database["public"]["Tables"]["draft_notifications"]["Row"];

export interface RecentPendingDraft {
  id: string;
  sourceUrl: string;
  extractionConfidenceScore: number;
  status: string;
  createdAt: string;
}

export interface AdminDashboardStats {
  pendingDraftsCount: number;
  publishedTodayCount: number;
  totalPublishedCount: number;
  totalExamsCount: number;
  recentPendingDrafts: RecentPendingDraft[];
  calculatedAt: string;
}

/**
 * Fetches real-time operational statistics and top pending drafts for the Admin Dashboard overview.
 * Executes optimized parallel queries to avoid waterfall latency in React Server Components.
 * 
 * @returns {Promise<AdminDashboardStats>} Aggregated counts and recent queue items
 */
export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const calculatedAt = new Date().toISOString();

  // Calculate start of current day in UTC
  const now = new Date();
  const startOfDayUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();

  try {
    const supabase = await createServerClient();

    // Execute queries in parallel
    const [
      pendingDraftsResult,
      publishedTodayResult,
      totalPublishedResult,
      totalExamsResult,
      recentDraftsResult,
    ] = await Promise.all([
      // 1. Pending review draft notifications
      supabase
        .from("draft_notifications")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending_review"),

      // 2. Notifications published today (UTC)
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("status", "published")
        .gte("published_at", startOfDayUtc),

      // 3. Total live published notifications
      supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("status", "published"),

      // 4. Total exam entities registered in system
      supabase
        .from("exams")
        .select("*", { count: "exact", head: true }),

      // 5. Up to 5 most recent pending review drafts
      supabase
        .from("draft_notifications")
        .select("id, source_url, extraction_confidence_score, status, created_at")
        .eq("status", "pending_review")
        .order("created_at", { ascending: false })
        .limit(5),
    ]);

    const rawDrafts = (recentDraftsResult.data as unknown as DraftRow[] | null) || [];
    const recentPendingDrafts: RecentPendingDraft[] = rawDrafts.map((draft) => ({
      id: draft.id,
      sourceUrl: draft.source_url,
      extractionConfidenceScore: Number(draft.extraction_confidence_score ?? 0),
      status: draft.status,
      createdAt: draft.created_at,
    }));

    return {
      pendingDraftsCount: pendingDraftsResult.count ?? 0,
      publishedTodayCount: publishedTodayResult.count ?? 0,
      totalPublishedCount: totalPublishedResult.count ?? 0,
      totalExamsCount: totalExamsResult.count ?? 0,
      recentPendingDrafts,
      calculatedAt,
    };
  } catch (error) {
    console.error("[getAdminDashboardStats] Error querying dashboard metrics:", error);
    // Graceful fallback to avoid breaking server rendering on transient DB latency
    return {
      pendingDraftsCount: 0,
      publishedTodayCount: 0,
      totalPublishedCount: 0,
      totalExamsCount: 0,
      recentPendingDrafts: [],
      calculatedAt,
    };
  }
}
