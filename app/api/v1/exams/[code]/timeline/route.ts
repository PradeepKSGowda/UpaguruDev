/**
 * @file app/api/v1/exams/[code]/timeline/route.ts
 * @module ExamTimelineApiRoute
 * @description Public REST API endpoint returning the pre-assembled examination lifecycle timeline.
 * 
 * Query parameters:
 * - `year`: Specific cycle year (e.g. 2026). Defaults to the latest active cycle.
 * - `cycle_code`: Specific cycle code (e.g. UPSC_CSE_2026).
 * 
 * Features:
 * - Edge CDN cache headers (s-maxage=300, stale-while-revalidate=600)
 * - Rate limiting (60 req/min per IP)
 * - RFC 7807 problem details on 404 / 500
 * 
 * Architecture Reference: Master Prompt Section 10.2, ADR-014
 * Complies with: AGENTS.md (Rule 1: TypeScript strict mode, Zod validation, RSC conventions)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCandidateExamTimeline } from "@/lib/services/lifecycle-timeline";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    code: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  // 1. Rate limiting check
  const rateLimitResponse = await checkRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { code } = await params;
  if (!code || code.trim().length === 0) {
    return NextResponse.json(
      {
        type: "https://tools.ietf.org/html/rfc7807",
        title: "Bad Request",
        status: 400,
        detail: "Exam code parameter is required",
      },
      { status: 400, headers: { "Content-Type": "application/problem+json" } }
    );
  }

  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get("year");
  const cycleCodeParam = searchParams.get("cycle_code");

  const year = yearParam ? parseInt(yearParam, 10) : undefined;

  try {
    const timeline = await getCandidateExamTimeline({
      examCode: code.toUpperCase(),
      cycleCode: cycleCodeParam || undefined,
      year: isNaN(year!) ? undefined : year,
    });

    if (!timeline) {
      return NextResponse.json(
        {
          type: "https://tools.ietf.org/html/rfc7807",
          title: "Not Found",
          status: 404,
          detail: `No examination timeline found for exam code '${code}'`,
        },
        { status: 404, headers: { "Content-Type": "application/problem+json" } }
      );
    }

    return NextResponse.json(timeline, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      {
        type: "https://tools.ietf.org/html/rfc7807",
        title: "Internal Server Error",
        status: 500,
        detail: message,
      },
      { status: 500, headers: { "Content-Type": "application/problem+json" } }
    );
  }
}
