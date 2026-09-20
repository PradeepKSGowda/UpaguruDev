/**
 * @file lib/cache/index.ts
 * @module CacheModule
 * @description Central barrel export for UPA-GURU caching, tag registries, and ISR revalidation utilities.
 * 
 * Task ID: TASK-06020101 (Subtask: SUB-0602010101)
 * Architecture Reference: ADR-010 (Caching Strategy)
 */

export { CACHE_TAGS, type CacheTagType } from "./tags";
export {
  revalidateNotification,
  revalidateExam,
  revalidateDraft,
  revalidateCandidatePreferences,
  type RevalidateNotificationOptions,
  type RevalidateExamOptions,
} from "./revalidate";
