# Skill: SEO Audit & Structured Data (`seo-audit.md`)

## Input
- **Page Route / URL**: e.g., `/notification/[slug]`, `/exam/[slug]`, `/category/[category]`, or homepage `/`.
- **Target Keywords**: Primary and secondary search terms (e.g., *"KPSC Gazetted Probationers 2026 Notification PDF"*).
- **Entity Data Model**: Notification title, dates, vacancies, conducting body, syllabus, official links.
- **Rendering Strategy**: SSR (Server-Side Rendering) or ISR (Incremental Static Revalidation).

---

## Output
- **Next.js `generateMetadata()` Implementation**: Exported metadata generator with dynamic title, description, canonical link, and OpenGraph/Twitter card tags.
- **JSON-LD Schema Script**: Google-compliant `<script type="application/ld+json">` snippet generating `JobPosting` and `Event` schemas.
- **Core Web Vitals Audit Report**: LCP, FID/INP, CLS measurements and remediation plan.
- **Dynamic XML Sitemap Entry**: URL definition with change frequency, priority, and `lastModified` timestamp.
- **Lighthouse CI Command & Verification**: CLI command to execute mobile SEO and performance audit.

---

## Checklist
- [ ] Mobile SEO Lighthouse score achieves ≥ 95 (`AGENTS.md` Rule 4).
- [ ] Mobile Performance Lighthouse score achieves ≥ 95 (`AGENTS.md` Rule 4).
- [ ] Notification detail pages render valid Google `JobPosting` schema with required fields: `title`, `description`, `datePosted`, `validThrough`, `hiringOrganization`, `jobLocation` (`AGENTS.md` Rule 4).
- [ ] Exam date pages render valid `Event` schema with `name`, `startDate`, `location`, `organizer`.
- [ ] Exactly one semantic `<h1>` tag exists on the page containing the primary keyword.
- [ ] Page title is between 50 and 60 characters; meta description is between 120 and 160 characters.
- [ ] Canonical URL is explicitly defined to prevent duplicate content indexing.
- [ ] OpenGraph image dynamically generated via `@vercel/og` or resolved from CDN.
- [ ] Dynamic sitemap (`/sitemap.xml`) includes the route with fresh `lastModified` timestamp.

---

## Prompt Template
```markdown
You are the SEO Engineer Agent for UPA-GURU.
Perform an SEO audit and implement structured data for: [PAGE_ROUTE]

Target Route: [DYNAMIC_OR_STATIC_PATH]
Primary Keyword: [PRIMARY_KEYWORD]
Secondary Keywords: [SECONDARY_KEYWORDS]
Entity Attributes: [LIST_ATTRIBUTES]

Requirements:
1. Implement generateMetadata() with title template, description, canonical URL, and OpenGraph.
2. Generate Google-compliant JobPosting and/or Event JSON-LD schema.
3. Validate against Schema.org and Google Rich Results Test specifications.
4. Ensure headings follow strict hierarchy: single <h1>, followed by <h2>, <h3>.
5. Provide step-by-step verification commands using @lhci/cli.
```

---

## Examples

### Example 1: Next.js 15 `generateMetadata()` and `JobPosting` JSON-LD
```tsx
/**
 * SEO Module: Dynamic Metadata & JobPosting JSON-LD for /notification/[slug]
 * Intent: Optimizes page for Google Rich Snippets and organic search discovery.
 */
import { Metadata } from "next";
import { getNotificationBySlug } from "@/lib/data/notifications";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const notification = await getNotificationBySlug(slug);

  if (!notification) {
    return { title: "Notification Not Found | UPA-GURU" };
  }

  const title = `${notification.title} - Apply Online, Vacancies, Dates | UPA-GURU`;
  const description = `Apply for ${notification.title}. ${notification.total_vacancies} vacancies announced by ${notification.conducting_body}. Last date to apply: ${notification.application_end_date}.`;

  return {
    title,
    description,
    alternates: {
      canonical: `https://upaguru.in/notification/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `https://upaguru.in/notification/${slug}`,
      siteName: "UPA-GURU",
      images: [
        {
          url: `https://upaguru.in/api/og?title=${encodeURIComponent(notification.title)}`,
          width: 1200,
          height: 630,
          alt: notification.title,
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export function NotificationJsonLd({ notification }: { notification: any }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "title": notification.title,
    "description": `Official notification for ${notification.total_vacancies} posts by ${notification.conducting_body}. Minimum qualification: ${notification.qualification_required?.join(", ")}.`,
    "identifier": {
      "@type": "PropertyValue",
      "name": notification.conducting_body,
      "value": notification.notification_number || notification.slug,
    },
    "datePosted": notification.published_at || notification.created_at,
    "validThrough": `${notification.application_end_date}T23:59:59+05:30`,
    "employmentType": "FULL_TIME",
    "hiringOrganization": {
      "@type": "Organization",
      "name": notification.conducting_body,
      "sameAs": notification.official_website || "https://upaguru.in",
    },
    "jobLocation": {
      "@type": "Place",
      "address": {
        "@type": "PostalAddress",
        "addressRegion": notification.state_or_central,
        "addressCountry": "IN",
      },
    },
    "directApply": true,
  };

  return (
    <script
      id="job-posting-json-ld"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

---

## Failure Conditions
- **Lighthouse Failure**: Mobile SEO or Performance score below 95 on production or staging audit.
- **Invalid Structured Data**: JSON-LD failing Google Rich Results Test due to missing required properties (`validThrough`, `hiringOrganization`).
- **Duplicate H1 Tags**: Rendering multiple `<h1>` elements on a single page.
- **Missing Canonical Tag**: Omitting `<link rel="canonical">` leading to duplicate content penalties.
- **Client-Side Metadata**: Attempting to generate metadata inside a Client Component (`"use client"`).
