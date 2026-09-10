/**
 * @file scripts/verify-redis.ts
 * @description Standalone verification utility for Upstash Redis connectivity.
 * Tests REST ping response and reports latency.
 * 
 * Task ID: TASK-01040101 (Subtask: SUB-0104010101)
 * Usage: npx tsx scripts/verify-redis.ts
 */

import { pingRedis, isRedisConfigured } from "../lib/redis";

async function main() {
  console.log("=================================================");
  console.log("UPA-GURU Upstash Redis Health & Connectivity Check");
  console.log("=================================================");

  const configured = isRedisConfigured();
  console.log(`- Configuration Status: ${configured ? "CONFIGURED" : "UNCONFIGURED / PLACEHOLDER"}`);
  console.log(`- REST URL: ${process.env.UPSTASH_REDIS_REST_URL || "(not set)"}`);

  if (!configured) {
    console.log("\n[WARNING] Upstash Redis credentials are using placeholder values in .env.local.");
    console.log("To connect to a live Upstash instance:");
    console.log("1. Sign in to https://console.upstash.com");
    console.log("2. Create a Serverless Redis database (Region: ap-south-1 Mumbai or Global)");
    console.log("3. Copy UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN into .env.local and Vercel");
    process.exit(0);
  }

  console.log("\nExecuting REST PING to Upstash Redis...");
  const result = await pingRedis();

  if (result.connected) {
    console.log(`[SUCCESS] Connected to Upstash Redis!`);
    console.log(`- Response: ${result.message}`);
    console.log(`- Roundtrip Latency: ${result.latencyMs}ms`);
  } else {
    console.error(`[ERROR] Failed to connect to Upstash Redis: ${result.error}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error during Redis verification:", err);
  process.exit(1);
});
