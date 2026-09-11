# Architectural Design Specification: Programmatic Category Route

**Document ID:** ARCH-CATEGORY-ROUTE-001  
**Task ID:** `TASK-02050101` (Subtask: `SUB-0205010101`)  
**Parent Feature:** `FEAT-0205` (Programmatic SEO Landing Pages & Dynamic Sitemaps)  
**Parent Epic:** `EPIC-02` (Candidate Portal: Notification Feed, Detail Pages & Search)  
**Status:** Approved for Implementation  
**Target File:** `app/category/[category]/page.tsx`  

---

## 1. Context & Business Objectives

Organic search traffic is the primary acquisition funnel for competitive examination candidates. Search queries frequently target categorical keywords such as *"Civil Services exams 2026"*, *"Banking notifications"*, *"Railway RRB recruitments"*, or *"State PSC job openings"*.

To capture high-intent search queries and fulfill **ADR-008** (Programmatic SEO & Structured Data Architecture), UPA-GURU requires dedicated, search-engine-optimized programmatic category landing pages at `/category/[category]`.

### Key Objectives
1. **Static Pre-Rendering (SSG/ISR)**: Pre-generate all 8 official exam categories at build time via `generateStaticParams()` to provide instant TTFB (Time to First Byte) under 150ms.
2. **Dynamic SEO Metadata**: Provide custom, high-ranking titles (`'{Category Name} Government Exams - UPA-GURU'`), category-specific meta descriptions, canonical URLs, and OpenGraph/Twitter social cards.
3. **Structured Data Rich Results**: Inject Schema.org compliant `BreadcrumbList` and `CollectionPage` JSON-LD schemas into the `<head>` to qualify for Google search rich snippets.
4. **Rich Candidate UX**: Render an accessible hero section with live vacancy counts, breadcrumb navigation, responsive `NotificationCard` grid, server-side pagination, and cross-category discovery pills.
5. **Zero Client JS Overhead**: Maintain pure React Server Component (RSC) architecture with zero client-side JavaScript required for layout, data fetching, and card rendering.

---

## 2. Category Domain Mapping

The system strictly maps to the 8 values defined in `exam_category_enum`:

| Category Enum | Display Name | Search Title Format | High-Intent Focus Keywords |
| :--- | :--- | :--- | :--- |
| `civil_services` | Civil Services | Civil Services Government Exams - UPA-GURU | UPSC CSE, IAS, IPS, IFS, Civil Services |
| `banking` | Banking & IBPS | Banking & IBPS Government Exams - UPA-GURU | IBPS PO, Clerk, SBI PO, RBI Grade B |
| `railways` | Railways (RRB) | Railways (RRB) Government Exams - UPA-GURU | RRB NTPC, Group D, ALP, Railway Jobs |
| `defense` | Defence & Military | Defence & Military Government Exams - UPA-GURU | NDA, CDS, AFCAT, Army, Navy, Air Force |
| `state_psc` | State PSCs | State PSCs Government Exams - UPA-GURU | KPSC, UPPSC, MPSC, BPSC, State Civil Services |
| `teaching` | Teaching & Faculty | Teaching & Faculty Government Exams - UPA-GURU | CTET, State TET, UGC NET, School Teacher |
| `police` | Police & Security | Police & Security Government Exams - UPA-GURU | Police SI, Constable, DSP, CAPF |
| `other` | Other Government Exams | Other Government Exams - UPA-GURU | Statutory bodies, PSUs, Autonomous Bodies |

---

## 3. Route & Component Architecture

```
app/category/[category]/
└── page.tsx                   (React Server Component, ISR revalidate = 3600)
    ├── generateStaticParams() (Returns all 8 categories for SSG)
    ├── generateMetadata()     (Injects canonical, title, description, OG)
    ├── Breadcrumb             (Accessible Home > Categories > [Category])
    ├── Category Hero          (H1, description, live count badge)
    ├── Quick Filter Bar       (Sort by deadline, vacancies, date)
    ├── NotificationFeed Grid  (12 items per page with NotificationCard)
    ├── Pagination Controls    (Crawlable links preserving category & page)
    ├── Cross-Category Links   (Internal linking boost for SEO PageRank)
    └── JSON-LD Schema         (BreadcrumbList + CollectionPage metadata)
```

---

## 4. Next.js 15 Compatibility & Routing Rules

1. **Asynchronous Params Contract**:
   ```typescript
   interface CategoryPageProps {
     params: Promise<{ category: string }>;
     searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
   }
   ```
   In Next.js 15, `params` and `searchParams` are asynchronous Promises and must be awaited before accessing properties:
   ```typescript
   const { category } = await params;
   const resolvedSearchParams = await searchParams;
   ```

2. **Validation & 404 Guardrails**:
   If an incoming route slug does not match the 8 defined enum values (e.g. `/category/invalid-slug`), the route component immediately executes `notFound()` to prevent soft-404 SEO penalties.

3. **Incremental Static Regeneration**:
   Configure `export const revalidate = 3600` (1 hour) to cache statically generated pages at edge CDN nodes while allowing background refreshes as new notifications are published.

---

## 5. Structured Data (Schema.org JSON-LD)

Each category page injects two Schema.org objects:

```json
[
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://upaguru.in" },
      { "@type": "ListItem", "position": 2, "name": "Categories", "item": "https://upaguru.in/#categories" },
      { "@type": "ListItem", "position": 3, "name": "Civil Services", "item": "https://upaguru.in/category/civil_services" }
    ]
  },
  {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": "Civil Services Government Exams - UPA-GURU",
    "description": "Latest Civil Services exam notifications, IAS, IPS, IFS recruitments, syllabus, vacancies, and application deadlines on UPA-GURU.",
    "url": "https://upaguru.in/category/civil_services"
  }
]
```

---

## 6. Playwright Test Landmarks

| Selector | Landmark Attribute | Purpose |
| :--- | :--- | :--- |
| Category Page Container | `data-testid="category-page"` | E2E page wrapper |
| Category Hero Section | `data-testid="category-hero"` | Verification of H1 and category badge |
| Breadcrumb Navigation | `data-testid="category-breadcrumb"` | Structured breadcrumb list verification |
| Notification Cards Grid | `data-testid="category-grid"` | Responsive cards grid container |
| Empty State Banner | `data-testid="category-empty-state"` | Verification of zero active notifications |
| Category Pagination | `data-testid="category-pagination"` | Verification of pagination controls |
| Cross-Category Bar | `data-testid="cross-category-links"` | Internal linking verification |
