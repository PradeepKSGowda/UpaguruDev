# Architecture Knowledge: Playwright End-to-End Testing Patterns

**Status**: Standard Architecture Knowledge  
**Module**: Testing, QA & Lighthouse Performance Validation (`EPIC-09` / `FEAT-0902`)  
**Applicable Tasks**: `TASK-09020101`, `TASK-09020102`  
**Last Updated**: 2026-09-20  

---

## 1. Overview
Playwright E2E browser tests validate full-stack integration across Next.js 15 App Router React Server Components (RSC), Client Component hydration boundaries, Supabase PostgreSQL queries, and search/filter interactions across desktop and mobile browsers. This document establishes guidelines and patterns for authoring E2E test suites in UPA-GURU.

---

## 2. Established E2E Testing Patterns

### Pattern 1: Landmark-Driven Selection (`data-testid`)
- **Principle**: Avoid selecting by ephemeral Tailwind CSS classes, deep XPath trees, or volatile element tags.
- **Rule**: Always prioritize `data-testid` attributes via `page.getByTestId(...)`.
- **Standard Landmarks**:
  - Feed & Navigation: `notification-filter-bar`, `category-pills-container`, `category-pill-[category]`, `state-filter-select`, `clear-all-filters-btn`, `notification-feed-grid`, `notification-card`, `view-details-btn`.
  - Search: `search-bar-input`, `search-hero-banner`, `search-results-page`.
  - Detail View: `notification-detail`, `notification-breadcrumb`, `detail-apply-online-btn`, `detail-download-pdf-btn`.
  - Admin HITL: `admin-login-form`, `admin-draft-queue`, `admin-draft-card-[id]`, `btn-approve-draft`, `btn-reject-draft`.

### Pattern 2: URL & Search Parameter State Assertions
- When testing filters, pagination, or search:
  - Do not merely check DOM rendering; verify that the URL searchParams synchronizes with user interactions:
    ```ts
    await pill.click();
    await expect(page).toHaveURL(/\/\?.*category=civil_services/);
    await expect(pill).toHaveAttribute("aria-pressed", "true");
    ```
  - Verifies that server-side data refetching is triggered via Next.js RSC URL synchronization.

### Pattern 3: Schema.org Structured Data DOM Validation
- For public notification pages, test that the rendered HTML contains valid JSON-LD `<script>` elements:
  ```ts
  const jsonLdScripts = page.locator('script[type="application/ld+json"]');
  expect(await jsonLdScripts.count()).toBeGreaterThanOrEqual(1);
  const content = await jsonLdScripts.first().textContent();
  expect(content).toContain('"@type":"JobPosting"');
  ```

### Pattern 4: Mobile Viewport & Responsiveness Assertions
- Every critical journey must include a mobile viewport check:
  - Emulate $375 \times 667$ (Pixel / iPhone standard width).
  - Verify that key controls remain visible and accessible.
  - Assert zero horizontal scrollbar overflow:
    ```ts
    const isHorizontalScrollable = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isHorizontalScrollable).toBe(false);
    ```

### Pattern 5: Failure Artifacts & WebServer Reuse
- In `playwright.config.ts`:
  - `trace: 'on-first-retry'` captures DOM snapshots, network requests, and console logs.
  - `screenshot: 'only-on-failure'` saves PNG screenshots of failed steps.
  - `video: 'retain-on-failure'` stores video recordings for post-mortem debugging.
  - `webServer.reuseExistingServer: !process.env.CI` connects seamlessly to `npm run dev` during local development without spawning redundant server instances.
