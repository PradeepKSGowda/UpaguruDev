/**
 * @file lib/schemas/user-management.ts
 * @description Zod input validation schemas for administrative user management operations.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 * Architecture Reference: ADR-003 (RBAC), ADR-013 (Security)
 */

import { z } from "zod";

export const userFilterSchema = z
  .object({
    query: z.string().trim().max(100).optional(),
    search: z.string().trim().max(100).optional(),
    role: z.enum(["all", "super_admin", "admin", "moderator", "support", "candidate"]).default("all"),
    status: z.enum(["all", "active", "blocked"]).default("all"),
    verifiedOnly: z.boolean().optional().default(false),
    page: z.number().int().min(1).default(1),
    limit: z.number().int().min(1).max(100).default(20),
    pageSize: z.number().int().min(1).max(100).default(20),
  })
  .transform((data) => {
    const effectiveLimit = data.limit !== 20 ? data.limit : data.pageSize;
    const effectiveQuery = data.query || data.search;
    return {
      ...data,
      query: effectiveQuery,
      search: effectiveQuery,
      limit: effectiveLimit,
      pageSize: effectiveLimit,
    };
  });

export type UserFilterInput = z.infer<typeof userFilterSchema>;

export const userBlockStatusSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  isBlocked: z.boolean(),
  reason: z.string().trim().min(5, "Reason must be at least 5 characters").max(500),
});

export type UserBlockStatusInput = z.infer<typeof userBlockStatusSchema>;

export const assignRoleSchema = z
  .object({
    userId: z.string().uuid("Invalid user ID format"),
    roleCode: z.enum(["super_admin", "admin", "moderator", "support", "candidate"]).optional(),
    role: z.enum(["super_admin", "admin", "moderator", "support", "candidate"]).optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((data) => Boolean(data.roleCode || data.role), {
    message: "Role is required",
    path: ["roleCode"],
  })
  .transform((data) => {
    const selected = (data.roleCode || data.role)!;
    return {
      userId: data.userId,
      roleCode: selected,
      role: selected,
      reason: data.reason,
    };
  });

export type AssignRoleInput = z.infer<typeof assignRoleSchema>;

export const createAdminSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  department: z.string().trim().min(2, "Department is required").max(100),
  employeeId: z.string().trim().min(2, "Employee ID is required").max(50),
  roleCode: z.enum(["admin", "moderator", "support"]).default("admin"),
});

export type CreateAdminInput = z.infer<typeof createAdminSchema>;
