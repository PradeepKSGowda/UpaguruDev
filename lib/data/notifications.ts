/**
 * @file lib/data/notifications.ts
 * @module NotificationsDataAccess
 * @description Strongly-typed server-side data access layer for querying published notifications,
 * detail views by slug, related notifications, category filtering, search, and pagination from Supabase PostgreSQL.
 * 
 * Task ID: TASK-02030101 (Subtask: SUB-0203010101)
 * Architecture Reference: ADR-001 (RSC Data Fetching), ADR-002 (Database), ADR-008 (SEO & Static Slugs), ADR-013 (Security)
 * 
 * Complies with:
 * - Next.js 15 React Server Component (RSC) execution context
 * - Supabase server client with async cookies support
 * - Zod filter parameter validation
 * - TypeScript strict mode (Zero `any`)
 * - Fail-safe error handling and empty state fallbacks
 */

import { createServerClient } from "../supabase/server";
import { notificationFilterSchema, type ValidatedNotificationFilters } from "../schemas/notifications";
import type { 
  NotificationFilterParams, 
  NotificationListItem, 
  NotificationDetail, 
  PaginatedNotifications,
  ExamCategory,
  NotificationStatus,
  ExamSummary,
  NotificationSortBy
} from "../../types/notifications";
import type { Database } from "../../types/database.types";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type ExamRow = Database["public"]["Tables"]["exams"]["Row"];

interface JoinedNotificationRow extends NotificationRow {
  exams: ExamRow | null;
}

/**
 * Transforms a raw Supabase joined row into a client-friendly NotificationListItem domain model
 */
function mapRowToNotificationListItem(row: JoinedNotificationRow): NotificationListItem {
  const exam = row.exams;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    notificationNumber: row.notification_number,
    totalVacancies: row.total_vacancies ?? 0,
    applicationStartDate: row.application_start_date ?? "",
    applicationEndDate: row.application_end_date ?? "",
    examDate: row.exam_date,
    qualificationRequired: row.qualification_required ?? [],
    ageLimitMin: row.age_limit_min,
    ageLimitMax: row.age_limit_max,
    status: row.status,
    publishedAt: row.published_at,
    exam: {
      id: exam?.id ?? "",
      slug: exam?.slug ?? "",
      title: exam?.title ?? "General Examination",
      conductingBody: exam?.conducting_body ?? "Government Board",
      category: exam?.category ?? "other",
      stateOrCentral: exam?.state_or_central ?? "Central",
      officialWebsite: exam?.official_website ?? null,
      logoUrl: exam?.logo_url ?? null,
    },
  };
}

/**
 * Transforms a raw Supabase joined row into a full NotificationDetail domain model
 */
function mapRowToNotificationDetail(row: JoinedNotificationRow): NotificationDetail {
  const listItem = mapRowToNotificationListItem(row);

  return {
    ...listItem,
    officialPdfUrl: row.official_pdf_url,
    applyOnlineUrl: row.apply_online_url,
    syllabusSummary: (row.syllabus_summary as Record<string, unknown>) ?? {},
    selectionProcess: row.selection_process ?? [],
    verifiedBy: row.verified_by,
    createdAt: row.created_at ?? "",
    updatedAt: row.updated_at ?? "",
  };
}

/**
 * Fetches published notifications with optional filtering, sorting, and pagination
 * Designed for use in React Server Components (RSC) and Server Actions.
 * 
 * @param params Optional query filters (category, state, search, sortBy, page, pageSize)
 * @returns Paginated list of NotificationListItem objects with total counts
 */
export async function getPublishedNotifications(
  params: NotificationFilterParams = {}
): Promise<PaginatedNotifications> {
  // Validate and sanitize parameters with Zod
  const validation = notificationFilterSchema.safeParse(params);
  const validatedFilters: ValidatedNotificationFilters = validation.success
    ? validation.data
    : {
        category: "all",
        state: "all",
        search: "",
        sortBy: "deadline_soonest",
        page: 1,
        pageSize: 12,
      };

  const { category, state, search, sortBy, page, pageSize } = validatedFilters;

  try {
    const supabase = await createServerClient();

    // Start query with exact count for pagination calculation
    let query = supabase
      .from("notifications")
      .select(`
        *,
        exams!inner (
          id,
          slug,
          title,
          conducting_body,
          category,
          state_or_central,
          official_website,
          logo_url
        )
      `, { count: "exact" })
      .eq("status", "published");

    // Apply category filter if specified
    if (category && category !== "all") {
      query = query.eq("exams.category", category);
    }

    // Apply state/central filter if specified
    if (state && state !== "all") {
      query = query.ilike("exams.state_or_central", `%${state}%`);
    }

    // Apply text search across notification title and number
    if (search && search.trim().length > 0) {
      const sanitized = search.trim().replace(/[%_]/g, "\\$&");
      query = query.or(`title.ilike.%${sanitized}%,notification_number.ilike.%${sanitized}%`);
    }

    // Apply sort criteria
    switch (sortBy) {
      case "deadline_soonest":
        query = query.order("application_end_date", { ascending: true, nullsFirst: false });
        break;
      case "deadline_latest":
        query = query.order("application_end_date", { ascending: false, nullsFirst: false });
        break;
      case "recently_published":
        query = query.order("published_at", { ascending: false, nullsFirst: false });
        break;
      case "vacancies_high_low":
        query = query.order("total_vacancies", { ascending: false });
        break;
      case "title_asc":
        query = query.order("title", { ascending: true });
        break;
      default:
        query = query.order("application_end_date", { ascending: true, nullsFirst: false });
        break;
    }

    // Calculate offset and limits for pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, count, error } = await query;

    if (error) {
      console.error("[getPublishedNotifications] Supabase query error:", error.message);
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize);
    const notifications = (data as unknown as JoinedNotificationRow[]).map(mapRowToNotificationListItem);

    return {
      data: notifications,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  } catch (err) {
    console.error("[getPublishedNotifications] Unexpected execution error:", err);
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }
}

/**
 * Convenient alias for getPublishedNotifications()
 */
export const getNotifications = getPublishedNotifications;

/**
 * Fetches a single published notification by its unique URL slug with full exam join data.
 * Task ID: TASK-02030101 (Subtask: SUB-0203010101)
 * 
 * @param slug Unique URL slug of the notification
 * @returns Full NotificationDetail object or null if not found or not published
 */
export async function getNotificationBySlug(slug: string): Promise<NotificationDetail | null> {
  if (!slug || slug.trim().length === 0) {
    return null;
  }

  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("notifications")
      .select(`
        *,
        exams!inner (
          id,
          slug,
          title,
          conducting_body,
          category,
          state_or_central,
          official_website,
          logo_url
        )
      `)
      .eq("slug", slug.trim())
      .eq("status", "published")
      .maybeSingle();

    if (error) {
      console.error("[getNotificationBySlug] Query error for slug:", slug, error.message);
      return null;
    }

    if (!data) {
      return null;
    }

    return mapRowToNotificationDetail(data as unknown as JoinedNotificationRow);
  } catch (err) {
    console.error("[getNotificationBySlug] Unexpected execution error:", err);
    return null;
  }
}

/**
 * Fetches related published notifications in the same category or conducting body,
 * excluding the currently viewed notification.
 * 
 * @param params Context containing category, conducting body, and current notification ID
 * @param limit Maximum number of related notifications to retrieve (default 3)
 * @returns Array of NotificationListItem objects
 */
export async function getRelatedNotifications(
  params: { category: ExamCategory; currentId: string; conductingBody?: string },
  limit: number = 3
): Promise<NotificationListItem[]> {
  try {
    const supabase = await createServerClient();

    const query = supabase
      .from("notifications")
      .select(`
        *,
        exams!inner (
          id,
          slug,
          title,
          conducting_body,
          category,
          state_or_central,
          official_website,
          logo_url
        )
      `)
      .eq("status", "published")
      .neq("id", params.currentId)
      .eq("exams.category", params.category)
      .order("published_at", { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error("[getRelatedNotifications] Query error:", error.message);
      return [];
    }

    if (!data) {
      return [];
    }

    return (data as unknown as JoinedNotificationRow[]).map(mapRowToNotificationListItem);
  } catch (err) {
    console.error("[getRelatedNotifications] Unexpected execution error:", err);
    return [];
  }
}

/**
 * Fetches all published notification slugs for Next.js generateStaticParams() ISR pre-rendering.
 * 
 * @param limit Maximum number of static slugs to pre-render (default 100)
 * @returns Array of objects with slug property
 */
export async function getAllPublishedNotificationSlugs(limit: number = 100): Promise<{ slug: string }[]> {
  try {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("notifications")
      .select("slug")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);

    if (error || !data) {
      console.error("[getAllPublishedNotificationSlugs] Error fetching slugs:", error?.message);
      return [];
    }

    return (data as { slug: string }[]).map((item) => ({ slug: item.slug }));
  } catch (err) {
    console.error("[getAllPublishedNotificationSlugs] Unexpected execution error:", err);
    return [];
  }
}

/**
 * Fetches an exam entity master row by its URL slug.
 * Task ID: TASK-02050103 (Subtask: SUB-0205010301)
 * 
 * @param slug Unique exam slug (e.g. 'upsc-civil-services', 'kpsc-gazetted-probationers')
 * @returns ExamSummary or null if not found
 */
export async function getExamBySlug(slug: string): Promise<ExamSummary | null> {
  if (!slug || slug.trim().length === 0) {
    return null;
  }

  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("exams")
      .select("id, slug, title, conducting_body, category, state_or_central, official_website, logo_url")
      .eq("slug", slug.trim())
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const examRow = data as unknown as ExamRow;

    return {
      id: examRow.id,
      slug: examRow.slug,
      title: examRow.title,
      conductingBody: examRow.conducting_body,
      category: examRow.category as ExamCategory,
      stateOrCentral: examRow.state_or_central,
      officialWebsite: examRow.official_website,
      logoUrl: examRow.logo_url,
    };
  } catch (err) {
    console.error("[getExamBySlug] Unexpected execution error:", err);
    return null;
  }
}

/**
 * Fetches all published notifications associated with a specific exam entity.
 * Task ID: TASK-02050103 (Subtask: SUB-0205010301)
 * 
 * @param examSlug Unique slug of the exam series
 * @param options Optional pagination and sorting parameters
 * @returns Paginated list of NotificationListItem domain models
 */
export async function getNotificationsByExamSlug(
  examSlug: string,
  options: { page?: number; pageSize?: number; sortBy?: NotificationSortBy } = {}
): Promise<PaginatedNotifications> {
  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : 12;
  const sortBy = options.sortBy || "deadline_soonest";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    const supabase = await createServerClient();
    let query = supabase
      .from("notifications")
      .select(`
        *,
        exams!inner (
          id,
          slug,
          title,
          conducting_body,
          category,
          state_or_central,
          official_website,
          logo_url
        )
      `, { count: "exact" })
      .eq("exams.slug", examSlug.trim())
      .eq("status", "published");

    switch (sortBy) {
      case "recently_published":
        query = query.order("published_at", { ascending: false, nullsFirst: false });
        break;
      case "vacancies_high_low":
        query = query.order("total_vacancies", { ascending: false });
        break;
      case "title_asc":
        query = query.order("title", { ascending: true });
        break;
      case "deadline_latest":
        query = query.order("application_end_date", { ascending: false, nullsFirst: false });
        break;
      case "deadline_soonest":
      default:
        query = query.order("application_end_date", { ascending: true, nullsFirst: false });
        break;
    }

    const { data, count, error } = await query.range(from, to);

    if (error) {
      console.error("[getNotificationsByExamSlug] Query error:", error);
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize);
    const notifications = (data as unknown as JoinedNotificationRow[]).map(mapRowToNotificationListItem);

    return {
      data: notifications,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  } catch (err) {
    console.error("[getNotificationsByExamSlug] Unexpected execution error:", err);
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }
}

/**
 * Retrieves all published exam series slugs for Next.js ISR pre-rendering (generateStaticParams).
 * Task ID: TASK-02050103 (Subtask: SUB-0205010301)
 * 
 * @returns Array of { slug: string } objects
 */
export async function getAllExamSlugs(): Promise<{ slug: string }[]> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from("exams")
      .select("slug");

    if (error || !data) {
      console.error("[getAllExamSlugs] Error fetching exam slugs:", error?.message);
      return [];
    }

    return (data as { slug: string }[]).map((item) => ({ slug: item.slug }));
  } catch (err) {
    console.error("[getAllExamSlugs] Unexpected execution error:", err);
    return [];
  }
}

/**
 * Fetches recent urgent notifications (closing soonest) for hero highlights and alert banners
 * 
 * @param limit Maximum number of notifications to return (default 4)
 * @returns Array of NotificationListItem objects
 */
export async function getUrgentClosingNotifications(limit: number = 4): Promise<NotificationListItem[]> {
  const result = await getPublishedNotifications({
    sortBy: "deadline_soonest",
    pageSize: limit,
    page: 1,
  });

  return result.data;
}

export interface SearchNotificationsParams {
  query: string;
  category?: ExamCategory | "all";
  state?: string | "all";
  page?: number;
  pageSize?: number;
}

interface SearchRpcRow {
  id: string;
  slug: string;
  title: string;
  notification_number: string | null;
  total_vacancies: number;
  application_start_date: string;
  application_end_date: string;
  exam_date: string | null;
  qualification_required: string[];
  age_limit_min: number | null;
  age_limit_max: number | null;
  status: NotificationStatus;
  published_at: string | null;
  rank: number;
  total_count: number | string;
  exam_id: string;
  exam_slug: string;
  exam_title: string;
  exam_conducting_body: string;
  exam_category: ExamCategory;
  exam_state_or_central: string;
  exam_official_website: string | null;
  exam_logo_url: string | null;
}

/**
 * Executes a PostgreSQL full-text search across published notifications,
 * utilizing GIN indexes, weighted ranking (ts_rank_cd), and pagination.
 * 
 * @param params Search parameters (query keyword, optional category/state filters, pagination)
 * @returns PaginatedNotifications container with ranked NotificationListItem items
 */
export async function searchNotifications(
  params: SearchNotificationsParams
): Promise<PaginatedNotifications<NotificationListItem>> {
  const trimmedQuery = (params.query || "").trim();
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(Math.max(1, params.pageSize || 12), 50);

  if (!trimmedQuery) {
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }

  try {
    const supabase = await createServerClient();

    // 1. Primary execution: PostgreSQL RPC function with relevance ranking
    type GenericRpcClient = {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
    };

    const { data: rpcData, error: rpcError } = await (supabase as unknown as GenericRpcClient).rpc(
      "search_published_notifications",
      {
        search_query: trimmedQuery,
        category_filter: params.category && params.category !== "all" ? params.category : null,
        state_filter: params.state && params.state !== "all" ? params.state : null,
        page_num: page,
        page_size: pageSize,
      }
    );

    if (!rpcError && rpcData && Array.isArray(rpcData)) {
      const rows = rpcData as SearchRpcRow[];
      const firstRow = rows[0];
      const totalCount = firstRow ? Number(firstRow.total_count) : 0;
      const totalPages = Math.ceil(totalCount / pageSize);

      const items: NotificationListItem[] = rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        notificationNumber: row.notification_number,
        totalVacancies: row.total_vacancies,
        applicationStartDate: row.application_start_date,
        applicationEndDate: row.application_end_date,
        examDate: row.exam_date,
        qualificationRequired: row.qualification_required || [],
        ageLimitMin: row.age_limit_min,
        ageLimitMax: row.age_limit_max,
        status: row.status,
        publishedAt: row.published_at,
        exam: {
          id: row.exam_id,
          slug: row.exam_slug,
          title: row.exam_title,
          conductingBody: row.exam_conducting_body,
          category: row.exam_category,
          stateOrCentral: row.exam_state_or_central,
          officialWebsite: row.exam_official_website,
          logoUrl: row.exam_logo_url,
        },
      }));

      return {
        data: items,
        total: totalCount,
        page,
        pageSize,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      };
    }

    // 2. Fallback execution: Standard Supabase .textSearch() with joined exams table
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let queryBuilder = supabase
      .from("notifications")
      .select(
        `
        *,
        exams!inner (
          id,
          slug,
          title,
          conducting_body,
          category,
          state_or_central,
          official_website,
          logo_url
        )
      `,
        { count: "exact" }
      )
      .eq("status", "published");

    // Execute PostgreSQL full-text search query on notifications title
    queryBuilder = queryBuilder.textSearch("title", trimmedQuery, {
      type: "websearch",
      config: "english",
    });

    if (params.category && params.category !== "all") {
      queryBuilder = queryBuilder.eq("exams.category", params.category);
    }

    if (params.state && params.state !== "all") {
      queryBuilder = queryBuilder.ilike("exams.state_or_central", `%${params.state}%`);
    }

    queryBuilder = queryBuilder
      .order("application_end_date", { ascending: true, nullsFirst: false })
      .range(from, to);

    const { data, count, error } = await queryBuilder;

    if (error) {
      console.error("[searchNotifications] Fallback query error:", error.message);
      return {
        data: [],
        total: 0,
        page,
        pageSize,
        totalPages: 0,
        hasNextPage: false,
        hasPreviousPage: false,
      };
    }

    const total = count ?? 0;
    const totalPages = Math.ceil(total / pageSize);
    const items = ((data as unknown as JoinedNotificationRow[]) || []).map(mapRowToNotificationListItem);

    return {
      data: items,
      total,
      page,
      pageSize,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  } catch (err) {
    console.error("[searchNotifications] Unexpected execution error:", err);
    return {
      data: [],
      total: 0,
      page,
      pageSize,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false,
    };
  }
}

export interface SitemapEntry {
  slug: string;
  updatedAt: string;
}

/**
 * Retrieves all published notification and exam entity slugs with updated timestamps
 * for dynamic XML sitemap generation (/sitemap.xml).
 * Task ID: TASK-02050104 (Subtask: SUB-0205010401)
 * 
 * @returns Object containing arrays of notification and exam sitemap entries
 */
export async function getSitemapData(): Promise<{
  notifications: SitemapEntry[];
  exams: SitemapEntry[];
}> {
  try {
    const supabase = await createServerClient();

    const [notifsRes, examsRes] = await Promise.all([
      supabase
        .from("notifications")
        .select("slug, updated_at, published_at")
        .eq("status", "published")
        .order("updated_at", { ascending: false }),
      supabase
        .from("exams")
        .select("slug, updated_at")
        .order("updated_at", { ascending: false }),
    ]);

    const notifRows = (notifsRes.data as unknown as { slug: string; updated_at?: string | null; published_at?: string | null }[]) ?? [];
    const examRows = (examsRes.data as unknown as { slug: string; updated_at?: string | null }[]) ?? [];

    const notifications: SitemapEntry[] = notifRows.map((row) => ({
      slug: row.slug,
      updatedAt: row.updated_at || row.published_at || new Date().toISOString(),
    }));

    const exams: SitemapEntry[] = examRows.map((row) => ({
      slug: row.slug,
      updatedAt: row.updated_at || new Date().toISOString(),
    }));

    return { notifications, exams };
  } catch (err) {
    console.error("[getSitemapData] Unexpected execution error:", err);
    return { notifications: [], exams: [] };
  }
}

