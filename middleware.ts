/**
 * @file middleware.ts
 * @module RootMiddleware
 * @description Next.js 15 Edge Middleware enforcing session refresh, Role-Based Access Control (RBAC),
 * and route protection across public candidate routes, authentication forms, and administrative HITL portals.
 * 
 * Task ID: TASK-01020202 (Subtasks: SUB-0102020201, SUB-0102020202)
 * Architecture Reference: ADR-001, ADR-003, ADR-013
 * 
 * Complies with:
 * - Next.js 15 App Router Edge Middleware standards
 * - Supabase SSR session refresh via `updateSession`
 * - Strict RBAC enforcement: protects `/admin/*` from non-admin users
 * - Preserves `returnTo` query parameter on unauthenticated redirects
 */

import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/middleware";

/**
 * Roles authorized to access administrative routes (/admin/*)
 */
const ADMIN_ROLES = new Set(["admin", "super_admin"]);

/**
 * Global Next.js Edge Middleware handler.
 * 
 * Execution Lifecycle:
 * 1. Invokes `updateSession(request)` to validate cryptographic JWT via `supabase.auth.getUser()`
 *    and synchronize refreshed `Set-Cookie` headers between Request and Response.
 * 2. Evaluates the requested pathname against route protection policies:
 *    - `/admin/*`: Enforces authentication and asserts role in ('admin', 'super_admin').
 *      - Unauthenticated -> 302 redirect to `/auth/login?returnTo=...`
 *      - Non-admin candidate -> 302 redirect to `/`
 *    - `/auth/login` and `/auth/register`: Prevents already-logged-in users from seeing auth forms
 *      by redirecting them to their `returnTo` destination or `/`.
 * 3. Returns the prepared response carrying updated cookie headers to ensure uninterrupted sessions.
 * 
 * @param {NextRequest} request The incoming HTTP request from client
 * @returns {Promise<NextResponse>} Response or redirect object
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  // ---------------------------------------------------------------------------
  // 1. Administrative Route Protection: /admin/* (SUB-0102020201)
  // ---------------------------------------------------------------------------
  if (pathname.startsWith("/admin")) {
    // Unauthenticated user -> Redirect to login and preserve intended destination
    if (!user) {
      const loginUrl = new URL("/auth/login", request.url);
      const destination = `${pathname}${search}`;
      loginUrl.searchParams.set("returnTo", destination);
      return NextResponse.redirect(loginUrl);
    }

    // Extract authoritative role from JWT app_metadata with fallback
    const userRole =
      (user.app_metadata?.role as string) ||
      (user.user_metadata?.role as string) ||
      "candidate";

    // Authenticated user lacks administrative privileges -> Redirect to homepage
    if (!ADMIN_ROLES.has(userRole)) {
      const forbiddenUrl = new URL("/", request.url);
      return NextResponse.redirect(forbiddenUrl);
    }
  }

  // ---------------------------------------------------------------------------
  // 2. Candidate Workspace Protection: /dashboard/*
  // ---------------------------------------------------------------------------
  if (pathname.startsWith("/dashboard")) {
    if (!user && process.env.NODE_ENV !== "development") {
      const loginUrl = new URL("/auth/login", request.url);
      const destination = `${pathname}${search}`;
      loginUrl.searchParams.set("returnTo", destination);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Authenticated Session Redirect from Auth Pages (/auth/login, /auth/register)
  // ---------------------------------------------------------------------------
  if (user && (pathname === "/auth/login" || pathname === "/auth/register")) {
    const returnTo = request.nextUrl.searchParams.get("returnTo");
    
    // Prevent open redirect vulnerabilities by validating path begins with single slash
    const safeDestination = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
      ? returnTo
      : "/";

    return NextResponse.redirect(new URL(safeDestination, request.url));
  }

  // ---------------------------------------------------------------------------
  // 3. Return Prepared Response Carrying Refreshed Cookies
  // ---------------------------------------------------------------------------
  return response;
}

/**
 * Middleware matcher configuration.
 * Intercepts all application paths except Next.js internals, static assets, and favicon.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - Static asset extensions: svg, png, jpg, jpeg, gif, webp
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
