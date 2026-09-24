/**
 * @file lib/schemas/exam-lifecycle.ts
 * @description Zod input validation schemas for Exam Lifecycle Status Events
 * (Admit Card, Exam Dates, Answer Key & Objections, Results, Cutoffs).
 *
 * Enhancement: ENH-0012 (Exam Lifecycle Automated Status Tracker)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-004 (Backend)
 */

import { z } from "zod";

export const lifecycleEventTypeEnum = z.enum([
  "admit_card",
  "exam_date",
  "answer_key",
  "objection_window",
  "result",
  "cutoff_list",
  "corrigendum",
]);

export type LifecycleEventType = z.infer<typeof lifecycleEventTypeEnum>;

export const lifecycleEventStatusEnum = z.enum(["draft", "published", "archived"]);

export type LifecycleEventStatus = z.infer<typeof lifecycleEventStatusEnum>;

export const createLifecycleEventSchema = z.object({
  notificationId: z.string().uuid("Invalid notification ID"),
  eventType: lifecycleEventTypeEnum,
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(2000).optional().nullable(),
  officialUrl: z.string().url("Official link must be a valid URL").optional().nullable().or(z.literal("")),
  releaseDate: z.string().datetime().optional().default(() => new Date().toISOString()),
  closingDate: z.string().datetime().optional().nullable(),
  metadata: z.record(z.unknown()).optional().default({}),
  status: lifecycleEventStatusEnum.default("published"),
});

export type CreateLifecycleEventInput = z.infer<typeof createLifecycleEventSchema>;

export const updateLifecycleEventSchema = createLifecycleEventSchema.partial().extend({
  id: z.string().uuid("Invalid event ID"),
});

export type UpdateLifecycleEventInput = z.infer<typeof updateLifecycleEventSchema>;

export const filterLifecycleEventsSchema = z.object({
  notificationId: z.string().uuid().optional(),
  eventType: lifecycleEventTypeEnum.optional(),
  status: lifecycleEventStatusEnum.optional().default("published"),
  limit: z.number().int().min(1).max(100).default(20),
});

export type FilterLifecycleEventsInput = z.infer<typeof filterLifecycleEventsSchema>;
