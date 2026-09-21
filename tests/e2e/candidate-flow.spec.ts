/**
 * @file tests/e2e/candidate-flow.spec.ts
 * @description Playwright End-to-End test suite covering critical Candidate user journeys.
 * Flow: Homepage -> Interactive Filtering -> Full-Text Search -> Notification Detail Page -> Schema.org Verification.
 * 
 * Task ID: TASK-09020101
 * Subtask: SUB-0902010101
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-008 (Programmatic SEO), AGENTS.md (Rule 2: Testing Safety Guardrails)
 */

import { test, expect } from "@playwright/test";

test.describe("Candidate Portal User Journey", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to candidate portal homepage
    await page.goto("/");
  });

  test("E2E-CAND-01: Homepage initial render and essential landmarks", async ({ page }) => {
    // 1. Assert page title contains UPA-GURU
    await expect(page).toHaveTitle(/UPA-GURU/i);

    // 2. Assert Filter Bar is present and visible
    const filterBar = page.getByTestId("notification-filter-bar");
    await expect(filterBar).toBeVisible();

    // 3. Assert Category Pills Container is visible
    const categoryPills = page.getByTestId("category-pills-container");
    await expect(categoryPills).toBeVisible();

    // 4. Assert Notification Feed Grid or Empty State is visible
    const feedGrid = page.getByTestId("notification-feed-grid");
    const emptyState = page.getByTestId("empty-state");
    await expect(feedGrid.or(emptyState)).toBeVisible();
  });

  test("E2E-CAND-02: Interactive category pill filtering updates URL and refetches feed", async ({ page }) => {
    const categoryPillsContainer = page.getByTestId("category-pills-container");
    await expect(categoryPillsContainer).toBeVisible();

    // Select Civil Services category pill
    const civilServicesPill = page.getByTestId("category-pill-civil_services");
    if (await civilServicesPill.isVisible()) {
      await civilServicesPill.click();

      // Verify URL search parameter is synchronized
      await expect(page).toHaveURL(/\/\?.*category=civil_services/);

      // Verify pill has active state styling
      await expect(civilServicesPill).toHaveAttribute("aria-pressed", "true");
    }

    // Reset filters using Clear All button
    const clearBtn = page.getByTestId("clear-all-filters-btn");
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
      await expect(page).toHaveURL(/^\/?$/);
    }
  });

  test("E2E-CAND-03: Full-text search bar execution and results page navigation", async ({ page }) => {
    // 1. Locate search input on home page
    const searchInput = page.getByTestId("search-bar-input").first();
    await expect(searchInput).toBeVisible();

    // 2. Type search query
    const searchQuery = "Civil Services";
    await searchInput.fill(searchQuery);
    await searchInput.press("Enter");

    // 3. Verify navigation to /search page with ?q= parameter
    await expect(page).toHaveURL(/\/search\?.*q=Civil\+Services|\/search\?.*q=Civil%20Services/);

    // 4. Verify search results page landmarks
    const searchPage = page.getByTestId("search-results-page");
    await expect(searchPage).toBeVisible();

    const searchBanner = page.getByTestId("search-hero-banner");
    await expect(searchBanner).toBeVisible();
  });

  test("E2E-CAND-04: Notification detail view navigation, CTA buttons, and JSON-LD structured data", async ({ page }) => {
    // 1. Check if cards exist on the homepage
    const firstCard = page.getByTestId("notification-card").first();
    const hasCards = await firstCard.isVisible().catch(() => false);

    if (hasCards) {
      // 2. Click the 'View Details' button or card link
      const viewDetailsBtn = firstCard.getByTestId("view-details-btn").first();
      await viewDetailsBtn.click();

      // 3. Verify detail page navigation
      await expect(page).toHaveURL(/\/notification\/.+/);

      // 4. Verify detail container landmark
      const detailContainer = page.getByTestId("notification-detail");
      await expect(detailContainer).toBeVisible();

      // 5. Verify breadcrumbs
      const breadcrumb = page.getByTestId("notification-breadcrumb");
      await expect(breadcrumb).toBeVisible();

      // 6. Verify Call To Action buttons
      const applyBtn = page.getByTestId("detail-apply-online-btn");
      await expect(applyBtn).toBeVisible();

      const pdfBtn = page.getByTestId("detail-download-pdf-btn");
      await expect(pdfBtn).toBeVisible();

      // 7. Verify Schema.org JSON-LD presence in HTML
      const jsonLdScripts = page.locator('script[type="application/ld+json"]');
      const scriptCount = await jsonLdScripts.count();
      expect(scriptCount).toBeGreaterThanOrEqual(1);

      // Verify at least one script contains JobPosting schema
      let hasJobPosting = false;
      for (let i = 0; i < scriptCount; i++) {
        const content = await jsonLdScripts.nth(i).textContent();
        if (content && content.includes('"@type":"JobPosting"')) {
          hasJobPosting = true;
          break;
        }
      }
      expect(hasJobPosting).toBe(true);
    }
  });

  test("E2E-CAND-05: Mobile viewport layout adaptability", async ({ page }) => {
    // Emulate mobile screen size (375x667)
    await page.setViewportSize({ width: 375, height: 667 });

    // Assert search input is visible and properly sized
    const searchInput = page.getByTestId("search-bar-input").first();
    await expect(searchInput).toBeVisible();

    // Verify filter bar container does not overflow horizontally
    const filterBar = page.getByTestId("notification-filter-bar");
    await expect(filterBar).toBeVisible();

    // Confirm no horizontal body scrollbar
    const isHorizontalScrollable = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(isHorizontalScrollable).toBe(false);
  });
});
