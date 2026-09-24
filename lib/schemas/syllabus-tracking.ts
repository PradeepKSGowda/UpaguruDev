/**
 * @file lib/schemas/syllabus-tracking.ts
 * @description Zod input validation schemas for candidate syllabus progress,
 * topic mastery states, revision tracking, and custom topics.
 *
 * Enhancement: ENH-0011 (Interactive Exam Syllabus & Subject Mastery Tracker)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-004 (Backend)
 */

import { z } from "zod";

export const topicStatusEnum = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "needs_revision",
]);

export type TopicStatus = z.infer<typeof topicStatusEnum>;

export const updateTopicProgressSchema = z.object({
  notificationId: z.string().uuid("Invalid notification ID"),
  subjectKey: z.string().min(1, "Subject key is required").max(100),
  topicTitle: z.string().min(1, "Topic title is required").max(200),
  status: topicStatusEnum,
  confidenceLevel: z.number().int().min(1).max(5).default(1),
  revisionIncrement: z.boolean().optional().default(false),
  notes: z.string().max(2000, "Notes cannot exceed 2000 characters").optional().nullable(),
});

export type UpdateTopicProgressInput = z.infer<typeof updateTopicProgressSchema>;

export const addCustomTopicSchema = z.object({
  notificationId: z.string().uuid("Invalid notification ID"),
  subjectKey: z.string().min(1, "Subject key is required").max(100),
  topicTitle: z.string().min(1, "Topic title is required").max(200),
});

export type AddCustomTopicInput = z.infer<typeof addCustomTopicSchema>;

export const deleteCustomTopicSchema = z.object({
  notificationId: z.string().uuid("Invalid notification ID"),
  subjectKey: z.string().min(1, "Subject key is required"),
  topicTitle: z.string().min(1, "Topic title is required"),
});

export type DeleteCustomTopicInput = z.infer<typeof deleteCustomTopicSchema>;

export const resetSyllabusProgressSchema = z.object({
  notificationId: z.string().uuid("Invalid notification ID"),
  subjectKey: z.string().optional(), // if omitted, resets entire exam syllabus
});

export type ResetSyllabusProgressInput = z.infer<typeof resetSyllabusProgressSchema>;
