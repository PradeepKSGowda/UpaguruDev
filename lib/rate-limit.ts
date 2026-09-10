/**
 * @file lib/rate-limit.ts
 * @module RateLimiter
 * @description Sliding window distributed rate limiter using @upstash/ratelimit and Redis.
 * Protects public API endpoints (/api/v1/*) from scraper abuse, brute-force requests, and DDoS attacks.
 * 
 * Task ID: TASK-01040102 (Subtasks: SUB-0104010201, SUB-0104010202)
 * Architecture Reference: ADR-010 (Caching & Rate Limiting), ADR-013 (Security), ADR-014 (API Design)
 * 
 * Complies with:
 * - Sliding window algorithm: 60 requests per 60-second window per IP
 * - RFC 7807 Problem Details for HTTP APIs (application/problem+json)
 * - Standard HTTP headers: Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
 * - Admin bypass: Excludes authenticated platform administrators from rate restrictions
 * - Local offline resilience: In-memory sliding window fallback when Redis credentials are not configured
 */

import { Ratelimit } from "@upstash/ratelimit";
import { redis, isRedisConfigured } from "./redis";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Result returned by the rate limit evaluation.
 */
export interface RateLimitResult {
  /** Whether the request is permitted to proceed */
  success: boolean;
  /** Maximum number of allowed requests within the configured window (60) */
  limit: number;
  /** Number of remaining requests permitted in the current window */
  remaining: number;
  /** Unix timestamp in milliseconds when the rate limit window resets */
  reset: number;
}

/**
 * Local in-memory sliding window store for offline development when Upstash Redis
 * credentials are not set or are using template values.
 */
class InMemorySlidingWindowLimiter {
  private requests: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(maxRequests = 60, windowSeconds = 60) {
    this.maxRequests = maxRequests;
    this.windowMs = windowSeconds * 1000;
  }

  public limit(identifier: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = this.requests.get(identifier) || [];
    const validTimestamps = timestamps.filter((t) => t > windowStart);

    if (validTimestamps.length >= this.maxRequests) {
      const earliest = validTimestamps[0] || now;
      const reset = earliest + this.windowMs;
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        reset,
      };
    }

    validTimestamps.push(now);
    this.requests.set(identifier, validTimestamps);

    return {
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - validTimestamps.length,
      reset: now + this.windowMs,
    };
  }
}

const localFallbackLimiter = new InMemorySlidingWindowLimiter(60, 60);

/**
 * Primary Upstash Redis sliding window rate limiter instance.
 * Configured for 60 requests per 60-second window, keyed with 'upaguru:ratelimit:api'.
 */
const upstashRateLimiter = isRedisConfigured() && redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "60 s"),
      analytics: true,
      prefix: "upaguru:ratelimit:api",
    })
  : null;

/**
 * Evaluates the rate limit for a given unique identifier (e.g. Client IP address).
 * 
 * @param {string} identifier Unique client key (IP or user ID)
 * @returns {Promise<RateLimitResult>} Rate limit decision and metadata
 */
export async function rateLimit(identifier: string): Promise<RateLimitResult> {
  if (upstashRateLimiter) {
    try {
      const result = await upstashRateLimiter.limit(identifier);
      return {
        success: result.success,
        limit: result.limit,
        remaining: result.remaining,
        reset: result.reset,
      };
    } catch (error) {
      console.warn("[RateLimiter] Upstash Redis call failed, falling back to local window:", error);
      return localFallbackLimiter.limit(identifier);
    }
  }

  // Graceful fallback for local development
  return localFallbackLimiter.limit(identifier);
}

/**
 * Extracts client IP from standard proxy and edge headers.
 * 
 * @param {NextRequest} request Incoming Next.js HTTP request
 * @returns {string} Detected client IP or fallback localhost address
 */
export function getClientIp(request: NextRequest): string {
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0];
    if (firstIp) {
      return firstIp.trim();
    }
  }

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) {
    return xRealIp.trim();
  }

  return "127.0.0.1";
}

/**
 * Checks whether the request originates from an authenticated administrator.
 * Admin requests bypass public rate limits to guarantee unobstructed HITL operations.
 * 
 * @param {NextRequest} request Incoming Next.js HTTP request
 * @returns {boolean} True if the request has valid administrative credentials
 */
export function isAdminRequest(request: NextRequest): boolean {
  const roleHeader = request.headers.get("x-user-role");
  if (roleHeader === "admin" || roleHeader === "super_admin") {
    return true;
  }
  return false;
}

/**
 * High-order rate limit guard designed for Next.js App Router route handlers.
 * 
 * @param {NextRequest} request Incoming request to evaluate
 * @returns {Promise<NextResponse | null>} Returns 429 response if limit exceeded, or null if allowed
 */
export async function checkRateLimit(request: NextRequest): Promise<NextResponse | null> {
  // 1. Bypass rate limiting for administrative callers
  if (isAdminRequest(request)) {
    return null;
  }

  const ip = getClientIp(request);
  const result = await rateLimit(ip);

  // 2. If under limit, permit execution (caller proceeds)
  if (result.success) {
    return null;
  }

  // 3. Compute retry duration in seconds
  const now = Date.now();
  const retryAfterSeconds = Math.max(1, Math.ceil((result.reset - now) / 1000));

  // 4. Return RFC 7807 formatted Problem Details response
  const problemDetails = {
    type: "https://upaguru.in/errors/rate-limit-exceeded",
    title: "Too Many Requests",
    status: 429,
    detail: `Rate limit exceeded: Maximum 60 requests per minute allowed. Please retry after ${retryAfterSeconds} seconds.`,
    instance: request.nextUrl.pathname,
    retryAfterSeconds,
  };

  return new NextResponse(JSON.stringify(problemDetails), {
    status: 429,
    headers: {
      "Content-Type": "application/problem+json",
      "Retry-After": retryAfterSeconds.toString(),
      "X-RateLimit-Limit": result.limit.toString(),
      "X-RateLimit-Remaining": result.remaining.toString(),
      "X-RateLimit-Reset": result.reset.toString(),
    },
  });
}
