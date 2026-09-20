/**
 * @file lib/schemas/storage.ts
 * @module StorageSchemas
 * @description Zod validation schemas for storage operations, bucket identification,
 * and file metadata.
 * 
 * Task ID: TASK-06010102 (Subtask: SUB-0601010201)
 * Architecture Reference: ADR-004 (Backend), ADR-011 (File Storage), ADR-013 (Security)
 * 
 * Complies with:
 * - TypeScript strict mode
 * - Zod schema validation
 * - AGENTS.md Rule 1 (Task-scoped generation & docstrings)
 */

import { z } from "zod";
import { STORAGE_BUCKET_CONFIGS, type StorageBucketId } from "../../types/storage";

/**
 * Validates storage bucket identifier against registered buckets
 */
export const storageBucketIdSchema = z.enum([
  "public-notifications",
  "public-logos",
  "draft-attachments",
] as const satisfies readonly [StorageBucketId, ...StorageBucketId[]]);

/**
 * Schema for upload file metadata validation
 */
export const fileUploadOptionsSchema = z.object({
  /** Custom destination file path or directory within bucket */
  destinationPath: z.string().trim().max(500).optional(),
  /** Explicit filename override */
  fileName: z.string().trim().max(255).optional(),
  /** Explicit content type override */
  contentType: z.string().trim().max(100).optional(),
  /** Whether to overwrite existing file at the specified path */
  upsert: z.boolean().default(false),
  /** Custom cache-control header */
  cacheControl: z.string().trim().max(100).optional(),
  /** TTL in seconds for signed URL (private buckets only, default: 900) */
  signedUrlExpiresInSeconds: z.number().int().min(60).max(86400).default(900),
  /** Whether to force using elevated service-role admin client */
  useAdminClient: z.boolean().default(false),
});

export type FileUploadOptions = z.infer<typeof fileUploadOptionsSchema>;

/**
 * Schema for requesting a signed URL on a private asset
 */
export const signedUrlRequestSchema = z.object({
  bucket: storageBucketIdSchema,
  path: z.string().trim().min(1).max(500),
  expiresInSeconds: z.number().int().min(60).max(86400).default(900),
});

export type SignedUrlRequest = z.infer<typeof signedUrlRequestSchema>;
