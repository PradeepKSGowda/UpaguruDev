import { defineConfig, devices } from "@playwright/test";

/**
 * @file playwright.config.ts
 * @description Playwright End-to-End test configuration for UPA-GURU.
 * 
 * Task ID: TASK-09020101 (Subtask: SUB-0902010101)
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-013 (Security), AGENTS.md (Rule 2: Testing Safety Guardrails)
 */

const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  /* Maximum time one test can run for */
  timeout: 60 * 1000,
  expect: {
    /* Maximum time expect() should wait for the condition to be met */
    timeout: 10 * 1000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Limit workers to 2 locally to avoid saturating single-threaded Next.js dev server */
  workers: process.env.CI ? 1 : 2,
  /* Reporter to use */
  reporter: [
    ["html", { outputFolder: "playwright-report", open: "never" }],
    ["list"],
  ],
  /* Shared settings for all the projects below */
  use: {
    baseURL: BASE_URL,
    /* Collect trace when retrying the failed test */
    trace: "on-first-retry",
    /* Capture screenshot after test failure */
    screenshot: "only-on-failure",
    /* Record video only on failure */
    video: "retain-on-failure",
    /* Base navigation timeout */
    navigationTimeout: 35 * 1000,
    /* Custom test attributes */
    testIdAttribute: "data-testid",
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
    /* Mobile viewports */
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"] },
    },
  ],

  /* Run local dev server before starting the tests */
  webServer: {
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
