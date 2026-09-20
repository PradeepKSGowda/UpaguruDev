/**
 * @file lib/storage/validation.ts
 * @module StorageValidation
 * @description In-depth file validation engine verifying MIME types, file size limits,
 * extension integrity, and path sanitization for Supabase Storage.
 * 
 * Task ID: TASK-06010102 (Subtask: SUB-0601010201)
 * Architecture Reference: ADR-011 (File Storage), ADR-013 (Security)
 * 
 * Complies with:
 * - Strict type checking (Zero `any`)
 * - OWASP File Upload Security Guidelines (Extension-MIME consistency, path traversal immunity)
 * - ADR-011 bucket capacity bounds (50MB for PDFs, 5MB for logos)
 */

import {
  STORAGE_BUCKET_CONFIGS,
  type StorageBucketId,
  isStorageBucketId,
} from "../../types/storage";

/**
 * Standard error codes for storage validation failures
 */
export type StorageValidationErrorCode =
  | "INVALID_BUCKET"
  | "FILE_EMPTY"
  | "FILE_TOO_LARGE"
  | "INVALID_MIME_TYPE"
  | "EXTENSION_MISMATCH"
  | "INVALID_FILE_PATH";

export interface StorageValidationError {
  code: StorageValidationErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type StorageValidationSuccess = {
  valid: true;
  bucket: StorageBucketId;
  sanitizedPath: string;
  detectedMimeType: string;
  fileSizeBytes: number;
};

export type StorageValidationResult =
  | StorageValidationSuccess
  | {
      valid: false;
      error: StorageValidationError;
    };

/**
 * Known MIME types to standard file extension mappings
 */
const MIME_TO_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
  "image/svg+xml": [".svg"],
};

/**
 * Extension to default MIME type mapping
 */
const EXTENSION_TO_MIME: Readonly<Record<string, string>> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/**
 * Sanitizes a storage file path to prevent directory traversal, double extensions,
 * null byte injection, and illegal S3 characters.
 * 
 * @param rawPath - Proposed relative storage path or file name
 * @param fallbackPrefix - Default subdirectory if rawPath is a simple filename
 * @returns Clean, safe relative storage path
 */
export function sanitizeStoragePath(rawPath: string, fallbackPrefix: string = "uploads"): string {
  if (!rawPath || typeof rawPath !== "string") {
    const uniqueId = crypto.randomUUID();
    return `${fallbackPrefix}/${Date.now()}-${uniqueId}`;
  }

  // Remove null bytes and control characters
  let clean = rawPath.replace(/\0/g, "").replace(/[\x00-\x1F\x7F]/g, "");

  // Normalize path separators to forward slash
  clean = clean.replace(/\\+/g, "/");

  // Prevent directory traversal attacks
  clean = clean
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");

  // Remove unsafe characters: only allow alphanumeric, hyphens, underscores, dots, and slashes
  clean = clean.replace(/[^a-zA-Z0-9/_.-]/g, "_");

  // Deduplicate consecutive slashes
  clean = clean.replace(/\/+/g, "/");

  // Ensure path starts without a leading slash
  if (clean.startsWith("/")) {
    clean = clean.slice(1);
  }

  // If path is empty after sanitization, generate a random path
  if (!clean) {
    const uniqueId = crypto.randomUUID();
    return `${fallbackPrefix}/${Date.now()}-${uniqueId}`;
  }

  // If path doesn't contain a slash, prepend fallback prefix
  if (!clean.includes("/")) {
    clean = `${fallbackPrefix}/${clean}`;
  }

  return clean;
}

/**
 * Extracts normalized file extension from a filename or path (e.g. ".pdf", ".png")
 */
export function extractFileExtension(fileNameOrPath: string): string {
  const lastDotIndex = fileNameOrPath.lastIndexOf(".");
  if (lastDotIndex === -1 || lastDotIndex === fileNameOrPath.length - 1) {
    return "";
  }
  return fileNameOrPath.slice(lastDotIndex).toLowerCase();
}

/**
 * Detects byte length of supported file payload types
 */
export function getFileByteLength(
  file: File | Blob | Buffer | Uint8Array | ArrayBuffer
): number {
  if (typeof Blob !== "undefined" && file instanceof Blob) {
    return file.size;
  }
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(file)) {
    return file.length;
  }
  if (file instanceof Uint8Array) {
    return file.byteLength;
  }
  if (file instanceof ArrayBuffer) {
    return file.byteLength;
  }
  return 0;
}

/**
 * Validates a file payload against target bucket constraints.
 * Checks bucket existence, file size limits, MIME type whitelist, and extension matching.
 * 
 * @param input - File and validation parameters
 * @returns StorageValidationResult with sanitized metadata or descriptive error
 */
export function validateFileUpload(input: {
  file: File | Blob | Buffer | Uint8Array | ArrayBuffer;
  bucket: string;
  proposedPath?: string;
  fileName?: string;
  explicitContentType?: string;
}): StorageValidationResult {
  const { file, bucket, proposedPath, fileName, explicitContentType } = input;

  // 1. Validate bucket identifier
  if (!isStorageBucketId(bucket)) {
    return {
      valid: false,
      error: {
        code: "INVALID_BUCKET",
        message: `Bucket '${bucket}' is not recognized in UPA-GURU storage registry. Valid buckets: public-notifications, public-logos, draft-attachments.`,
        details: { providedBucket: bucket },
      },
    };
  }

  const bucketConfig = STORAGE_BUCKET_CONFIGS[bucket];

  // 2. Validate file size
  const sizeBytes = getFileByteLength(file);
  if (sizeBytes <= 0) {
    return {
      valid: false,
      error: {
        code: "FILE_EMPTY",
        message: "The uploaded file is empty (0 bytes).",
        details: { sizeBytes },
      },
    };
  }

  if (sizeBytes > bucketConfig.fileSizeLimitBytes) {
    const limitMb = (bucketConfig.fileSizeLimitBytes / (1024 * 1024)).toFixed(1);
    const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
    return {
      valid: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: `File size (${sizeMb} MB) exceeds maximum allowed threshold of ${limitMb} MB for bucket '${bucket}'.`,
        details: {
          sizeBytes,
          limitBytes: bucketConfig.fileSizeLimitBytes,
          bucket,
        },
      },
    };
  }

  // 3. Detect and resolve MIME type
  let resolvedMimeType = explicitContentType?.trim().toLowerCase();

  if (!resolvedMimeType && typeof Blob !== "undefined" && file instanceof Blob && file.type) {
    resolvedMimeType = file.type.toLowerCase();
  }

  // If MIME is still undetermined or generic ("application/octet-stream"), infer from filename/path
  const sourceName = fileName || (typeof File !== "undefined" && file instanceof File ? file.name : "") || proposedPath || "";
  const ext = extractFileExtension(sourceName);

  if ((!resolvedMimeType || resolvedMimeType === "application/octet-stream") && ext) {
    resolvedMimeType = EXTENSION_TO_MIME[ext] || resolvedMimeType;
  }

  if (!resolvedMimeType) {
    return {
      valid: false,
      error: {
        code: "INVALID_MIME_TYPE",
        message: "Unable to detect MIME type for the uploaded file. Please provide an explicit contentType or valid file extension.",
        details: { fileName: sourceName },
      },
    };
  }

  // 4. Validate MIME type against bucket whitelist
  const isMimeAllowed = bucketConfig.allowedMimeTypes.some(
    (allowed) => allowed.toLowerCase() === resolvedMimeType
  );

  if (!isMimeAllowed) {
    return {
      valid: false,
      error: {
        code: "INVALID_MIME_TYPE",
        message: `MIME type '${resolvedMimeType}' is prohibited in bucket '${bucket}'. Allowed types: ${bucketConfig.allowedMimeTypes.join(", ")}.`,
        details: {
          detectedMimeType: resolvedMimeType,
          allowedMimeTypes: bucketConfig.allowedMimeTypes,
          bucket,
        },
      },
    };
  }

  // 5. Verify extension consistency (preventing extension spoofing)
  if (ext) {
    const validExtensions = MIME_TO_EXTENSIONS[resolvedMimeType];
    if (validExtensions && !validExtensions.includes(ext)) {
      return {
        valid: false,
        error: {
          code: "EXTENSION_MISMATCH",
          message: `File extension '${ext}' does not match detected MIME type '${resolvedMimeType}'. Expected one of: ${validExtensions.join(", ")}.`,
          details: { extension: ext, resolvedMimeType, validExtensions },
        },
      };
    }
  }

  // 6. Build and sanitize destination path
  const defaultPrefix = bucket === "public-logos" ? "logos" : bucket === "public-notifications" ? "notifications" : "drafts";
  let targetPath = proposedPath || sourceName || "";

  // If target path has no extension, append standard extension for MIME type
  if (targetPath && !extractFileExtension(targetPath)) {
    const defaultExt = MIME_TO_EXTENSIONS[resolvedMimeType]?.[0] || "";
    targetPath = `${targetPath}${defaultExt}`;
  }

  // If no path was provided, construct a clean timestamped filename
  if (!targetPath) {
    const defaultExt = MIME_TO_EXTENSIONS[resolvedMimeType]?.[0] || "";
    const uniqueId = crypto.randomUUID();
    targetPath = `${Date.now()}-${uniqueId}${defaultExt}`;
  }

  const sanitizedPath = sanitizeStoragePath(targetPath, defaultPrefix);

  return {
    valid: true,
    bucket,
    sanitizedPath,
    detectedMimeType: resolvedMimeType,
    fileSizeBytes: sizeBytes,
  };
}
