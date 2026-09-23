/**
 * @file lib/schemas/candidate-workspace.ts
 * @description Zod input validation schemas for candidate personal profile, bookmarks, notes,
 * and exam application tracking.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 * Architecture Reference: ADR-001 (App Router), ADR-013 (Security)
 */

import { z } from "zod";

const phoneRegex = /^[6-9]\d{9}$/;
const pincodeRegex = /^[1-9][0-9]{5}$/;

export const accountSettingsSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(60),
  lastName: z.string().trim().max(60).optional().default(""),
  alternateEmail: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, "Enter a valid 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),
  alternatePhone: z
    .string()
    .trim()
    .regex(phoneRegex, "Enter a valid 10-digit Indian mobile number")
    .optional()
    .or(z.literal("")),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD").optional().or(z.literal("")),
  category: z.string().trim().max(50).optional().default("General"),
  addressLine: z.string().trim().max(200).optional().default(""),
  state: z.string().trim().max(100).optional().default(""),
  district: z.string().trim().max(100).optional().default(""),
  pincode: z.string().trim().regex(pincodeRegex, "Enter a valid 6-digit PIN code").optional().or(z.literal("")),
  languagePreference: z.enum(["en", "kn", "hi"]).default("en"),
});

export type AccountSettingsInput = z.infer<typeof accountSettingsSchema>;

export const bookmarkToggleSchema = z.object({
  entityType: z.enum(["exam", "notification"]),
  entityId: z.string().uuid("Invalid entity ID"),
});

export type BookmarkToggleInput = z.infer<typeof bookmarkToggleSchema>;

export const examNoteSchema = z.object({
  noteId: z.string().uuid().optional(),
  examId: z.string().uuid().optional().nullable(),
  notificationId: z.string().uuid().optional().nullable(),
  title: z.string().trim().min(1, "Note title is required").max(120),
  content: z.string().trim().min(1, "Note content is required").max(10000),
  tags: z.array(z.string().trim().max(30)).max(10).default([]),
  isArchived: z.boolean().default(false),
});

export type ExamNoteInput = z.infer<typeof examNoteSchema>;

export const examTrackingSchema = z.object({
  notificationId: z.string().uuid("Invalid notification ID"),
  applicationSubmitted: z.boolean().default(false),
  applicationNumber: z.string().trim().max(50).optional().nullable(),
  feePaid: z.boolean().default(false),
  feeAmount: z.number().min(0).max(100000).optional().nullable(),
  hallTicketDownloaded: z.boolean().default(false),
  examAttended: z.boolean().default(false),
  resultStatus: z.enum(["pending", "qualified", "disqualified", "waitlisted"]).default("pending"),
  customNotes: z.string().trim().max(1000).optional().nullable(),
});

export type ExamTrackingInput = z.infer<typeof examTrackingSchema>;
