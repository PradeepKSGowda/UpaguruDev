/**
 * @file vitest.config.mts
 * @module VitestConfiguration
 * @description Master Vitest test runner configuration for UPA-GURU.
 * Configured with Next.js 15 App Router compatibility, React 19 JSX support,
 * path alias resolution matching tsconfig.json (@/*), and jsdom browser environment.
 * Uses .mts extension for native ESM loading with zero Vite loader warnings.
 * 
 * Task ID: TASK-09010101 (Subtask: SUB-0901010101)
 * Architecture Reference: ADR-001 (Frontend), ADR-014 (API Design), AGENTS.md (Rule 2: Testing Guardrails)
 */

import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "tests/**/*.test.ts",
      "tests/**/*.test.tsx",
      "**/*.spec.ts",
    ],
    exclude: [
      "node_modules",
      ".next",
      "scraper",
      ".agents",
      "dist",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "./coverage",
      exclude: [
        "node_modules/**",
        ".next/**",
        "vitest.config.*",
        "vitest.setup.ts",
        "types/**",
        "**/*.d.ts",
        "exports/**",
        ".agents/**",
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./"),
    },
  },
});
