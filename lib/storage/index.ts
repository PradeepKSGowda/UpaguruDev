/**
 * @file lib/storage/index.ts
 * @module StorageEngine
 * @description Central barrel export for UPA-GURU storage subsystem, file upload utilities,
 * validation engines, and bucket configuration registries.
 * 
 * Task ID: TASK-06010102 (Subtask: SUB-0601010201)
 * Architecture Reference: ADR-011 (File Storage), ADR-013 (Security)
 */

export {
  uploadFile,
  getStorageFileUrl,
  deleteStorageFiles,
  type UploadFileOptions,
  type UploadFileSuccess,
  type UploadFileFailure,
  type UploadFileResult,
} from "./upload";

export {
  validateFileUpload,
  sanitizeStoragePath,
  extractFileExtension,
  getFileByteLength,
  type StorageValidationErrorCode,
  type StorageValidationError,
  type StorageValidationSuccess,
  type StorageValidationResult,
} from "./validation";

export {
  STORAGE_BUCKET_CONFIGS,
  isStorageBucketId,
  type StorageBucketId,
  type StorageBucketConfig,
} from "../../types/storage";

export {
  storageBucketIdSchema,
  fileUploadOptionsSchema,
  signedUrlRequestSchema,
  type FileUploadOptions,
  type SignedUrlRequest,
} from "../schemas/storage";
