/**
 * @file lib/cache/tags.ts
 * @module CacheTags
 * @description Canonical Next.js 15 cache tag definitions and key generator helpers.
 * Ensures consistent tag naming across data access queries (unstable_cache / fetch)
 * and mutation revalidation triggers (revalidateTag).
 * 
 * Task ID: TASK-06020101 (Subtask: SUB-0602010101)
 * Architecture Reference: ADR-001, ADR-008 (SEO), ADR-010 (Caching)
 * 
 * Complies with:
 * - Next.js 15 App Router cache tag conventions
 * - TypeScript strict mode
 * - AGENTS.md Rule 4 (Edge Caching & Redis revalidation logic)
 */

export const CACHE_TAGS = {
  /** Master collection tag for all published recruitment notifications */
  NOTIFICATIONS: "notifications",
  /** Specific notification by URL slug */
  NOTIFICATION_SLUG: (slug: string) => `notification-${slug.trim().toLowerCase()}`,
  /** Specific notification by UUID */
  NOTIFICATION_ID: (id: string) => `notification-id-${id}`,
  /** Master collection tag for all examinations */
  EXAMS: "exams",
  /** Specific exam by URL slug */
  EXAM_SLUG: (slug: string) => `exam-${slug.trim().toLowerCase()}`,
  /** Collection tag for category aggregations and feeds */
  CATEGORIES: "categories",
  /** Specific category feed (e.g. 'civil_services', 'banking') */
  CATEGORY: (category: string) => `category-${category.trim().toLowerCase()}`,
  /** Collection tag for state aggregations */
  STATES: "states",
  /** Specific Indian state feed (e.g. 'karnataka', 'central') */
  STATE: (state: string) => `state-${state.trim().toLowerCase().replace(/[\s_-]+/g, "-")}`,
  /** Edge sitemap and robots XML */
  SITEMAP: "sitemap",
  /** Public RSS / Atom feeds */
  FEEDS: "feeds",
  /** Administrative review drafts */
  DRAFTS: "drafts",
  /** Specific draft verification workspace */
  DRAFT_ID: (id: string) => `draft-${id}`,
  /** Candidate personalized preferences */
  PREFERENCES: "preferences",
} as const;

export type CacheTagType = typeof CACHE_TAGS;
