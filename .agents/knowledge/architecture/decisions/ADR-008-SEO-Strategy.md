# ADR-008: Programmatic SEO & Structured Data Architecture

## Status
Accepted

## Date
2026-09-02

## Context & Problem Statement
Government exam notifications have high organic search demand. Aspirants search for specific terms such as *"KPSC Gazetted Probationer Notification 2026 PDF"*, *"UPSC Civil Services Age Limit"*, or *"RRB NTPC Application Deadline"*.

To achieve dominant organic search visibility, UPA-GURU requires:
- Programmatic route generation for all published notifications and exam categories.
- Rich Snippet qualification on Google Search results via Schema.org JSON-LD structured data (`JobPosting` and `Event`).
- Sub-second page rendering and high Core Web Vitals to meet Google's page experience signals (Lighthouse SEO score $\ge 95$).
- Dynamic automated XML Sitemaps (`/sitemap.xml`).

## Decision Outcome
Adopt a **Programmatic SEO Strategy** leveraging Next.js 15 App Router dynamic routes, native Metadata API, and JSON-LD structured data injection.

## Implementation Details

### 1. Programmatic Route Architecture
- `/notification/[slug]`: Primary dynamic landing page for individual exam notifications.
- `/exam/[slug]`: Comprehensive hub page for a specific exam series (e.g. KAS, IAS, IBPS PO).
- `/category/[category]`: Filtered landing pages (e.g. `/category/civil_services`, `/category/banking`).
- `/state/[state]`: Geographically targeted landing pages (e.g. `/state/karnataka`, `/state/central`).

### 2. Google Structured Data (JSON-LD Schemas)
Every public notification page (`/notification/[slug]`) must render valid Google-compliant JSON-LD schema tags inside `<head>`:

```json
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "KPSC Gazetted Probationers 2026",
  "description": "Official notification for 384 Vacancies in Karnataka Administrative Services",
  "datePosted": "2026-09-01",
  "validThrough": "2026-10-15",
  "employmentType": "FULL_TIME",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "Karnataka Public Service Commission",
    "sameAs": "https://kpsc.kar.nic.in"
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "addressRegion": "Karnataka",
      "addressCountry": "IN"
    }
  }
}
```

### 3. Dynamic Metadata API & OpenGraph Cards
- Dynamic `generateMetadata()` function injects canonical URLs, OpenGraph image cards, and Twitter summary metadata.
- Pre-rendered preview images generated automatically using Next.js `@vercel/og`.

### 4. Dynamic Sitemaps & Incremental Static Revalidation (ISR)
- `/sitemap.xml` dynamically indexes all published notifications and exams.
- Pages use ISR (`revalidate = 3600`) to balance server load while serving cached static HTML to search engine crawlers.

## Consequences

### Positive
- Maximizes organic search traffic and indexation speed.
- Google Rich Snippets display application deadlines and vacancy numbers directly in search results.
- Guarantees Lighthouse SEO & Performance scores $\ge 95$.

### Negative
- Schema specifications must strictly follow Google Rich Result documentation to prevent structured data validation warnings.

## Compliance & Guardrails
- Complies strictly with `.agents/rules/AGENTS.md` Rule 4 (Lighthouse Target $\ge 95$ & JSON-LD `JobPosting`/`Event` schemas).