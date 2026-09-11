/**
 * @file app/sitemap.ts
 * @module DynamicSitemap
 * @description Generates a comprehensive, dynamic XML sitemap (/sitemap.xml) for UPA-GURU,
 * aggregating the candidate portal homepage, all 8 exam categories, 37 states & UTs,
 * published exam series, and individual notification detail pages.
 * 
 * Task ID: TASK-02050104 (Subtask: SUB-0205010401)
 * Architecture Reference: ADR-008 (Programmatic SEO & Dynamic Sitemaps), AGENTS.md (Rule 4)
 * 
 * Complies with:
 * - Next.js 15 App Router MetadataRoute.Sitemap API
 * - Google Search Central XML Sitemap specifications
 * - ISO-8601 lastModified dates
 * - Frequency and priority hierarchy
 */

import type { MetadataRoute } from "next";
import { getSitemapData } from "@/lib/data/notifications";
import { VALID_CATEGORIES } from "./category/[category]/page";
import { STATE_REGIONS_MAP } from "./state/[state]/page";

export const revalidate = 3600; // 1 hour edge cache revalidation

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in";
  const now = new Date();

  // 1. Static Core Landing Pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1.0,
    },
  ];

  // 2. Programmatic Category Landing Pages (8 official categories)
  const categoryRoutes: MetadataRoute.Sitemap = VALID_CATEGORIES.map((category) => ({
    url: `${siteUrl}/category/${category}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // 3. Programmatic State & UT Landing Pages (37 states, UTs, and Central)
  const stateRoutes: MetadataRoute.Sitemap = Object.values(STATE_REGIONS_MAP).map((region) => ({
    url: `${siteUrl}/state/${region.slug}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // 4. Query published notifications & exam entities from database
  const { notifications, exams } = await getSitemapData();

  // 5. Exam Entity Hub Routes (/exam/[slug])
  const examRoutes: MetadataRoute.Sitemap = exams.map((exam) => ({
    url: `${siteUrl}/exam/${exam.slug}`,
    lastModified: new Date(exam.updatedAt),
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  // 6. Notification Detail Pages (/notification/[slug])
  const notificationRoutes: MetadataRoute.Sitemap = notifications.map((notif) => ({
    url: `${siteUrl}/notification/${notif.slug}`,
    lastModified: new Date(notif.updatedAt),
    changeFrequency: "daily",
    priority: 0.9,
  }));

  // Aggregate all sitemap entries in priority order
  return [
    ...staticRoutes,
    ...categoryRoutes,
    ...stateRoutes,
    ...examRoutes,
    ...notificationRoutes,
  ];
}
