/**
 * @file lib/data/drafts.ts
 * @module DraftsDataAccess
 * @description Strongly-typed server-side data access layer for querying AI-extracted
 * draft notifications, applying queue filtering, pagination, and sorting by confidence score from Supabase PostgreSQL.
 * 
 * Task ID: TASK-03020101 (Subtask: SUB-0302010101)
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-002 (Database), ADR-003 (RBAC), ADR-013 (Security)
 * 
 * Complies with:
 * - Next.js 15 React Server Component (RSC) execution standards
 * - Zod filter parameter validation via draftFilterSchema
 * - Default sorting by extraction_confidence_score ASC (priority review for edge cases)
 * - TypeScript strict mode (Zero `any`)
 * - Fail-safe error handling
 */

import { createServerClient } from "../supabase/server";
import { draftFilterSchema, type ValidatedDraftFilters } from "../schemas/drafts";
import type {
  DraftNotification,
  DraftFilterParams,
  PaginatedDrafts,
  DraftParsedJson,
} from "../../types/drafts";
import type { Database } from "../../types/database.types";

type DraftRow = Database["public"]["Tables"]["draft_notifications"]["Row"];

/**
 * Maps a raw Supabase PostgreSQL row to a client-friendly DraftNotification domain model
 */
function mapRowToDraftNotification(row: DraftRow): DraftNotification {
  return {
    id: row.id,
    sourceUrl: row.source_url,
    rawExtractedText: row.raw_extracted_text,
    parsedJson: (row.parsed_json as DraftParsedJson) || {},
    extractionConfidenceScore: Number(row.extraction_confidence_score ?? 0),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetches draft notifications for the HITL verification queue with optional status filtering,
 * search, confidence thresholds, and sorting.
 * 
 * DEFAULT BEHAVIOR:
 * - Filters by status: "pending_review"
 * - Sorts by extraction_confidence_score ASC (surfaces lowest confidence items first for human attention)
 * 
 * @param {DraftFilterParams} params Optional query filter and pagination parameters
 * @returns {Promise<PaginatedDrafts>} Paginated list of draft notifications with exact count
 */
export async function getDraftNotifications(
  params: DraftFilterParams = {}
): Promise<PaginatedDrafts> {
  // Validate and sanitize parameters with Zod
  const validation = draftFilterSchema.safeParse(params);
  const validatedFilters: ValidatedDraftFilters = validation.success
    ? validation.data
    : {
        status: "pending_review",
        sortBy: "confidence_asc",
        search: "",
        page: 1,
        pageSize: 20,
      };

  const { status, sortBy, search, minConfidence, maxConfidence, page, pageSize } = validatedFilters;

  try {
    const supabase = await createServerClient();

    // Begin base query with exact count
    let query = supabase
      .from("draft_notifications")
      .select("*", { count: "exact" });

    // 1. Status filter (default: "pending_review")
    if (status !== "all") {
      query = query.eq("status", status);
    }

    // 2. Search query filter (source URL)
    if (search && search.trim().length > 0) {
      query = query.ilike("source_url", `%${search.trim()}%`);
    }

    // 3. Confidence score bounds
    if (typeof minConfidence === "number") {
      query = query.gte("extraction_confidence_score", minConfidence);
    }
    if (typeof maxConfidence === "number") {
      query = query.lte("extraction_confidence_score", maxConfidence);
    }

    // 4. Sorting logic
    switch (sortBy) {
      case "confidence_asc":
        // Lowest confidence first (default: priority attention)
        query = query.order("extraction_confidence_score", { ascending: true });
        break;
      case "confidence_desc":
        // Highest confidence first
        query = query.order("extraction_confidence_score", { ascending: false });
        break;
      case "newest":
        query = query.order("created_at", { ascending: false });
        break;
      case "oldest":
        query = query.order("created_at", { ascending: true });
        break;
      default:
        query = query.order("extraction_confidence_score", { ascending: true });
        break;
    }

    // 5. Pagination range
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("[getDraftNotifications] Supabase query error:", error);
      return {
        drafts: [],
        totalCount: 0,
        page,
        pageSize,
        totalPages: 0,
        hasMore: false,
      };
    }

    const rawRows = (data as unknown as DraftRow[] | null) || [];
    const drafts = rawRows.map(mapRowToDraftNotification);
    const totalCount = count ?? 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    const hasMore = page < totalPages;

    return {
      drafts,
      totalCount,
      page,
      pageSize,
      totalPages,
      hasMore,
    };
  } catch (err) {
    console.error("[getDraftNotifications] Unexpected exception querying drafts:", err);
    return {
      drafts: [],
      totalCount: 0,
      page,
      pageSize,
      totalPages: 0,
      hasMore: false,
    };
  }
}

/**
 * Fetches a single draft notification by its unique UUID for side-by-side verification.
 * 
 * @param {string} id UUID of the draft notification
 * @returns {Promise<DraftNotification | null>} Domain draft model or null if not found
 */
export async function getDraftNotificationById(
  id: string
): Promise<DraftNotification | null> {
  if (!id || typeof id !== "string") {
    return null;
  }

  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("draft_notifications")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      if (error) {
        console.error(`[getDraftNotificationById] Query error for ID ${id}:`, error);
      }
      return null;
    }

    const row = data as unknown as DraftRow;
    return mapRowToDraftNotification(row);
  } catch (err) {
    console.error(`[getDraftNotificationById] Unexpected exception for ID ${id}:`, err);
    return null;
  }
}
