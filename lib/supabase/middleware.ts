/**
 * @file lib/supabase/middleware.ts
 * @module SupabaseMiddleware
 * @description Next.js Edge Middleware utility to refresh Supabase JWT session tokens on every incoming request.
 * Prevents session expiration drops and synchronizes updated auth cookies between Request and Response headers.
 * 
 * Task ID: TASK-01020102 (Subtask: SUB-0102010203)
 * Architecture Reference: ADR-001, ADR-003, ADR-013
 * 
 * Complies with:
 * - Next.js 15 App Router Edge Middleware standards
 * - Supabase SSR client package (@supabase/ssr)
 * - OWASP Top 10 cookie security standards (HttpOnly, SameSite, Secure)
 * - Server-side authentication token validation via `supabase.auth.getUser()`
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * Result object returned by `updateSession` containing the modified response,
 * authenticated user (if active), and the scoped Supabase client.
 */
export interface UpdateSessionResult {
  /** The Next.js response containing synced and updated set-cookie headers */
  response: NextResponse;
  /** Authenticated user object verified against Supabase Auth, or null if unauthenticated */
  user: User | null;
  /** Initialized Supabase client scoped to this middleware request */
  supabase: ReturnType<typeof createServerClient>;
}

/**
 * Validates and retrieves required middleware environment variables.
 * 
 * @returns {{ supabaseUrl: string; supabaseAnonKey: string }} Validated Supabase configuration
 * @throws {Error} If NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are missing
 */
function getMiddlewareEnv(): { supabaseUrl: string; supabaseAnonKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "[SupabaseMiddleware] Missing environment variables: " +
      "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are configured in .env.local"
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

/**
 * Intercepts incoming requests in Next.js Edge Middleware to refresh expired authentication sessions.
 * 
 * HOW IT WORKS:
 * 1. Creates an initial `NextResponse.next({ request })`.
 * 2. Initializes a Supabase server client using `@supabase/ssr`.
 * 3. Reads cookies from `request.cookies.getAll()`.
 * 4. When Supabase updates or refreshes tokens, `setAll` writes the new cookies to:
 *    - `request.cookies` (so downstream Server Components and Server Actions receive the fresh cookies)
 *    - `response.cookies` (so the browser receives the fresh cookies in response headers)
 * 5. Calls `supabase.auth.getUser()` to trigger token refresh and validate session integrity.
 *    IMPORTANT: `getUser()` contacts the Supabase Auth server, avoiding security vulnerabilities
 *    inherent in trusting unverified local session cookies.
 * 
 * @example
 * ```ts
 * // middleware.ts (in project root)
 * import { updateSession } from "@/lib/supabase/middleware";
 * import type { NextRequest } from "next/server";
 * 
 * export async function middleware(request: NextRequest) {
 *   const { response, user } = await updateSession(request);
 * 
 *   // Optional route protection check (e.g. for /admin routes):
 *   if (request.nextUrl.pathname.startsWith("/admin") && !user) {
 *     return NextResponse.redirect(new URL("/auth/login", request.url));
 *   }
 * 
 *   return response;
 * }
 * 
 * export const config = {
 *   matcher: [
 *     "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
 *   ],
 * };
 * ```
 * 
 * @param {NextRequest} request The incoming Next.js HTTP request
 * @returns {Promise<UpdateSessionResult>} Object containing response, authenticated user, and supabase client
 */
export async function updateSession(request: NextRequest): Promise<UpdateSessionResult> {
  const { supabaseUrl, supabaseAnonKey } = getMiddlewareEnv();

  // Create an initial response object that forwards the request
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // 1. Update request cookies for downstream RSC execution
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          // 2. Re-create response with updated request headers
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          // 3. Set cookies on response headers for the browser client
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // IMPORTANT: Do not use supabase.auth.getSession() in server-side middleware / routes
  // because getSession() does not revalidate the token with the Supabase Auth server.
  // getUser() guarantees cryptographic verification and triggers token refresh if expired.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, supabase };
}

export default updateSession;
