# Architectural Design Specification: Programmatic State & UT Route

**Document ID:** ARCH-STATE-ROUTE-001  
**Task ID:** `TASK-02050102` (Subtask: `SUB-0205010201`)  
**Parent Feature:** `FEAT-0205` (Programmatic SEO Landing Pages & Dynamic Sitemaps)  
**Parent Epic:** `EPIC-02` (Candidate Portal: Notification Feed, Detail Pages & Search)  
**Status:** Approved for Implementation  
**Target File:** `app/state/[state]/page.tsx`  

---

## 1. Context & Business Objectives

A significant portion of government exam aspirants search for state-level opportunities (e.g. *"Karnataka government jobs 2026"*, *"UPPSC exam notifications"*, *"Maharashtra police recruitment"*).

To capture geo-targeted organic search traffic and comply with **ADR-008** (Programmatic SEO & Structured Data Architecture), UPA-GURU requires dedicated programmatic landing pages at `/state/[state]`.

### Key Objectives
1. **Comprehensive Geographical Coverage**: Pre-render all 28 Indian States, 8 Union Territories, and Central/All-India recruitment hub via `generateStaticParams()`.
2. **Dynamic SEO Metadata**: Generate targeted titles (`'{State Name} Government Exams & Recruitment 2026 - UPA-GURU'`), localized meta descriptions, canonical URLs, and OpenGraph/Twitter social cards.
3. **Structured Data Rich Results**: Inject Google-compliant Schema.org `BreadcrumbList` (Home > States > [State Name]) and `CollectionPage` JSON-LD schemas.
4. **Rich Candidate UX**: Render an informative hero banner with live vacancy counts, conducting state PSC highlights, responsive `NotificationCard` grid, server-side pagination, and neighbor/regional state discovery links.
5. **Zero Client JS Overhead**: Implement as a pure React Server Component (RSC) with edge caching (`revalidate = 3600`) for sub-150ms TTFB.

---

## 2. Geographical Domain Mapping

The system supports all 28 States, 8 Union Territories, and Central Government:

| Region Type | Count | Sample Slugs | Conducting Bodies & Agencies |
| :--- | :--- | :--- | :--- |
| **Central** | 1 | `central` | UPSC, SSC, RRB, IBPS, Defence |
| **Southern States** | 5 | `karnataka`, `tamil-nadu`, `kerala`, `andhra-pradesh`, `telangana` | KPSC, TNPSC, Kerala PSC, APPSC, TSPSC |
| **Northern States** | 6 | `uttar-pradesh`, `rajasthan`, `punjab`, `haryana`, `himachal-pradesh`, `uttarakhand` | UPPSC, RPSC, PPSC, HPSC, HPPSC, UKPSC |
| **Western States** | 3 | `maharashtra`, `gujarat`, `goa` | MPSC, GPSC, Goa PSC |
| **Eastern States** | 4 | `bihar`, `west-bengal`, `odisha`, `jharkhand` | BPSC, WBPSC, OPSC, JPSC |
| **Central States** | 2 | `madhya-pradesh`, `chhattisgarh` | MPPSC, CGPSC |
| **North-Eastern States**| 8 | `assam`, `meghalaya`, `manipur`, `tripura`, `mizoram`, `nagaland`, `arunachal-pradesh`, `sikkim` | APSC, MPSC, TPSC, NPSC, APPSC, SPSC |
| **Union Territories** | 8 | `delhi`, `chandigarh`, `jammu-and-kashmir`, `ladakh`, `puducherry`, `andaman-and-nicobar-islands`, `dadra-nagar-haveli-daman-diu`, `lakshadweep` | DSSSB, JKPSC, UT Administrations |

---

## 3. Route & Component Architecture

```
app/state/[state]/
└── page.tsx                   (React Server Component, ISR revalidate = 3600)
    ├── generateStaticParams() (Returns 37 routes: 28 States + 8 UTs + Central)
    ├── generateMetadata()     (Injects canonical, title, description, OG)
    ├── Breadcrumb             (Accessible Home > States > [State Name])
    ├── State Hero             (H1, description, live notification count)
    ├── Regional Discovery     (Cross-linking other states in same region)
    ├── NotificationFeed Grid  (12 items per page with NotificationCard)
    ├── Pagination Controls    (Crawlable links preserving state & page)
    └── JSON-LD Schema         (BreadcrumbList + CollectionPage metadata)
```

---

## 4. Next.js 15 Compatibility & Routing Rules

1. **Asynchronous Params Contract**:
   ```typescript
   interface StatePageProps {
     params: Promise<{ state: string }>;
     searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
   }
   ```
   In Next.js 15, `params` and `searchParams` are asynchronous Promises and must be awaited before accessing properties:
   ```typescript
   const { state } = await params;
   const resolvedSearchParams = await searchParams;
   ```

2. **Validation & 404 Guardrails**:
   If an incoming route slug does not match the defined states/UTs list (e.g. `/state/invalid-region`), the route component immediately executes `notFound()` to prevent soft-404 SEO penalties.

3. **Incremental Static Regeneration**:
   Configure `export const revalidate = 3600` (1 hour) to cache statically generated pages at edge CDN nodes.

---

## 5. Playwright Test Landmarks

| Selector | Landmark Attribute | Purpose |
| :--- | :--- | :--- |
| State Page Container | `data-testid="state-page"` | E2E page wrapper |
| State Hero Section | `data-testid="state-hero"` | Verification of H1 and state badge |
| State H1 Heading | `data-testid="state-h1"` | Title verification |
| Breadcrumb Navigation | `data-testid="state-breadcrumb"` | Structured breadcrumb list verification |
| Notification Cards Grid | `data-testid="state-grid"` | Responsive cards grid container |
| Empty State Banner | `data-testid="state-empty-state"` | Verification of zero active notifications |
| State Pagination | `data-testid="state-pagination"` | Verification of pagination controls |
| Regional States Bar | `data-testid="regional-states-links"` | Internal linking verification |
