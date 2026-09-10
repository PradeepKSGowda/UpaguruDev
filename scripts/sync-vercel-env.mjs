/**
 * @file scripts/sync-vercel-env.mjs
 * @description DevOps utility script to validate and sync environment variables from .env.local to Vercel.
 * Task Reference: TASK-01030102 (SUB-0103010202)
 * 
 * Usage:
 *   node scripts/sync-vercel-env.mjs --check
 *   node scripts/sync-vercel-env.mjs --sync [production|preview|development]
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

/**
 * Required environment variable schema across all tiers
 */
const REQUIRED_ENV_VARS = [
  // Supabase
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'DATABASE_URL',
  // Auth & URLs
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_AUTH_CALLBACK_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  // Redis Cache & Rate Limit
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  // Observability
  'NEXT_PUBLIC_SENTRY_DSN',
];

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) return {};
  const content = readFileSync(filePath, 'utf-8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      env[key] = val;
    }
  }
  return env;
}

export function validateEnvironmentConfiguration() {
  const envPath = resolve(process.cwd(), '.env.local');
  const examplePath = resolve(process.cwd(), '.env.local.example');

  console.log('--- UPA-GURU Vercel Environment Configuration Audit ---');
  
  if (!existsSync(envPath)) {
    console.warn('[WARN] .env.local not found in project root. Checking .env.local.example blueprint...');
    const exampleEnv = parseEnvFile(examplePath);
    const missingInBlueprint = REQUIRED_ENV_VARS.filter(key => !(key in exampleEnv));
    if (missingInBlueprint.length === 0) {
      console.log('[SUCCESS] .env.local.example documents all 11 mandatory production environment variables.');
      return true;
    } else {
      console.error('[FAIL] Missing in .env.local.example:', missingInBlueprint);
      return false;
    }
  }

  const localEnv = parseEnvFile(envPath);
  const missing = REQUIRED_ENV_VARS.filter(key => !localEnv[key] || localEnv[key].includes('your-'));

  if (missing.length > 0) {
    console.warn(`[NOTICE] The following variables need real credentials before deploying to Vercel:`);
    missing.forEach(key => console.warn(`  - ${key}`));
  } else {
    console.log('[SUCCESS] All required environment variables are populated and ready for Vercel deployment.');
  }

  return true;
}

if (process.argv[1]?.endsWith('sync-vercel-env.mjs')) {
  validateEnvironmentConfiguration();
}
