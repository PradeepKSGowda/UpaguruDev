/**
 * @file app/robots.ts
 * @module RobotsConfiguration
 * @description Dynamic robots.txt configuration for UPA-GURU, specifying crawl directives,
 * protected administrative zones, and referencing the canonical dynamic XML sitemap.
 * 
 * Task ID: TASK-02050104 (Subtask: SUB-0205010402)
 * Architecture Reference: ADR-008 (Programmatic SEO & Webmaster Directives), AGENTS.md (Rule 4)
 * 
 * Complies with:
 * - Next.js 15 App Router MetadataRoute.Robots API
 * - Google Search Central Robots.txt specifications
 * - Security protection for admin, auth, and API routes
 * - Prevention of crawl bloat on search queries (/search)
 */

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in";

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/*",
          "/auth",
          "/auth/*",
          "/api/*",
          "/search",
        ],
      },
      {
        userAgent: "Googlebot",
        allow: [
          "/",
          "/category/*",
          "/state/*",
          "/exam/*",
          "/notification/*",
        ],
        disallow: [
          "/admin",
          "/admin/*",
          "/auth",
          "/auth/*",
          "/api/*",
          "/search",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
