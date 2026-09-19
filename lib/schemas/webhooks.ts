/**
 * @file lib/schemas/webhooks.ts
 * @module WebhookSchemas
 * @description Zod validation schemas and payload normalizers for incoming notification publishing
 * webhooks (Supabase Database Webhooks and direct dispatch triggers).
 * 
 * Task ID: TASK-05050101 (Subtask: SUB-0505010101)
 * Architecture Reference: ADR-004 (Backend), ADR-007 (Push Engine), ADR-013 (Security), ADR-014 (API Design)
 * Rules: AGENTS.md Rule 1 (Strict Zod validation)
 */

import { z } from "zod";

/**
 * Schema for Supabase PostgreSQL Database Webhooks
 * Triggered on INSERT or UPDATE events on public.notifications
 */
export const supabaseNotificationWebhookSchema = z.object({
  type: z.enum(["INSERT", "UPDATE", "DELETE"]),
  table: z.literal("notifications"),
  schema: z.literal("public"),
  record: z.object({
    id: z.string().uuid(),
    exam_id: z.string().uuid().nullable().optional(),
    title: z.string().min(1),
    slug: z.string().min(1),
    status: z.string(),
    total_vacancies: z.number().nullable().optional(),
    application_end_date: z.string().nullable().optional(),
    official_pdf_url: z.string().nullable().optional(),
    apply_online_url: z.string().nullable().optional(),
    qualification_required: z.array(z.string()).nullable().optional(),
    selection_process: z.array(z.string()).nullable().optional(),
    syllabus_summary: z.record(z.unknown()).nullable().optional(),
    published_at: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  }),
  old_record: z.record(z.unknown()).nullable().optional(),
});

export type SupabaseNotificationWebhookPayload = z.infer<typeof supabaseNotificationWebhookSchema>;

/**
 * Schema for direct programmatic dispatch webhook triggers
 */
export const directNotificationWebhookSchema = z.object({
  notificationId: z.string().uuid(),
  examId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  slug: z.string().min(1),
  status: z.string().default("published"),
  conductingBody: z.string().optional(),
  category: z.string().optional(),
  stateOrCentral: z.string().optional(),
  totalVacancies: z.number().optional(),
  applicationEndDate: z.string().optional(),
  officialPdfUrl: z.string().optional(),
  applyOnlineUrl: z.string().optional(),
});

export type DirectNotificationWebhookPayload = z.infer<typeof directNotificationWebhookSchema>;

/**
 * Normalized internal notification model passed to subscriber matching and dispatch engines
 */
export interface NormalizedPublishedNotification {
  notificationId: string;
  examId?: string | null;
  title: string;
  slug: string;
  status: string;
  conductingBody?: string;
  category?: string;
  stateOrCentral?: string;
  totalVacancies?: number;
  applicationEndDate?: string;
  officialPdfUrl?: string;
  applyOnlineUrl?: string;
}

/**
 * Parses and normalizes incoming webhook request bodies from either
 * Supabase Database Webhooks or direct programmatic calls.
 * 
 * @param {unknown} data Unvalidated raw request body
 * @returns {{ success: true; data: NormalizedPublishedNotification } | { success: false; error: string }}
 */
export function parseNotificationWebhookPayload(
  data: unknown
): { success: true; data: NormalizedPublishedNotification } | { success: false; error: string } {
  // Try Supabase Database Webhook schema first
  const supabaseResult = supabaseNotificationWebhookSchema.safeParse(data);
  if (supabaseResult.success) {
    const rec = supabaseResult.data.record;
    return {
      success: true,
      data: {
        notificationId: rec.id,
        examId: rec.exam_id,
        title: rec.title,
        slug: rec.slug,
        status: rec.status,
        totalVacancies: rec.total_vacancies ?? undefined,
        applicationEndDate: rec.application_end_date ?? undefined,
        officialPdfUrl: rec.official_pdf_url ?? undefined,
        applyOnlineUrl: rec.apply_online_url ?? undefined,
      },
    };
  }

  // Fallback to direct programmatic dispatch schema
  const directResult = directNotificationWebhookSchema.safeParse(data);
  if (directResult.success) {
    return {
      success: true,
      data: directResult.data,
    };
  }

  return {
    success: false,
    error: `Payload validation failed. Neither Supabase Database Webhook nor Direct Dispatch schema matched. Details: ${supabaseResult.error.message}`,
  };
}
