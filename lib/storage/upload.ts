/**
 * @file lib/storage/upload.ts
 * @module StorageUpload
 * @description Master file upload utility providing pre-upload validation, MIME type & size enforcement,
 * path sanitization, and automated public CDN / signed URL generation for Supabase Storage.
 * 
 * Task ID: TASK-06010102 (Subtask: SUB-0601010201)
 * Architecture Reference: ADR-002 (Database), ADR-004 (Backend), ADR-011 (File Storage), ADR-013 (Security)
 * 
 * Complies with:
 * - Next.js 15 App Router React Server Components, Server Actions & Route Handlers
 * - Supabase Storage JS API (v2)
 * - Zero `any` types (Strict TypeScript)
 * - Mandatory pre-upload validation against STORAGE_BUCKET_CONFIGS
 * - Non-symptom masking: returns explicit, structured error results
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, createServerClient } from "../supabase/server";
import {
  STORAGE_BUCKET_CONFIGS,
  type StorageBucketId,
} from "../../types/storage";
import {
  validateFileUpload,
  type StorageValidationError,
} from "./validation";

/**
 * Options for configuring upload execution
 */
export interface UploadFileOptions {
  /** Custom destination relative path or directory inside the bucket */
  destinationPath?: string;
  /** Explicit filename override */
  fileName?: string;
  /** Explicit MIME type override (e.g. "application/pdf") */
  contentType?: string;
  /** Whether to overwrite existing file at the destination path (default: false) */
  upsert?: boolean;
  /** Custom cache-control header (defaults to bucket standard in STORAGE_BUCKET_CONFIGS) */
  cacheControl?: string;
  /** Time-to-live in seconds for signed URL on private buckets (default: 900 / 15 mins) */
  signedUrlExpiresInSeconds?: number;
  /** Force usage of elevated service-role admin client (default: auto) */
  useAdminClient?: boolean;
  /** Optional pre-initialized Supabase client instance */
  client?: SupabaseClient;
}

/**
 * Successful upload result contract
 */
export interface UploadFileSuccess {
  success: true;
  bucket: StorageBucketId;
  /** Relative storage path within bucket (e.g. "notifications/2026/kpsc-gazette.pdf") */
  path: string;
  /** Qualified path including bucket (e.g. "public-notifications/notifications/2026/kpsc-gazette.pdf") */
  fullPath: string;
  /** Permanent global CDN URL (present for public buckets) */
  publicUrl?: string;
  /** Short-lived signed download URL (present for private buckets) */
  signedUrl?: string;
  /** File size in bytes */
  fileSizeBytes: number;
  /** Verified MIME type */
  mimeType: string;
}

/**
 * Failed upload result contract
 */
export interface UploadFileFailure {
  success: false;
  error: StorageValidationError | {
    code: "STORAGE_UPLOAD_ERROR" | "SIGNED_URL_ERROR" | "CLIENT_INITIALIZATION_ERROR";
    message: string;
    details?: unknown;
  };
}

export type UploadFileResult = UploadFileSuccess | UploadFileFailure;

/**
 * Uploads a file to Supabase Storage with comprehensive validation.
 * 
 * Validates file size, MIME whitelist, and extension integrity before executing
 * the storage transfer. Generates immutable CDN public URLs for public buckets
 * or secure signed URLs for private buckets.
 * 
 * @param bucket - Destination bucket ID ("public-notifications" | "public-logos" | "draft-attachments")
 * @param file - File payload (File, Blob, Buffer, Uint8Array, or ArrayBuffer)
 * @param options - Upload configuration and overrides
 * @returns Strongly-typed UploadFileResult
 * 
 * @example
 * ```ts
 * const result = await uploadFile("public-notifications", pdfBuffer, {
 *   fileName: "kpsc-assistant-engineer-2026.pdf",
 *   contentType: "application/pdf",
 * });
 * 
 * if (result.success) {
 *   console.log("Uploaded CDN URL:", result.publicUrl);
 * } else {
 *   console.error("Upload rejected:", result.error.message);
 * }
 * ```
 */
export async function uploadFile(
  bucket: StorageBucketId,
  file: File | Blob | Buffer | Uint8Array | ArrayBuffer,
  options: UploadFileOptions = {}
): Promise<UploadFileResult> {
  // 1. Execute strict pre-upload validation
  const validation = validateFileUpload({
    file,
    bucket,
    proposedPath: options.destinationPath,
    fileName: options.fileName,
    explicitContentType: options.contentType,
  });

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  const { sanitizedPath, detectedMimeType, fileSizeBytes } = validation;
  const bucketConfig = STORAGE_BUCKET_CONFIGS[bucket];

  // 2. Resolve appropriate Supabase client
  let supabase: SupabaseClient;

  if (options.client) {
    supabase = options.client;
  } else if (options.useAdminClient || !bucketConfig.isPublic) {
    // Private buckets (draft-attachments) or explicit admin requests utilize service-role client
    try {
      supabase = createAdminClient();
    } catch {
      // Fall back to server client if service-role key is unconfigured or in user session context
      supabase = await createServerClient();
    }
  } else {
    // Public buckets default to standard authenticated server client
    try {
      supabase = await createServerClient();
    } catch {
      // Fallback for background jobs or scripts
      supabase = createAdminClient();
    }
  }

  // 3. Configure storage upload parameters
  const cacheControl = options.cacheControl || bucketConfig.cacheControlHeader;
  const upsert = options.upsert ?? false;

  // 4. Perform Supabase Storage upload
  try {
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(sanitizedPath, file, {
        contentType: detectedMimeType,
        cacheControl,
        upsert,
      });

    if (uploadError || !uploadData) {
      return {
        success: false,
        error: {
          code: "STORAGE_UPLOAD_ERROR",
          message: uploadError?.message || "Failed to upload file to Supabase Storage.",
          details: uploadError,
        },
      };
    }

    const uploadedPath = uploadData.path || sanitizedPath;
    const fullPath = `${bucket}/${uploadedPath}`;

    // 5. Generate appropriate access URLs based on bucket visibility
    let publicUrl: string | undefined;
    let signedUrl: string | undefined;

    if (bucketConfig.isPublic) {
      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(uploadedPath);

      publicUrl = publicUrlData.publicUrl;
    } else {
      const expiresIn = options.signedUrlExpiresInSeconds ?? 900; // 15 minutes default
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from(bucket)
        .createSignedUrl(uploadedPath, expiresIn);

      if (signedUrlError || !signedUrlData) {
        return {
          success: false,
          error: {
            code: "SIGNED_URL_ERROR",
            message: `File uploaded successfully but failed to create signed URL: ${signedUrlError?.message || "Unknown error"}`,
            details: signedUrlError,
          },
        };
      }

      signedUrl = signedUrlData.signedUrl;
    }

    return {
      success: true,
      bucket,
      path: uploadedPath,
      fullPath,
      publicUrl,
      signedUrl,
      fileSizeBytes,
      mimeType: detectedMimeType,
    };
  } catch (exc) {
    return {
      success: false,
      error: {
        code: "STORAGE_UPLOAD_ERROR",
        message: exc instanceof Error ? exc.message : "Unexpected exception occurred during file upload.",
        details: exc,
      },
    };
  }
}

/**
 * Generates an access URL (public CDN URL or time-limited signed URL) for an existing storage file
 * 
 * @param bucket - Storage bucket identifier
 * @param path - Relative path within the bucket
 * @param expiresInSeconds - Signed URL duration for private assets (default: 900)
 * @param client - Optional Supabase client instance
 * @returns Resolves to URL string or null if generation fails
 */
export async function getStorageFileUrl(
  bucket: StorageBucketId,
  path: string,
  expiresInSeconds: number = 900,
  client?: SupabaseClient
): Promise<string | null> {
  const bucketConfig = STORAGE_BUCKET_CONFIGS[bucket];
  if (!bucketConfig) {
    return null;
  }

  const supabase = client || (bucketConfig.isPublic ? await createServerClient() : createAdminClient());

  if (bucketConfig.isPublic) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data) {
    return null;
  }

  return data.signedUrl;
}

/**
 * Deletes a file from Supabase Storage
 * 
 * @param bucket - Target storage bucket
 * @param paths - Array of relative file paths to delete
 * @param client - Optional elevated Supabase client
 * @returns Boolean indicating deletion success
 */
export async function deleteStorageFiles(
  bucket: StorageBucketId,
  paths: string[],
  client?: SupabaseClient
): Promise<{ success: boolean; error?: string }> {
  const supabase = client || createAdminClient();

  try {
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (exc) {
    return {
      success: false,
      error: exc instanceof Error ? exc.message : "Failed to delete storage objects.",
    };
  }
}
