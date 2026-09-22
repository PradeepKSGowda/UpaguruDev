/**
 * @file lib/cache/revalidate.ts
 * @module CacheRevalidationEngine
 * @description Centralized on-demand cache revalidation engine for Next.js 15 App Router.
 * Coordinates path purging (revalidatePath) and granular tag-based cache purging (revalidateTag)
 * across candidate feeds, detail pages, programmatic category/state routes, and admin consoles.
 * 
 * Task ID: TASK-06020101 (Subtask: SUB-0602010101)
 * Architecture Reference: ADR-001 (Server Actions), ADR-008 (SEO), ADR-010 (Caching), ADR-013 (Security)
 * 
 * Complies with:
 * - Next.js 15 App Router revalidatePath and revalidateTag contracts
 * - Non-blocking asynchronous telemetry queue logging in public.isr_revalidation_queue
 * - Multi-layer edge cache purging (Vercel Edge CDN + Next.js ISR)
 */

import { revalidatePath, revalidateTag } from "next/cache";
import { CACHE_TAGS } from "./tags";
import { createAdminClient } from "../supabase/server";

export interface RevalidateNotificationOptions {
  /** Notification URL slug (e.g. 'kpsc-gazetted-probationers-2026') */
  slug: string;
  /** Exam category for programmatic SEO page purging (e.g. 'civil_services') */
  category?: string | null;
  /** Indian state or 'Central' for programmatic state route purging */
  state?: string | null;
  /** Prior slug if the notification title/slug was modified */
  previousSlug?: string | null;
  /** Trigger reason for telemetry tracking */
  reason?: "notification_update" | "status_change" | "manual_admin" | "scheduled_purge";
}

export interface RevalidateExamOptions {
  /** Master examination series URL slug */
  slug: string;
  /** Exam category (e.g. 'state_psc') */
  category?: string | null;
  /** State or Central jurisdiction */
  state?: string | null;
  /** Prior slug if updated */
  previousSlug?: string | null;
}

/**
 * Fire-and-forget helper to log ISR revalidation telemetry to public.isr_revalidation_queue
 */
async function recordQueueTelemetry(routePath: string, slug: string, reason: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.from("isr_revalidation_queue").insert({
      route_path: routePath,
      slug,
      reason,
      status: "completed",
      revalidated_at: new Date().toISOString(),
    });
  } catch (err) {
    // Non-blocking diagnostic catch: cache invalidation must succeed even if DB logging fails
    console.warn(`[CacheRevalidation] Telemetry logging notice for ${routePath}:`, err);
  }
}

/**
 * Revalidates all cached paths and tags associated with a published or updated notification.
 * 
 * Purges:
 * - Candidate routes: Homepage (/), Public Directory (/notifications), Detail page (/notification/[slug])
 * - Programmatic SEO routes: /category/[category], /state/[state]
 * - Metadata feeds: /sitemap.xml, /feed.xml
 * - Admin consoles: /admin, /admin/notifications
 * - Tags: 'notifications', 'notification-[slug]', 'category-[category]', 'state-[state]'
 * 
 * @param options - Notification identifiers and routing parameters
 */
export async function revalidateNotification(options: RevalidateNotificationOptions): Promise<void> {
  const { slug, category, state, previousSlug, reason = "notification_update" } = options;

  // 1. Invalidate Primary Candidate Route Paths
  revalidatePath("/");
  revalidatePath("/notifications");
  revalidatePath(`/notification/${slug}`);

  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/notification/${previousSlug}`);
  }

  // 2. Invalidate Programmatic SEO Routes
  if (category) {
    const normalizedCat = category.trim().toLowerCase();
    revalidatePath(`/category/${normalizedCat}`);
    try {
      revalidateTag(CACHE_TAGS.CATEGORY(normalizedCat));
    } catch {
      // Safe fallback in non-request contexts
    }
  }

  if (state) {
    const normalizedState = state.trim().toLowerCase().replace(/[\s_-]+/g, "-");
    revalidatePath(`/state/${normalizedState}`);
    try {
      revalidateTag(CACHE_TAGS.STATE(normalizedState));
    } catch {
      // Safe fallback
    }
  }

  // 3. Invalidate Administrative Consoles
  revalidatePath("/admin");
  revalidatePath("/admin/notifications");

  // 4. Invalidate Global Feeds & Sitemaps
  revalidatePath("/sitemap.xml");

  // 5. Invalidate Granular Next.js Cache Tags
  try {
    revalidateTag(CACHE_TAGS.NOTIFICATIONS);
    revalidateTag(CACHE_TAGS.NOTIFICATION_SLUG(slug));
    if (previousSlug && previousSlug !== slug) {
      revalidateTag(CACHE_TAGS.NOTIFICATION_SLUG(previousSlug));
    }
    revalidateTag(CACHE_TAGS.SITEMAP);
    revalidateTag(CACHE_TAGS.FEEDS);
  } catch (tagErr) {
    console.warn("[CacheRevalidation] Tag purging note:", tagErr);
  }

  // 6. Record background telemetry
  void recordQueueTelemetry(`/notification/${slug}`, slug, reason);
}

/**
 * Revalidates all cached paths and tags associated with an exam series mutation.
 * 
 * @param options - Exam routing and identifier parameters
 */
export async function revalidateExam(options: RevalidateExamOptions): Promise<void> {
  const { slug, category, state, previousSlug } = options;

  // 1. Invalidate Exam Routes
  revalidatePath("/");
  revalidatePath("/exams");
  revalidatePath(`/exams/${slug}`);
  revalidatePath(`/exam/${slug}`);

  if (previousSlug && previousSlug !== slug) {
    revalidatePath(`/exams/${previousSlug}`);
    revalidatePath(`/exam/${previousSlug}`);
  }

  // 2. Invalidate Related Feeds & Admin
  revalidatePath("/notifications");
  revalidatePath("/admin/exams");
  revalidatePath("/admin");
  revalidatePath("/sitemap.xml");

  // 3. Invalidate Cache Tags
  try {
    revalidateTag(CACHE_TAGS.EXAMS);
    revalidateTag(CACHE_TAGS.EXAM_SLUG(slug));
    revalidateTag(CACHE_TAGS.NOTIFICATIONS);
    if (category) {
      revalidateTag(CACHE_TAGS.CATEGORY(category));
    }
    if (state) {
      revalidateTag(CACHE_TAGS.STATE(state));
    }
  } catch (tagErr) {
    console.warn("[CacheRevalidation] Exam tag purging note:", tagErr);
  }

  // 4. Record telemetry
  void recordQueueTelemetry(`/exam/${slug}`, slug, "manual_admin");
}

/**
 * Revalidates admin draft verification workspaces
 * 
 * @param draftId - Optional draft UUID
 */
export function revalidateDraft(draftId?: string): void {
  revalidatePath("/admin");
  revalidatePath("/admin/drafts");

  if (draftId) {
    revalidatePath(`/admin/drafts/${draftId}`);
    try {
      revalidateTag(CACHE_TAGS.DRAFT_ID(draftId));
    } catch {
      // Safe fallback
    }
  }

  try {
    revalidateTag(CACHE_TAGS.DRAFTS);
  } catch {
    // Safe fallback
  }
}

/**
 * Revalidates candidate alert preferences page
 * 
 * @param _userId - Optional candidate user ID
 */
export function revalidateCandidatePreferences(_userId?: string): void {
  revalidatePath("/preferences");

  try {
    revalidateTag(CACHE_TAGS.PREFERENCES);
  } catch {
    // Safe fallback
  }
}
