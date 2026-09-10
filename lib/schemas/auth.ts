/**
 * @file lib/schemas/auth.ts
 * @module AuthSchemas
 * @description Zod validation schemas for candidate authentication, registration, password recovery, and magic link entry.
 * 
 * Task ID: TASK-01020103
 * Architecture Reference: ADR-001, ADR-003, ADR-013, AGENTS.md (Rule 1: Input Validation)
 * 
 * Complies with:
 * - TypeScript strict mode with inferred types
 * - WCAG-accessible, human-friendly error messages
 * - Strong password entropy requirements (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
 */

import { z } from "zod";

/**
 * Login form validation schema
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: "Email address is required" })
    .trim()
    .min(1, "Email address is required")
    .email("Please enter a valid email address (e.g., candidate@example.com)"),
  password: z
    .string({ required_error: "Password is required" })
    .min(8, "Password must be at least 8 characters in length"),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Registration form validation schema with password confirmation matching
 */
export const registerSchema = z
  .object({
    fullName: z
      .string({ required_error: "Full name is required" })
      .trim()
      .min(2, "Full name must be at least 2 characters")
      .max(100, "Full name must not exceed 100 characters")
      .regex(/^[a-zA-Z\s.'-]+$/, "Full name may only contain letters, spaces, and standard punctuation"),
    email: z
      .string({ required_error: "Email address is required" })
      .trim()
      .min(1, "Email address is required")
      .email("Please enter a valid email address (e.g., candidate@example.com)"),
    password: z
      .string({ required_error: "Password is required" })
      .min(8, "Password must be at least 8 characters")
      .max(72, "Password must not exceed 72 characters")
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one numeric digit"),
    confirmPassword: z
      .string({ required_error: "Please confirm your password" })
      .min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Forgot password validation schema
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: "Email address is required" })
    .trim()
    .min(1, "Email address is required")
    .email("Please enter a valid email address to receive reset instructions"),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

/**
 * Magic link validation schema
 */
export const magicLinkSchema = z.object({
  email: z
    .string({ required_error: "Email address is required" })
    .trim()
    .min(1, "Email address is required")
    .email("Please enter a valid email address to receive your sign-in link"),
});

export type MagicLinkInput = z.infer<typeof magicLinkSchema>;
