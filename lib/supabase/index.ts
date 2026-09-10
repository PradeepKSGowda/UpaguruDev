/**
 * @file lib/supabase/index.ts
 * @module SupabaseClients
 * @description Central barrel export for all UPA-GURU Supabase client wrappers.
 * 
 * Provides unified access to:
 * - `createBrowserClient` (interactive Client Components)
 * - `createServerClient` (React Server Components, Server Actions, Route Handlers)
 * - `createAdminClient` (elevated service-role operations on server)
 * - `updateSession` (Next.js Edge Middleware session refresh)
 */

export { createBrowserClient, createClient as createBrowserSupabaseClient } from "./client";
export { createServerClient, createClient as createServerSupabaseClient, createAdminClient } from "./server";
export { updateSession, type UpdateSessionResult } from "./middleware";
