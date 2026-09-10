/**
 * @file lib/redis.ts
 * @module RedisClient
 * @description Centralized Upstash Redis HTTP REST client for distributed rate limiting,
 * cache invalidation triggers, and crawler deduplication locks.
 * 
 * Task ID: TASK-01040101 (Subtask: SUB-0104010101)
 * Architecture Reference: ADR-010 (Multi-Layer Caching), ADR-013 (Application Security)
 * 
 * Complies with:
 * - Edge runtime compatibility: Uses HTTP REST protocol via @upstash/redis (no TCP socket overhead)
 * - Safe environment variable retrieval via process.env
 * - Graceful fallback in local development when credentials are not configured or placeholder
 */

import { Redis } from "@upstash/redis";

/**
 * Interface representing the result of a Redis connectivity health check.
 */
export interface RedisHealthResult {
  /** Indicates whether the Redis instance responded successfully */
  connected: boolean;
  /** Latency in milliseconds for the ping operation, or null if failed */
  latencyMs: number | null;
  /** Ping response message (e.g. "PONG") */
  message: string;
  /** Error message if connectivity failed */
  error?: string;
}

/**
 * Validates whether the Upstash Redis environment variables are properly configured
 * with non-placeholder values.
 */
export function isRedisConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return false;
  }

  // Check for template/placeholder strings
  if (url.includes("your-upstash-instance") || token.includes("your-upstash-rest-token")) {
    return false;
  }

  return true;
}

/**
 * Singleton instance of the Upstash Redis REST client.
 * Returns null if running in development without configured credentials.
 */
function createRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token || !isRedisConfigured()) {
    return null;
  }

  return new Redis({
    url,
    token,
    retry: {
      retries: 3,
      backoff: (retryCount) => Math.exp(retryCount) * 50,
    },
  });
}

/**
 * Exported Redis client instance.
 * When unconfigured in local development, this evaluates to null and callers can fallback
 * to in-memory or passthrough behavior.
 */
export const redis: Redis | null = createRedisClient();

/**
 * Executes a PING health check against the configured Upstash Redis instance via REST API.
 * 
 * @returns {Promise<RedisHealthResult>} Health check status and roundtrip latency
 */
export async function pingRedis(): Promise<RedisHealthResult> {
  const startTime = Date.now();

  if (!isRedisConfigured() || !redis) {
    return {
      connected: false,
      latencyMs: null,
      message: "UNCONFIGURED",
      error: "UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is missing or contains placeholder values.",
    };
  }

  try {
    const response = await redis.ping();
    const latencyMs = Date.now() - startTime;

    return {
      connected: response === "PONG",
      latencyMs,
      message: response,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return {
      connected: false,
      latencyMs: Date.now() - startTime,
      message: "ERROR",
      error: errorMessage,
    };
  }
}

export default redis;
