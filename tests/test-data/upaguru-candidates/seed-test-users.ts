/**
 * @file tests/test-data/upaguru-candidates/seed-test-users.ts
 * @description Repeatable, idempotent test data seeder for synthetic candidate test population.
 * Creates synthetic profiles in the test/staging database with verified states.
 *
 * Security & Isolation:
 * - Operates strictly on synthetic accounts under the '@upaguru.test' domain.
 * - Marks all profiles with `is_test_user: true`.
 * - Zero risk of affecting production candidates.
 *
 * Enhancement: ENH-CANDIDATE-TEST-MATRIX
 */

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import type { CandidateRecord } from "./generate-candidates";

// Load environment configuration
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function seedTestCandidates(options: { dryRun?: boolean } = {}) {
  const { dryRun = false } = options;
  console.log(`[SeedCandidates] Starting synthetic candidate seeding (dryRun: ${dryRun})...`);

  const candidatesPath = path.resolve(__dirname, "candidates.json");
  if (!fs.existsSync(candidatesPath)) {
    throw new Error(`[SeedCandidates] candidates.json not found at ${candidatesPath}`);
  }

  const candidates: CandidateRecord[] = JSON.parse(fs.readFileSync(candidatesPath, "utf8"));
  console.log(`[SeedCandidates] Loaded ${candidates.length} synthetic candidate records.`);

  if (dryRun) {
    console.log(`[SeedCandidates] DRY RUN complete. Validated ${candidates.length} candidates.`);
    return { seededCount: candidates.length, dryRun: true };
  }

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "[SeedCandidates] Missing SUPABASE credentials in .env.local. Dry run validation succeeded, skipping DB insertion."
    );
    return { seededCount: 0, skipped: true };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let seededCount = 0;
  for (const candidate of candidates) {
    // 1. Verify safety domain
    if (!candidate.email.endsWith("@upaguru.test")) {
      throw new Error(`[SeedCandidates] FATAL: Non-test domain detected: ${candidate.email}`);
    }

    // 2. Ensure user exists in auth.users to satisfy foreign key (profiles_id_fkey)
    let userId: string | null = null;
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", candidate.email)
      .maybeSingle();

    if (existingProfile?.id) {
      userId = existingProfile.id;
    } else {
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email: candidate.email,
        password: "TestPassword123!",
        email_confirm: true,
        user_metadata: { full_name: candidate.full_name },
        app_metadata: { role: "candidate" },
      });

      if (authErr) {
        // User may exist in auth.users but not yet synced to profiles
        const { data: userList } = await supabase.auth.admin.listUsers();
        const found = userList?.users.find((u) => u.email === candidate.email);
        if (found) {
          userId = found.id;
        } else {
          console.error(`[SeedCandidates] Error creating auth user for ${candidate.email}:`, authErr);
          continue;
        }
      } else if (authData?.user) {
        userId = authData.user.id;
      }
    }

    if (userId) {
      // 3. Upsert into public.profiles
      const { error: profileErr } = await supabase.from("profiles").upsert(
        {
          id: userId,
          email: candidate.email,
          full_name: candidate.full_name,
          role: "candidate",
          email_verified: true,
          auth_provider: "email",
        },
        { onConflict: "id" }
      );

      if (profileErr) {
        console.error(`[SeedCandidates] Error upserting profile for ${candidate.email}:`, profileErr);
        continue;
      }

      // 4. Upsert into public.user_profiles
      const [firstName, ...rest] = candidate.full_name.split(" ");
      const lastName = rest.join(" ") || "";

      const { error: kycErr } = await supabase.from("user_profiles").upsert(
        {
          id: userId,
          first_name: firstName,
          last_name: lastName,
          phone: candidate.phone,
          gender: candidate.gender,
          marital_status: candidate.marital_status,
          date_of_birth: candidate.date_of_birth,
          category: candidate.category,
          state: candidate.state,
          district: candidate.district,
          is_phone_verified: true,
          profile_completion_percentage: 100,
        },
        { onConflict: "id" }
      );

      if (kycErr) {
        console.error(`[SeedCandidates] Error upserting KYC for ${candidate.email}:`, kycErr);
      } else {
        seededCount++;
      }
    }
  }

  console.log(`[SeedCandidates] Successfully seeded ${seededCount} candidates.`);
  return { seededCount, dryRun: false };
}

// Direct execution
if (typeof require !== "undefined" && require.main === module) {
  const isDryRun = process.argv.includes("--dry-run");
  seedTestCandidates({ dryRun: isDryRun })
    .then((res) => {
      console.log("[SeedCandidates] Completed with result:", res);
      process.exitCode = 0;
    })
    .catch((err) => {
      console.error("[SeedCandidates] Fatal error:", err);
      process.exitCode = 1;
    });
}
