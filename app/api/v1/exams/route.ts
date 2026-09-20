/**
 * @file app/api/v1/exams/route.ts
 * @module ExamsApiRoute
 * @description Public REST API endpoint returning paginated government exam entities.
 * Features:
 * - Upstash Redis sliding window rate limiting (60 req/min per IP)
 * - Strict Zod query parameter validation (limit, offset, category, state, sort, search)
 * - RFC 7807 problem details error responses on validation and runtime failures
 * - Supabase PostgreSQL query with exact count, linked notification counts, and range pagination
 * - Edge CDN cache headers (s-maxage=600, stale-while-revalidate=1200)
 * 
 * Task ID: TASK-08010102 (Subtask: SUB-0801010201)
 * Architecture Reference: ADR-001 (Frontend), ADR-002 (Database), ADR-010 (Caching), ADR-013 (Security), ADR-014 (API Design)
 * Complies with: AGENTS.md (Rule 1: Zod Input Validation & Architecture Compliance)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServerClient } from "@/lib/supabase/server";
import {
  examQueryParamsSchema,
  formatRfc7807ValidationError,
  type ApiExamItem,
  type ApiExamsResponse,
} from "@/lib/schemas/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/exams
 * 
 * Query parameters:
 * - `limit`: Number of records to return (1-100, default: 20)
 * - `offset`: Number of records to skip (min: 0, default: 0)
 * - `category`: Exam category filter (all, civil_services, banking, railways, defense, state_psc, teaching, police, other)
 * - `state`: State or Central filter (substring match or "all")
 * - `sort`: Sort ordering (title_asc, title_desc, created_desc, created_asc)
 * - `search`: Free text search term across title, conducting_body, and slug
 * 
 * @param {NextRequest} request Incoming HTTP request
 * @returns {Promise<NextResponse>} JSON response envelope or RFC 7807 error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  // 1. Enforce sliding window rate limit (60 req/min per IP)
  const rateLimitResponse = await checkRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  // 2. Extract and validate query parameters with Zod
  const { searchParams } = new URL(request.url);
  const rawParams: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    rawParams[key] = value;
  });

  const parseResult = examQueryParamsSchema.safeParse(rawParams);

  // 3. Return RFC 7807 Problem Details if validation fails
  if (!parseResult.success) {
    const problemDetails = formatRfc7807ValidationError(
      request.nextUrl.pathname,
      parseResult.error
    );

    return new NextResponse(JSON.stringify(problemDetails), {
      status: 400,
      headers: {
        "Content-Type": "application/problem+json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }

  const { limit, offset, category, state, sort, search } = parseResult.data;

  try {
    // 4. Initialize Supabase server client
    const supabase = await createServerClient();

    // 5. Build query with exact count for pagination calculation
    let query = supabase
      .from("exams")
      .select(
        `
          id,
          slug,
          title,
          conducting_body,
          category,
          state_or_central,
          official_website,
          logo_url,
          created_at,
          updated_at,
          notifications(count)
        `,
        { count: "exact" }
      );

    // Filter by exam category
    if (category && category !== "all") {
      query = query.eq("category", category);
    }

    // Filter by state or central jurisdiction
    if (state && state !== "all") {
      query = query.ilike("state_or_central", `%${state}%`);
    }

    // Filter by search query across title, conducting_body, and slug
    if (search && search.trim().length > 0) {
      const sanitized = search.trim().replace(/[%_]/g, "\\$&");
      query = query.or(`title.ilike.%${sanitized}%,conducting_body.ilike.%${sanitized}%,slug.ilike.%${sanitized}%`);
    }

    // Apply sorting
    switch (sort) {
      case "title_desc":
        query = query.order("title", { ascending: false });
        break;
      case "created_desc":
        query = query.order("created_at", { ascending: false });
        break;
      case "created_asc":
        query = query.order("created_at", { ascending: true });
        break;
      case "title_asc":
      default:
        query = query.order("title", { ascending: true });
        break;
    }

    // Apply pagination range
    query = query.range(offset, offset + limit - 1);

    // 6. Execute Supabase query
    const { data: rows, count, error } = await query;

    if (error) {
      console.error("[GET /api/v1/exams] Database query error:", error);
      const problemDetails = {
        type: "https://upaguru.in/errors/internal-server-error",
        title: "Internal Server Error",
        status: 500,
        detail: "An unexpected database error occurred while retrieving exams.",
        instance: request.nextUrl.pathname,
      };

      return new NextResponse(JSON.stringify(problemDetails), {
        status: 500,
        headers: {
          "Content-Type": "application/problem+json",
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    const total = count ?? 0;
    const recordsReturned = rows?.length ?? 0;
    const hasMore = offset + recordsReturned < total;

    // 7. Format records into API contract schema
    const formattedData: ApiExamItem[] = (rows ?? []).map((row: any) => {
      let activeNotificationsCount = 0;
      if (Array.isArray(row.notifications) && row.notifications[0]) {
        activeNotificationsCount = Number(row.notifications[0].count) || 0;
      }

      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        conducting_body: row.conducting_body,
        category: row.category,
        state_or_central: row.state_or_central,
        official_website: row.official_website,
        logo_url: row.logo_url,
        active_notifications_count: activeNotificationsCount,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    });

    // 8. Construct response payload
    const responsePayload: ApiExamsResponse = {
      data: formattedData,
      pagination: {
        total,
        limit,
        offset,
        has_more: hasMore,
      },
      timestamp: new Date().toISOString(),
    };

    // 9. Return JSON with Edge caching headers
    return NextResponse.json(responsePayload, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
      },
    });
  } catch (err) {
    console.error("[GET /api/v1/exams] Unhandled exception:", err);
    const problemDetails = {
      type: "https://upaguru.in/errors/internal-server-error",
      title: "Internal Server Error",
      status: 500,
      detail: "An unexpected system error occurred while processing the request.",
      instance: request.nextUrl.pathname,
    };

    return new NextResponse(JSON.stringify(problemDetails), {
      status: 500,
      headers: {
        "Content-Type": "application/problem+json",
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  }
}
