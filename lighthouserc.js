/**
 * @file lighthouserc.js
 * @description Lighthouse CI configuration for UPA-GURU automated Mobile Performance, SEO,
 * and Core Web Vitals score assertions.
 * 
 * Task ID: TASK-09030101
 * Subtask: SUB-0903010101
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-008 (Programmatic SEO & Web Vitals)
 * Compliance: AGENTS.md Rule 4 (Lighthouse Target: Mobile SEO & Performance >= 95)
 */

module.exports = {
  ci: {
    collect: {
      // Number of runs per URL to ensure statistical median stability
      numberOfRuns: 3,

      // Local web server command to start before collecting metrics
      startServerCommand: "npm run start",
      startServerReadyPattern: "ready on|started server on|Local:",
      startServerReadyTimeout: 60000,

      // Audit critical user journeys and landing routes
      url: [
        "http://localhost:3000/",
        "http://localhost:3000/search?q=Civil+Services",
        "http://localhost:3000/notification/upsc-civil-services-examination-2026",
      ],

      settings: {
        // Enforce mobile viewport emulation per Google Mobile-First Indexing
        formFactor: "mobile",
        screenEmulation: {
          mobile: true,
          width: 390,
          height: 844,
          deviceScaleFactor: 3,
          disabled: false,
        },
        throttlingMethod: "simulate",
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          requestLatencyMs: 562.5,
          downloadThroughputKbps: 1474.56,
          uploadThroughputKbps: 675,
          cpuSlowdownMultiplier: 4,
        },
        // Headless Chromium configuration flags
        chromeFlags: "--no-sandbox --headless --disable-gpu --disable-dev-shm-usage",
        // Skip audits irrelevant to local mock/staging environments
        skipAudits: [
          "is-on-https",
          "uses-http2",
          "canonical",
        ],
      },
    },

    assert: {
      preset: "lighthouse:recommended",
      assertions: {
        // AGENTS.md Rule 4 Target: Mobile Performance >= 95
        "categories:performance": ["error", { minScore: 0.95 }],

        // AGENTS.md Rule 4 Target: Mobile SEO >= 95
        "categories:seo": ["error", { minScore: 0.95 }],

        // Accessibility target: >= 90
        "categories:accessibility": ["warn", { minScore: 0.90 }],

        // Best practices target: >= 90
        "categories:best-practices": ["warn", { minScore: 0.90 }],

        // Core Web Vitals explicit thresholds
        "largest-contentful-paint": ["error", { maxNumericValue: 2500 }],
        "cumulative-layout-shift": ["error", { maxNumericValue: 0.1 }],
        "total-blocking-time": ["error", { maxNumericValue: 200 }],
        "first-contentful-paint": ["error", { maxNumericValue: 1800 }],

        // Structured Data & Metadata checks
        "document-title": "error",
        "meta-description": "error",
        "viewport": "error",
        "robots-txt": "warn",

        // Local development overrides
        "is-on-https": "off",
        "uses-http2": "off",
        "canonical": "off",
        "csp-xss": "off",
      },
    },

    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
      reportFilenamePattern: "%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%",
    },
  },
};
