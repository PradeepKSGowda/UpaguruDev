/**
 * @file lib/supabase/server.ts
 * @module SupabaseServerClient
 * @description Server-side Supabase client wrapper for Next.js 15 App Router React Server Components (RSC),
 * Server Actions, and Route Handlers using asynchronous cookies().
 * 
 * Task ID: TASK-01020102 (Subtask: SUB-0102010202)
 * Architecture Reference: ADR-001, ADR-002, ADR-003, ADR-013, ADR-014
 * 
 * Complies with:
 * - Next.js 15 App Router asynchronous cookies() contract (`await cookies()`)
 * - Supabase SSR client package (@supabase/ssr)
 * - Zero hardcoded secrets: references process.env
 * - TypeScript strict mode with explicit Database schema types
 * - Server-only execution security (prevents leaking credentials to client bundles)
 */

import { createServerClient as createSupabaseServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "../../types/database.types";

/**
 * Validates and retrieves required server-side environment variables.
 * 
 * @returns {{ supabaseUrl: string; supabaseAnonKey: string }} Validated Supabase configuration
 * @throws {Error} If NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are unset
 */
function getServerEnv(): { supabaseUrl: string; supabaseAnonKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "[SupabaseServerClient] Missing environment variables: " +
      "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are configured in .env.local"
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

type ServerClient = ReturnType<typeof createSupabaseServerClient<Database>>;

/**
 * Creates a strongly-typed Supabase client for Next.js 15 Server Components, Server Actions,
 * and Route Handlers.
 * 
 * In Next.js 15, `cookies()` from `next/headers` is asynchronous and must be awaited.
 * Cookie synchronization handles cookie retrieval via `getAll()` and cookie mutations via `setAll()`.
 * In pure React Server Components (read-only render phase), attempts to mutate cookies are caught
 * and ignored gracefully, since session refresh is proactively handled by `updateSession` in Next.js Middleware.
 * 
 * @example
 * ```tsx
 * // React Server Component (RSC)
 * import { createServerClient } from "@/lib/supabase/server";
 * 
 * export default async function NotificationsPage() {
 *   const supabase = await createServerClient();
 *   const { data: notifications } = await supabase.from("notifications").select("*");
 *   return <div>...</div>;
 * }
 * ```
 * 
 * @example
 * ```ts
 * // Server Action / Route Handler
 * "use server";
 * import { createServerClient } from "@/lib/supabase/server";
 * 
 * export async function handleApply() {
 *   const supabase = await createServerClient();
 *   const { data: { user } } = await supabase.auth.getUser();
 *   // ...
 * }
 * ```
 * 
 * @returns {Promise<ServerClient>} Strongly-typed Supabase server client
 */
export async function createServerClient(): Promise<ServerClient> {
  const { supabaseUrl, supabaseAnonKey } = getServerEnv();
  const cookieStore = await cookies();

  return createSupabaseServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // In Next.js 15, calling cookieStore.set() inside a React Server Component (RSC)
            // throws an error during static or streaming rendering.
            // This is expected and safe to ignore when Next.js Middleware (updateSession)
            // is configured to refresh user sessions before RSC execution.
          }
        },
      },
    }
  );
}

/**
 * Alias export `createClient` for Next.js and Supabase standard documentation parity.
 */
export const createClient = createServerClient;

/**
 * Creates an administrative Supabase client utilizing the high-privilege `SUPABASE_SERVICE_ROLE_KEY`.
 * Bypasses Row Level Security (RLS).
 * 
 * SECURITY WARNING:
 * - This function must NEVER be imported or exposed to client-side bundles.
 * - Restrict usage exclusively to background jobs, webhook handlers, and verified admin Server Actions.
 * - Always record high-privilege mutations in `public.audit_logs`.
 * 
 * @returns {ServerClient} Elevated service-role Supabase client
 * @throws {Error} If SUPABASE_SERVICE_ROLE_KEY is missing or executed in a browser context
 */
export function createAdminClient(): ServerClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "[SupabaseAdminClient] FATAL: Attempted to initialize admin service-role client in browser context! Aborting."
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "[SupabaseAdminClient] Missing service-role credentials: " +
      "Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are configured in .env.local"
    );
  }

  return createSupabaseServerClient<Database>(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      cookies: {
        getAll() {
          return [];
        },
        setAll() {
          // No-op: service role does not track browser cookies
        },
      },
    }
  );
}

export default createServerClient;
