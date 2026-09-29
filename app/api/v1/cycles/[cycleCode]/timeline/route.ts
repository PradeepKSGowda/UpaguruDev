/**
 * @file app/api/v1/cycles/[cycleCode]/timeline/route.ts
 * @module CycleTimelineApiRoute
 * @description Public REST API endpoint returning timeline for a specific exam cycle code (e.g. UPSC_CSE_2026).
 * 
 * Complies with: AGENTS.md (Rule 1: TypeScript strict mode, Zod validation, RSC conventions)
 */

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCandidateExamTimeline } from "@/lib/services/lifecycle-timeline";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    cycleCode: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const rateLimitResponse = await checkRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const { cycleCode } = await params;
  if (!cycleCode || cycleCode.trim().length === 0) {
    return NextResponse.json(
      {
        type: "https://tools.ietf.org/html/rfc7807",
        title: "Bad Request",
        status: 400,
        detail: "Cycle code parameter is required",
      },
      { status: 400, headers: { "Content-Type": "application/problem+json" } }
    );
  }

  try {
    const timeline = await getCandidateExamTimeline({
      cycleCode: cycleCode.trim(),
    });

    if (!timeline) {
      return NextResponse.json(
        {
          type: "https://tools.ietf.org/html/rfc7807",
          title: "Not Found",
          status: 404,
          detail: `No examination timeline found for cycle code '${cycleCode}'`,
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
