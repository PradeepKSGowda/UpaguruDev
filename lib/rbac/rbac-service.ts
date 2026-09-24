/**
 * @file lib/rbac/rbac-service.ts
 * @description Server-side RBAC service querying Supabase PostgreSQL roles and permissions,
 * enforcing authorization invariants and protecting server actions from privilege escalation.
 * Features in-memory TTL caching, React per-request memoization, and O(1) permission resolution.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 * Performance Optimization: PERF-01, PERF-02
 * Architecture Reference: ADR-003 (RBAC), ADR-013 (Security)
 */

import { cache } from "react";
import { createServerClient } from "../supabase/server";
import {
  type PermissionCode,
  ROLE_PERMISSION_SETS,
} from "./permissions";

export interface UserAuthContext {
  userId: string;
  email: string;
  roles: string[];
  permissions: Set<string>;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

interface CachedAuthContext {
  context: UserAuthContext;
  expiresAt: number;
}

// In-memory TTL cache across Server Action invocations (PERF-02)
const AUTH_CONTEXT_CACHE = new Map<string, CachedAuthContext>();
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

/**
 * Invalidates the cached authorization context for a user (or all users).
 * Call this immediately upon role assignment or account revocation.
 */
export function invalidateUserAuthCache(userId?: string): void {
  if (userId) {
    AUTH_CONTEXT_CACHE.delete(userId);
  } else {
    AUTH_CONTEXT_CACHE.clear();
  }
}

/**
 * Core resolver for retrieving user roles and permissions.
 * Optimized with parallel database roundtrips, O(1) role permission aggregation (PERF-01),
 * and in-memory TTL caching.
 */
async function resolveUserAuthContext(userId: string): Promise<UserAuthContext> {
  // 1. Check in-memory TTL cache first
  const cached = AUTH_CONTEXT_CACHE.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.context;
  }

  const supabase = await createServerClient();

  // 2. Fetch profile and user_roles in parallel (Query Tuning)
  const [profileRes, userRolesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, role")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("user_roles")
      .select("role_id, roles(code)")
      .eq("user_id", userId),
  ]);

  const userEmail = profileRes.data?.email || "";
  const fallbackRole = profileRes.data?.role || "candidate";

  const roles: string[] = [];
  const userRolesData = userRolesRes.data;
  if (userRolesData && userRolesData.length > 0) {
    userRolesData.forEach((ur) => {
      const roleObj = ur.roles as { code?: string } | null;
      if (roleObj?.code) roles.push(roleObj.code);
    });
  } else {
    roles.push(fallbackRole);
  }

  // 3. Resolve permissions using pre-computed Set (PERF-01: O(R) instead of O(R × P²))
  const permissions = new Set<string>();
  roles.forEach((r) => {
    const rolePerms = ROLE_PERMISSION_SETS[r];
    if (rolePerms) {
      rolePerms.forEach((p) => permissions.add(p));
    }
  });

  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = isSuperAdmin || roles.includes("admin");

  const context: UserAuthContext = {
    userId,
    email: userEmail,
    roles,
    permissions,
    isAdmin,
    isSuperAdmin,
  };

  // Cache in-memory
  AUTH_CONTEXT_CACHE.set(userId, {
    context,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return context;
}

/**
 * Retrieves the complete set of roles and permissions for a user.
 * Wrapped with React cache() to deduplicate requests within a single SSR / RSC cycle (PERF-02).
 */
export const getUserAuthContext = cache(resolveUserAuthContext);

/**
 * Checks whether an authenticated user holds a specific permission.
 */
export async function hasPermission(
  userId: string,
  permission: PermissionCode
): Promise<boolean> {
  const context = await getUserAuthContext(userId);
  if (context.isSuperAdmin) return true;
  return context.permissions.has(permission);
}

/**
 * Throws a standardized error if user lacks required permission.
 */
export async function assertPermission(
  userId: string,
  permission: PermissionCode
): Promise<UserAuthContext> {
  const context = await getUserAuthContext(userId);
  if (!context.isSuperAdmin && !context.permissions.has(permission)) {
    throw new Error(`Unauthorized: User lacks required permission '${permission}'`);
  }
  return context;
}
