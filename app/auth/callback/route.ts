/**
 * @file app/auth/callback/route.ts
 * @module AuthCallbackRoute
 * @description Next.js App Router Route Handler that exchanges Supabase OAuth / email verification PKCE codes for active sessions.
 * 
 * Task ID: TASK-01020103 (Subtask: SUB-0102010304)
 * Architecture Reference: ADR-001, ADR-003, ADR-013, ADR-014
 * 
 * Complies with:
 * - Next.js 15 Route Handler GET method
 * - Open Redirect vulnerability prevention (sanitizes `next` parameter)
 * - Cryptographic code exchange via @supabase/ssr createServerClient
 * - Automatic cookie synchronization for RSC hydration
 */

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

/**
 * Sanitizes and validates the post-authentication redirect destination URL.
 * Strictly prevents Open Redirect vulnerabilities by ensuring destination begins with a single slash
 * and does not attempt protocol-relative redirects (e.g., `//malicious-domain.com`).
 * 
 * @param {string | null} nextParam The candidate redirect destination from query string
 * @returns {string} Safe relative redirect path
 */
function getSafeRedirectUrl(nextParam: string | null): string {
  if (!nextParam) return "/";

  // Prevent protocol-relative redirects (e.g. //attacker.com) and backslash attacks
  if (nextParam.startsWith("//") || nextParam.startsWith("/\\") || nextParam.includes("://")) {
    return "/";
  }

  // Must start with single slash
  if (nextParam.startsWith("/")) {
    return nextParam;
  }

  return "/";
}

/**
 * Handles incoming GET requests to /auth/callback triggered by:
 * 1. Google OAuth 2.0 PKCE redirect
 * 2. Magic Link email clicks
 * 3. Email confirmation links
 * 
 * @param {NextRequest} request Incoming HTTP request from Supabase Auth
 * @returns {Promise<NextResponse>} Redirect to target destination or login with error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = getSafeRedirectUrl(searchParams.get("next"));
  const errorDescription = searchParams.get("error_description");

  // If Supabase returned an OAuth error parameter
  if (errorDescription) {
    const errorUrl = new URL("/auth/login", origin);
    errorUrl.searchParams.set("error", errorDescription);
    return NextResponse.redirect(errorUrl);
  }

  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Successfully authenticated; redirect to the requested landing page
      const destination = new URL(next, origin);
      return NextResponse.redirect(destination);
    }

    // Code exchange failed (e.g., code expired or already used)
    const errorUrl = new URL("/auth/login", origin);
    errorUrl.searchParams.set(
      "error",
      "Authentication session could not be established. The link may have expired."
    );
    return NextResponse.redirect(errorUrl);
  }

  // No authorization code supplied in callback query
  const fallbackUrl = new URL("/auth/login", origin);
  fallbackUrl.searchParams.set("error", "Invalid or missing authentication code.");
  return NextResponse.redirect(fallbackUrl);
}
