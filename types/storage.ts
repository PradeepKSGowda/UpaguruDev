/**
 * @file types/storage.ts
 * @module StorageTypes
 * @description Strongly-typed contracts for Supabase Storage buckets, access policies,
 * and media metadata in UPA-GURU.
 * 
 * Task ID: TASK-06010101 (Subtasks: SUB-0601010101, SUB-0601010102)
 * Architecture Reference: ADR-002 (Database), ADR-011 (File Storage), ADR-013 (Security)
 * 
 * Complies with:
 * - TypeScript strict mode (Zero `any`)
 * - ADR-011 Storage Bucket Layout and Security Isolation
 * - AGENTS.md Rule 1 (Docstrings with intent, inputs, outputs) & Rule 3 (RLS / Access Segregation)
 */

/**
 * Valid Supabase Storage bucket identifiers in UPA-GURU
 */
export type StorageBucketId =
  | "public-notifications"
  | "public-logos"
  | "draft-attachments";

/**
 * Configuration metadata contract for a Supabase Storage bucket
 */
export interface StorageBucketConfig {
  /** Unique bucket slug matching storage.buckets.id */
  readonly id: StorageBucketId;
  /** Display name of the bucket */
  readonly name: string;
  /** Whether the bucket allows public unauthenticated read access via CDN */
  readonly isPublic: boolean;
  /** Maximum file size threshold in bytes */
  readonly fileSizeLimitBytes: number;
  /** Allowed MIME types accepted by the bucket */
  readonly allowedMimeTypes: readonly string[];
  /** CDN Cache-Control header value for public assets */
  readonly cacheControlHeader: string;
  /** Architectural description and operational purpose */
  readonly description: string;
}

/**
 * Static registry of storage bucket configurations across UPA-GURU
 */
export const STORAGE_BUCKET_CONFIGS: Readonly<Record<StorageBucketId, StorageBucketConfig>> = {
  "public-notifications": {
    id: "public-notifications",
    name: "public-notifications",
    isPublic: true,
    fileSizeLimitBytes: 52428800, // 50 Megabytes
    allowedMimeTypes: ["application/pdf"],
    cacheControlHeader: "public, max-age=31536000, immutable",
    description: "Official verified PDF notifications & syllabi documents accessible to all users via global CDN.",
  },
  "public-logos": {
    id: "public-logos",
    name: "public-logos",
    isPublic: true,
    fileSizeLimitBytes: 5242880, // 5 Megabytes
    allowedMimeTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/svg+xml",
    ],
    cacheControlHeader: "public, max-age=31536000, immutable",
    description: "Recruitment board and examination body logos displayed in candidate notification feeds.",
  },
  "draft-attachments": {
    id: "draft-attachments",
    name: "draft-attachments",
    isPublic: false,
    fileSizeLimitBytes: 52428800, // 50 Megabytes
    allowedMimeTypes: ["application/pdf"],
    cacheControlHeader: "private, no-cache, no-store",
    description: "Raw PDF extractions from Python scrapers prior to Admin HITL verification. Accessible only to admins.",
  },
};

/**
 * Validates whether a given string is a recognized StorageBucketId
 * 
 * @param bucket - String to test
 * @returns Type guard boolean indicating valid bucket ID
 */
export function isStorageBucketId(bucket: string): bucket is StorageBucketId {
  return bucket in STORAGE_BUCKET_CONFIGS;
}
