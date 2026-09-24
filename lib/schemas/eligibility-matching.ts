/**
 * @file lib/schemas/eligibility-matching.ts
 * @description Zod input validation schemas for eligibility matching preferences
 * and candidate qualification input.
 *
 * Enhancement: ENH-0009 (Smart Eligibility Matching Engine)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-013 (Security)
 */

import { z } from "zod";

export const qualificationEnum = z.enum([
  "8th",
  "10th",
  "12th",
  "ITI",
  "Diploma",
  "Graduate",
  "Post Graduate",
  "Engineering",
  "Medical",
  "Law",
  "PhD",
]);

export const eligibilityPreferencesSchema = z.object({
  qualifications: z.array(qualificationEnum).min(1, "Select at least one qualification"),
  includeAllIndiaExams: z.boolean().default(true),
  includeStateExams: z.boolean().default(true),
  preferredCategories: z.array(
    z.enum(["civil_services", "banking", "railways", "defense", "state_psc", "teaching", "police", "other"])
  ).default([]),
  showExpiringSoonOnly: z.boolean().default(false),
});

export type EligibilityPreferencesInput = z.infer<typeof eligibilityPreferencesSchema>;

export const eligibilityFilterSchema = z.object({
  minScore: z.number().int().min(0).max(100).default(50),
  sortBy: z.enum(["score", "deadline", "vacancies"]).default("score"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(50).default(20),
});

export type EligibilityFilterInput = z.infer<typeof eligibilityFilterSchema>;
