/**
 * @file lib/schemas/audit-logs.ts
 * @module AuditLogSchemas
 * @description Zod validation schemas for administrative Audit Log queries and filtering.
 * 
 * Task ID: TASK-03040101 (Subtask: SUB-0304010101)
 * Architecture Reference: ADR-001, ADR-002, AGENTS.md (Rule 1: Zod Input Validation)
 */

import { z } from "zod";

export const AUDIT_ACTIONS = [
  "approve_and_publish",
  "reject",
  "create_exam",
  "update_exam",
  "delete_exam",
  "create_notification",
  "update_notification",
  "delete_notification",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const auditLogFilterSchema = z.object({
  search: z.string().trim().max(100).optional().default(""),
  action: z.enum(["all", ...AUDIT_ACTIONS]).optional().default("all"),
  targetEntity: z.string().trim().max(50).optional().default("all"),
  adminId: z.string().uuid().optional(),
  startDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be in YYYY-MM-DD format")
    .optional(),
  endDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be in YYYY-MM-DD format")
    .optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(5).max(100).optional().default(20),
});

export type ValidatedAuditLogFilter = z.infer<typeof auditLogFilterSchema>;
