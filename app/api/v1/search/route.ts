/**
 * @file app/api/v1/search/route.ts
 * @module SearchApiRoute
 * @description Public REST API endpoint returning full-text search results for published exam notifications.
 * Features:
 * - Upstash Redis sliding window rate limiting (60 req/min per IP)
 * - Strict Zod query parameter validation (q, limit, offset, category, state, sort)
 * - RFC 7807 problem details error responses on validation and runtime failures
 * - PostgreSQL Full-Text Search with GIN index acceleration and relevance ranking
 * - Graceful fallback to multi-column ILIKE search if full-text search yields zero matches
 * - Edge CDN cache headers (s-maxage=60, stale-while-revalidate=300)
 * 
 * Task ID: TASK-08010102 (Subtask: SUB-0801010201)
 * Architecture Reference: ADR-001 (Frontend), ADR-002 (Database), ADR-006 (Search), ADR-010 (Caching), ADR-013 (Security), ADR-014 (API Design)
 * Complies with: AGENTS.md (Rule 1: Zod Input Validation & Architecture Compliance)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { createServerClient } from "@/lib/supabase/server";
import {
  searchQueryParamsSchema,
  formatRfc7807ValidationError,
  type ApiNotificationItem,
  type ApiSearchResponse,
} from "@/lib/schemas/api";

export const dynamic = "force-dynamic";

/**
 * GET /api/v1/search
 * 
 * Query parameters:
 * - `q`: Search keyword query (required, 1-100 characters)
 * - `limit`: Number of records to return (1-100, default: 20)
 * - `offset`: Number of records to skip (min: 0, default: 0)
 * - `category`: Exam category filter (all, civil_services, banking, railways, defense, state_psc, teaching, police, other)
 * - `state`: State or Central filter (substring match or "all")
 * - `sort`: Sort ordering (relevance, published_desc, deadline_asc, vacancies_desc)
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

  const parseResult = searchQueryParamsSchema.safeParse(rawParams);

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

  const { q, limit, offset, category, state, sort } = parseResult.data;
  const trimmedQuery = q.trim();

  try {
    // 4. Initialize Supabase server client
    const supabase = await createServerClient();

    // 5. Attempt PostgreSQL Full-Text Search
    let query = supabase
      .from("notifications")
      .select(
        `
          id,
          exam_id,
          slug,
          title,
          notification_number,
          total_vacancies,
          application_start_date,
          application_end_date,
          exam_date,
          qualification_required,
          age_limit_min,
          age_limit_max,
          official_pdf_url,
          apply_online_url,
          syllabus_summary,
          selection_process,
          status,
          published_at,
          created_at,
          updated_at,
          exams!inner (
            id,
            slug,
            title,
            conducting_body,
            category,
            state_or_central,
            official_website,
            logo_url
          )
        `,
        { count: "exact" }
      )
      .eq("status", "published");

    // Apply full text search via PostgreSQL websearch
    query = query.textSearch("title", trimmedQuery, {
      type: "websearch",
      config: "english",
    });

    // Category filter
    if (category && category !== "all") {
      query = query.eq("exams.category", category);
    }

    // State / central filter
    if (state && state !== "all") {
      query = query.ilike("exams.state_or_central", `%${state}%`);
    }

    // Apply sorting
    switch (sort) {
      case "published_desc":
        query = query.order("published_at", { ascending: false, nullsFirst: false });
        break;
      case "deadline_asc":
        query = query.order("application_end_date", { ascending: true, nullsFirst: false });
        break;
      case "vacancies_desc":
        query = query.order("total_vacancies", { ascending: false, nullsFirst: false });
        break;
      case "relevance":
      default:
        // By default, sort by earliest upcoming deadline or publication
        query = query.order("application_end_date", { ascending: true, nullsFirst: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    let { data: rows, count, error } = await query;

    // 6. Graceful fallback: If FTS produces zero records or errors, execute broad ILIKE query
    if (error || !rows || rows.length === 0) {
      const sanitized = trimmedQuery.replace(/[%_]/g, "\\$&");
      let fallbackQuery = supabase
        .from("notifications")
        .select(
          `
            id,
            exam_id,
            slug,
            title,
            notification_number,
            total_vacancies,
            application_start_date,
            application_end_date,
            exam_date,
            qualification_required,
            age_limit_min,
            age_limit_max,
            official_pdf_url,
            apply_online_url,
            syllabus_summary,
            selection_process,
            status,
            published_at,
            created_at,
            updated_at,
            exams!inner (
              id,
              slug,
              title,
              conducting_body,
              category,
              state_or_central,
              official_website,
              logo_url
            )
          `,
          { count: "exact" }
        )
        .eq("status", "published")
        .or(`title.ilike.%${sanitized}%,notification_number.ilike.%${sanitized}%`);

      if (category && category !== "all") {
        fallbackQuery = fallbackQuery.eq("exams.category", category);
      }

      if (state && state !== "all") {
        fallbackQuery = fallbackQuery.ilike("exams.state_or_central", `%${state}%`);
      }

      fallbackQuery = fallbackQuery
        .order("application_end_date", { ascending: true, nullsFirst: false })
        .range(offset, offset + limit - 1);

      const fallbackResult = await fallbackQuery;
      if (!fallbackResult.error && fallbackResult.data && fallbackResult.data.length > 0) {
        rows = fallbackResult.data;
        count = fallbackResult.count;
      }
    }

    const total = count ?? (rows?.length ?? 0);
    const recordsReturned = rows?.length ?? 0;
    const hasMore = offset + recordsReturned < total;

    // 7. Format records into API contract schema
    const formattedData: ApiNotificationItem[] = (rows ?? []).map((row: any) => {
      const examRaw = row.exams;
      const exam = Array.isArray(examRaw) ? examRaw[0] : examRaw;

      return {
        id: row.id,
        slug: row.slug,
        title: row.title,
        notification_number: row.notification_number,
        total_vacancies: row.total_vacancies,
        application_start_date: row.application_start_date,
        application_end_date: row.application_end_date,
        exam_date: row.exam_date,
        qualification_required: row.qualification_required ?? [],
        age_limit_min: row.age_limit_min,
        age_limit_max: row.age_limit_max,
        official_pdf_url: row.official_pdf_url,
        apply_online_url: row.apply_online_url,
        syllabus_summary: row.syllabus_summary,
        selection_process: row.selection_process ?? [],
        published_at: row.published_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        exam: {
          id: exam?.id ?? "",
          slug: exam?.slug ?? "",
          title: exam?.title ?? "",
          conducting_body: exam?.conducting_body ?? "",
          category: exam?.category ?? "",
          state_or_central: exam?.state_or_central ?? "",
          official_website: exam?.official_website ?? "",
          logo_url: exam?.logo_url ?? null,
        },
      };
    });

    // 8. Construct response payload
    const responsePayload: ApiSearchResponse = {
      query: trimmedQuery,
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
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    console.error("[GET /api/v1/search] Unhandled exception:", err);
    const problemDetails = {
      type: "https://upaguru.in/errors/internal-server-error",
      title: "Internal Server Error",
      status: 500,
      detail: "An unexpected system error occurred while processing the search request.",
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
