# Architectural Design Specification: Dynamic XML Sitemap & Robots.txt

**Document ID:** ARCH-SITEMAP-ROBOTS-001  
**Task ID:** `TASK-02050104` (Subtasks: `SUB-0205010401`, `SUB-0205010402`)  
**Parent Feature:** `FEAT-0205` (Programmatic SEO Landing Pages & Dynamic Sitemaps)  
**Parent Epic:** `EPIC-02` (Candidate Portal: Notification Feed, Detail Pages & Search)  
**Status:** Approved for Implementation  
**Target Files:** `app/sitemap.ts`, `app/robots.ts`  

---

## 1. Context & Business Objectives

To maximize organic search indexation speed across search engines (Googlebot, Bingbot), UPA-GURU requires a fully dynamic XML sitemap (`/sitemap.xml`) and webmaster crawl directives (`/robots.txt`) in strict compliance with **ADR-008** (Programmatic SEO & Structured Data Architecture).

### Key Objectives
1. **Dynamic URL Aggregation**: Dynamically query and index all published notifications (`/notification/[slug]`), exam entity hubs (`/exam/[slug]`), official categories (`/category/[category]`), geographical states and UTs (`/state/[state]`), and static portal entry points (`/`).
2. **Freshness & Priority Hierarchy**: Provide accurate `lastModified` ISO timestamps, distinct search priority weights (`1.0` to `0.8`), and crawl frequencies (`daily` vs `weekly`).
3. **Crawl Budget Optimization**: Protect server resources by disallowing private administrative and authentication endpoints (`/admin/*`, `/auth/*`, `/api/*`) and query parameter search results (`/search`) in `robots.txt`.
4. **Automated Search Engine Discovery**: Explicitly reference the canonical sitemap URL (`https://upaguru.in/sitemap.xml`) in `robots.txt`.
5. **Next.js 15 Native MetadataRoute**: Implement using Next.js 15 App Router built-in `MetadataRoute.Sitemap` and `MetadataRoute.Robots` APIs with zero external third-party dependencies.

---

## 2. Sitemap URL Architecture & Priorities

| Route Pattern | Target Count | Priority | Change Frequency | Last Modified Source |
| :--- | :--- | :--- | :--- | :--- |
| `/` (Homepage) | 1 | `1.0` | `daily` | Current build/request date |
| `/category/[category]` | 8 Official Categories | `0.8` | `daily` | Daily update timestamp |
| `/state/[state]` | 37 States & UTs | `0.8` | `daily` | Daily update timestamp |
| `/exam/[slug]` | All published exams | `0.8` | `weekly` | `exams.updated_at` |
| `/notification/[slug]` | All published notifications | `0.9` | `daily` | `notifications.updated_at` |

> [!NOTE]
> `/search` is intentionally omitted from the sitemap and disallowed in `robots.txt` per Google Webmaster Search Central guidelines to prevent search engine crawl bloat on parameter queries.

---

## 3. Robots.txt Specification (`app/robots.ts`)

```typescript
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
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
```

---

## 4. Playwright & Search Crawler Landmarks

1. `/sitemap.xml`: Validated for well-formed XML structure, valid `<loc>`, `<lastmod>`, `<changefreq>`, and `<priority>` elements.
2. `/robots.txt`: Validated for proper `User-agent`, `Allow`, `Disallow`, and `Sitemap` declarations.
