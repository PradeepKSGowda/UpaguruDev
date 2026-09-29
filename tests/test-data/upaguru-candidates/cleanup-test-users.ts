/**
 * @file tests/test-data/upaguru-candidates/cleanup-test-users.ts
 * @description Safe teardown script for synthetic candidate test population.
 *
 * Mandatory Safety Guardrails:
 * - Scoped STRICTLY and EXCLUSIVELY to users with email ending in '@upaguru.test'.
 * - Aborts with fatal exception if any user does not match the synthetic domain.
 * - Real users and administrator accounts can NEVER be deleted.
 *
 * Enhancement: ENH-CANDIDATE-TEST-MATRIX
 */

import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function cleanupTestCandidates(options: { dryRun?: boolean } = {}) {
  const { dryRun = false } = options;
  console.log(`[CleanupCandidates] Starting test candidate cleanup (dryRun: ${dryRun})...`);

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("[CleanupCandidates] Missing Supabase credentials in .env.local. Skipping DB cleanup.");
    return { cleanedCount: 0, skipped: true };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // Query only synthetic test users
  const { data: testProfiles, error: fetchErr } = await supabase
    .from("profiles")
    .select("id, email")
    .ilike("email", "%@upaguru.test");

  if (fetchErr) {
    throw new Error(`[CleanupCandidates] Error fetching test profiles: ${fetchErr.message}`);
  }

  if (!testProfiles || testProfiles.length === 0) {
    console.log("[CleanupCandidates] No synthetic candidates found matching '@upaguru.test'. Clean state.");
    return { cleanedCount: 0, dryRun };
  }

  // Double-verify EVERY profile before deletion
  for (const p of testProfiles) {
    if (!p.email.endsWith("@upaguru.test")) {
      throw new Error(`[CleanupCandidates] FATAL SAFETY VIOLATION: Non-test email targeted: ${p.email}. Aborting!`);
    }
  }

  console.log(`[CleanupCandidates] Identified ${testProfiles.length} synthetic candidate accounts to remove.`);

  if (dryRun) {
    console.log(`[CleanupCandidates] DRY RUN: Would delete ${testProfiles.length} test accounts.`);
    return { cleanedCount: testProfiles.length, dryRun: true };
  }

  const testIds = testProfiles.map((p) => p.id);

  // 1. Delete from user_profiles first (foreign key cascade)
  const { error: kycDelErr } = await supabase.from("user_profiles").delete().in("id", testIds);
  if (kycDelErr) {
    console.error("[CleanupCandidates] Error cleaning user_profiles:", kycDelErr);
  }

  // 2. Delete from profiles
  const { error: profDelErr } = await supabase.from("profiles").delete().in("id", testIds);
  if (profDelErr) {
    console.error("[CleanupCandidates] Error cleaning profiles:", profDelErr);
    throw profDelErr;
  }

  console.log(`[CleanupCandidates] Successfully removed ${testProfiles.length} synthetic test accounts.`);
  return { cleanedCount: testProfiles.length, dryRun: false };
}

// Direct execution
if (typeof require !== "undefined" && require.main === module) {
  const isDryRun = process.argv.includes("--dry-run");
  cleanupTestCandidates({ dryRun: isDryRun })
    .then((res) => {
      console.log("[CleanupCandidates] Completed with result:", res);
      process.exitCode = 0;
    })
    .catch((err) => {
      console.error("[CleanupCandidates] Fatal error:", err);
      process.exitCode = 1;
    });
}
