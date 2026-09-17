/**
 * @file app/admin/layout.tsx
 * @description Root layout for administrative portal routes (/admin/*).
 * Enforces strict server-side Role-Based Access Control (RBAC), verifies administrative
 * identity against Supabase Auth and Profiles table, and renders the persistent AdminLayoutShell.
 * 
 * Task ID: TASK-03010101
 * Architecture Reference: ADR-001 (Frontend Architecture), ADR-003 (RBAC), ADR-013 (Security)
 */

import React from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createServerClient } from "../../lib/supabase/server";
import { AdminLayoutShell } from "../../components/admin";
import type { Database } from "../../types/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const metadata: Metadata = {
  title: {
    template: "%s | Admin Portal - UPA-GURU",
    default: "Admin Verification Portal | UPA-GURU",
  },
  description: "UPA-GURU Administrative Human-In-The-Loop (HITL) Verification Portal & Audit System.",
  robots: {
    index: false,
    follow: false,
  },
};

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AUTHORIZED_ROLES = new Set(["admin", "super_admin"]);

export default async function AdminLayout({ children }: AdminLayoutProps) {
  // 1. Initialize server-side Supabase client with Next.js 15 awaited cookies()
  const supabase = await createServerClient();

  // 2. Validate cryptographic authentication session directly with Supabase Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?returnTo=/admin");
  }

  // 3. Fetch authoritative profile record to verify role assignment
  const { data: profile } = (await supabase
    .from("profiles")
    .select("id, role, full_name, avatar_url, email")
    .eq("id", user.id)
    .single()) as unknown as { data: Pick<ProfileRow, "id" | "role" | "full_name" | "avatar_url" | "email"> | null };

  // Authoritative role resolution: profile table -> user JWT app_metadata -> default candidate
  const role = profile?.role || (user.app_metadata?.role as string) || "candidate";

  // 4. Enforce strict RBAC defense-in-depth guardrail
  if (!AUTHORIZED_ROLES.has(role)) {
    redirect("/");
  }

  // 5. Render interactive AdminLayoutShell with verified user identity
  return (
    <AdminLayoutShell
      user={{
        id: user.id,
        email: profile?.email || user.email || "admin@upaguru.in",
        fullName: profile?.full_name || null,
        role,
        avatarUrl: profile?.avatar_url || null,
      }}
    >
      {children}
    </AdminLayoutShell>
  );
}
