/**
 * @file lib/schemas/lifecycle.ts
 * @description Zod schemas and TypeScript contracts for Examination Lifecycle Intelligence.
 * Covers:
 * - Candidate Timeline Read Model (Exam, Cycle, Important Dates, Events with Revision Chains, Documents, Recruitments)
 * - Review Queue Item payloads and Action validation schemas
 * - Audit logging payloads
 * 
 * Architecture Reference: ADR-001, ADR-002, ADR-014 (API Design)
 * Complies with: AGENTS.md (Rule 1: Zod input validation & RSC conventions)
 */

import { z } from "zod";

// ============================================================================
// 1. Candidate Timeline Response Schema
// ============================================================================

export const timelineEventVersionSchema = z.object({
  id: z.string().optional(),
  start_datetime: z.string().nullable(),
  end_datetime: z.string().nullable().optional(),
  date_text_original: z.string(),
  status: z.string(),
  version_number: z.number().int().optional(),
  change_reason: z.string().nullable().optional(),
  created_at: z.string().optional(),
});

export type TimelineEventVersion = z.infer<typeof timelineEventVersionSchema>;

export const timelineEventSchema = z.object({
  id: z.string(),
  event_type: z.string(),
  stage: z.string().nullable(),
  event_name: z.string(),
  start_datetime: z.string().nullable(),
  end_datetime: z.string().nullable().optional(),
  is_date_tbd: z.boolean().default(false),
  date_precision: z.string().default("DAY"),
  date_text_original: z.string(),
  status: z.string(),
  confidence: z.number(),
  verification_status: z.string(),
  is_current: z.boolean(),
  version_number: z.number().int(),
  change_reason: z.string().nullable().optional(),
  previous_versions: z.array(timelineEventVersionSchema).default([]),
  source_document: z
    .object({
      id: z.string(),
      title: z.string(),
      source_url: z.string(),
      document_type: z.string().optional(),
      publication_date: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});

export type TimelineEvent = z.infer<typeof timelineEventSchema>;

export const timelineDocumentSchema = z.object({
  id: z.string(),
  title: z.string(),
  document_type: z.string(),
  source_url: z.string(),
  publication_date: z.string().nullable(),
  reference_number: z.string().nullable(),
  verification_status: z.string(),
  relationship_type: z.string().nullable().optional(),
});

export type TimelineDocument = z.infer<typeof timelineDocumentSchema>;

export const timelineRecruitmentSchema = z.object({
  id: z.string(),
  title: z.string(),
  department_or_cadre: z.string().nullable().optional(),
  vacancies_current: z.number().nullable().optional(),
  pay_level: z.string().nullable().optional(),
  status: z.string(),
});

export type TimelineRecruitment = z.infer<typeof timelineRecruitmentSchema>;

export const candidateTimelineResponseSchema = z.object({
  exam: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    short_name: z.string().nullable().optional(),
    category: z.string().nullable().optional(),
    organization: z.object({
      id: z.string().optional(),
      code: z.string(),
      name: z.string(),
      short_name: z.string().optional(),
      official_website: z.string().nullable().optional(),
    }),
  }),
  cycle: z.object({
    id: z.string(),
    code: z.string(),
    label: z.string(),
    year: z.number().nullable(),
    reference_number: z.string().nullable(),
    status: z.string(),
    current_stage: z.string().nullable(),
    total_vacancies: z.number().nullable(),
    verification_status: z.string(),
    start_date: z.string().nullable().optional(),
    end_date: z.string().nullable().optional(),
  }),
  latest_update: z
    .object({
      title: z.string(),
      published_date: z.string().nullable(),
      document_type: z.string(),
      source_url: z.string(),
    })
    .nullable(),
  important_dates: z.record(z.string().nullable()),
  events: z.array(timelineEventSchema),
  documents: z.array(timelineDocumentSchema),
  recruitments: z.array(timelineRecruitmentSchema),
});

export type CandidateTimelineResponse = z.infer<typeof candidateTimelineResponseSchema>;

// ============================================================================
// 2. Review Queue Schemas
// ============================================================================

export const reviewQueueItemTypeSchema = z.enum([
  "DOCUMENT_CYCLE_LINK",
  "EVENT_CONFLICT",
  "CORRIGENDUM_CHANGE",
  "AMBIGUOUS_EXAM",
  "DATA_QUALITY_FLAG",
  "LEGACY_MIGRATION",
]);

export const reviewQueuePrioritySchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export const reviewQueueStatusSchema = z.enum(["PENDING", "APPROVED", "REJECTED", "MODIFIED", "ESCALATED"]);

export const reviewQueueActionInputSchema = z.object({
  itemId: z.string().uuid("Invalid review queue item ID"),
  action: z.enum([
    "APPROVE",
    "REJECT",
    "REASSIGN_EXAM",
    "REASSIGN_CYCLE",
    "MERGE_CYCLES",
    "SPLIT_CYCLE",
    "EDIT_METADATA",
    "EDIT_EVENT",
    "MARK_CORRIGENDUM",
    "CREATE_NEW_CYCLE",
  ]),
  resolutionNotes: z.string().trim().max(1000).optional(),
  targetExamMasterId: z.string().uuid().optional(),
  targetExamCycleId: z.string().uuid().optional(),
  editedMetadata: z.record(z.unknown()).optional(),
});

export type ReviewQueueActionInput = z.infer<typeof reviewQueueActionInputSchema>;

export const mergeCyclesInputSchema = z.object({
  sourceCycleId: z.string().uuid("Invalid source cycle ID"),
  targetCycleId: z.string().uuid("Invalid target cycle ID"),
  reason: z.string().trim().min(5).max(1000),
});

export type MergeCyclesInput = z.infer<typeof mergeCyclesInputSchema>;
