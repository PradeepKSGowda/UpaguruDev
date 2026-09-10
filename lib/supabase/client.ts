/**
 * @file lib/supabase/client.ts
 * @module SupabaseBrowserClient
 * @description Client-side Supabase client singleton for Next.js 15 App Router interactive Client Components.
 * 
 * Task ID: TASK-01020102 (Subtask: SUB-0102010201)
 * Architecture Reference: ADR-001, ADR-003, ADR-013
 * 
 * Complies with:
 * - Next.js 15 App Router Client Component conventions ("use client")
 * - Supabase SSR client package (@supabase/ssr)
 * - Zero hardcoded secrets: strictly references process.env.NEXT_PUBLIC_*
 * - TypeScript strict mode with explicit Database schema types
 */

import { createBrowserClient as createSupabaseBrowserClient } from "@supabase/ssr";
import type { Database } from "../../types/database.types";

/**
 * Validates and retrieves required client-side environment variables.
 * Throws a descriptive configuration error in development if variables are missing.
 * 
 * @returns {{ supabaseUrl: string; supabaseAnonKey: string }} Validated Supabase configuration
 * @throws {Error} If NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY are unset
 */
function getClientEnv(): { supabaseUrl: string; supabaseAnonKey: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "[SupabaseBrowserClient] Missing environment variables: " +
      "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are defined in .env.local"
    );
  }

  return { supabaseUrl, supabaseAnonKey };
}

type BrowserClient = ReturnType<typeof createSupabaseBrowserClient<Database>>;

/**
 * Singleton instance of Supabase browser client to prevent redundant client instantiation
 * across re-renders in client components.
 */
let browserClientInstance: BrowserClient | null = null;

/**
 * Creates or retrieves the singleton Supabase client configured for browser environments.
 * Uses `@supabase/ssr` `createBrowserClient` to automatically handle cookie-based session
 * storage and PKCE authentication flows in client components.
 * 
 * @example
 * ```tsx
 * "use client";
 * import { createBrowserClient } from "@/lib/supabase/client";
 * 
 * export function UserProfile() {
 *   const supabase = createBrowserClient();
 *   // supabase.auth.getUser().then(...)
 * }
 * ```
 * 
 * @returns {BrowserClient} Strongly-typed Supabase browser client instance
 */
export function createBrowserClient(): BrowserClient {
  if (browserClientInstance) {
    return browserClientInstance;
  }

  const { supabaseUrl, supabaseAnonKey } = getClientEnv();

  browserClientInstance = createSupabaseBrowserClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  );

  return browserClientInstance;
}

/**
 * Alias export `createClient` for idiomatic Supabase SSR parity.
 * Matches standard Next.js documentation patterns.
 */
export const createClient = createBrowserClient;

export default createBrowserClient;
