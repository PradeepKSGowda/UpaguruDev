/**
 * @file vitest.setup.ts
 * @module VitestSetup
 * @description Global test setup and environment initialization for Vitest unit/integration tests.
 * Establishes safe fallback environment variables, mocks Next.js navigation primitives,
 * and clears global mocks between test runs.
 * 
 * Task ID: TASK-09010101 (Subtask: SUB-0901010101)
 * Architecture Reference: ADR-001 (Frontend), ADR-002 (Database), ADR-010 (Caching)
 */

import { beforeAll, afterEach, vi } from "vitest";

beforeAll(() => {
  // 1. Establish deterministic environment variables for test execution
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://mock-test-project.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "mock-anon-key-for-vitest-testing-12345";
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "mock-service-role-key-for-vitest-testing-67890";
  process.env.UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || "https://mock-redis.upstash.io";
  process.env.UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "mock-redis-token";
  process.env.NEXT_PUBLIC_APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  // 2. Mock window.matchMedia for jsdom compatibility
  if (typeof window !== "undefined") {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
});

afterEach(() => {
  vi.clearAllMocks();
});
