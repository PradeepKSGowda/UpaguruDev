# Architectural Design Specification: Programmatic Exam Hub Route

**Document ID:** ARCH-EXAM-ROUTE-001  
**Task ID:** `TASK-02050103` (Subtask: `SUB-0205010301`)  
**Parent Feature:** `FEAT-0205` (Programmatic SEO Landing Pages & Dynamic Sitemaps)  
**Parent Epic:** `EPIC-02` (Candidate Portal: Notification Feed, Detail Pages & Search)  
**Status:** Approved for Implementation  
**Target File:** `app/exam/[slug]/page.tsx`  

---

## 1. Context & Business Objectives

Candidates and search engine bots often search for specific examination brand entities rather than isolated notifications (e.g. *"UPSC Civil Services 2026 syllabus and notifications"*, *"KPSC KAS exam dates"*, *"IBPS PO recruitment hub"*).

In accordance with **ADR-008** (Programmatic SEO & Structured Data Architecture), UPA-GURU provides dedicated programmatic exam entity hub pages at `/exam/[slug]`.

### Key Objectives
1. **Entity Hub Pre-Rendering (SSG & ISR)**: Pre-render all official exam series via `generateStaticParams()` querying the `exams` master table.
2. **Dynamic Entity Metadata**: Generate authoritative titles (`'{Exam Title} Notifications, Dates & Vacancies - UPA-GURU'`), conducting body descriptions, and social metadata.
3. **Structured Data Rich Results**: Inject Google-compliant Schema.org `BreadcrumbList` (Home > Exams > [Exam Title]) and `CollectionPage` (`ItemList` of associated notifications).
4. **Authoritative Exam Header**: Render conducting body name, examination category badge, governance jurisdiction (State or Central), official website external link, and live active notification count.
5. **Grouped Notifications Feed**: Display all notifications linked to this exam entity with responsive cards grid, server-side pagination, and related exam recommendations.
6. **Zero Client JS Overhead**: Maintain pure React Server Component (RSC) architecture with edge caching (`revalidate = 3600`).

---

## 2. Route & Component Architecture

```
app/exam/[slug]/
└── page.tsx                   (React Server Component, ISR revalidate = 3600)
    ├── generateStaticParams() (Returns all published exam entity slugs)
    ├── generateMetadata()     (Injects canonical, title, description, OG)
    ├── Breadcrumb             (Accessible Home > Exams > [Exam Title])
    ├── Exam Hero Header       (Title, Conducting body, Category, Official link)
    ├── Notifications Feed     (Associated notifications grid with NotificationCard)
    ├── Pagination Controls    (Crawlable links preserving exam slug & page)
    └── JSON-LD Schema         (BreadcrumbList + CollectionPage metadata)
```

---

## 3. Next.js 15 Compatibility & Routing Rules

1. **Asynchronous Params Contract**:
   ```typescript
   interface ExamPageProps {
     params: Promise<{ slug: string }>;
     searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
   }
   ```
   In Next.js 15, `params` and `searchParams` are asynchronous Promises:
   ```typescript
   const { slug } = await params;
   const resolvedSearchParams = await searchParams;
   ```

2. **Validation & 404 Guardrails**:
   If `getExamBySlug(slug)` returns `null`, the route component immediately executes `notFound()` from `next/navigation`.

3. **Incremental Static Regeneration**:
   Configure `export const revalidate = 3600` (1 hour) with `export const dynamicParams = true` to allow newly created exam series to generate on demand.

---

## 4. Playwright Test Landmarks

| Selector | Landmark Attribute | Purpose |
| :--- | :--- | :--- |
| Exam Page Container | `data-testid="exam-page"` | E2E page wrapper |
| Exam Header Section | `data-testid="exam-header"` | Verification of exam info banner |
| Exam Title | `data-testid="exam-title"` | Verification of H1 heading |
| Conducting Body Label | `data-testid="exam-conducting-body"` | Conducting authority verification |
| Notification Cards Grid | `data-testid="exam-notifications-grid"` | Associated notifications grid |
| Empty State Banner | `data-testid="exam-empty-state"` | Verification of zero active notifications |
| Exam Pagination | `data-testid="exam-pagination"` | Verification of pagination controls |
| Breadcrumb Navigation | `data-testid="exam-breadcrumb"` | Structured breadcrumb list |
