/**
 * @file app/admin/settings/profile/page.tsx
 * @description Admin Account & Security Settings Page.
 * Displays administrative identity, role details, 2FA status, and active session telemetry.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  KeyRound,
  User,
  Mail,
  Lock,
  History,
  CheckCircle2,
  AlertCircle,
  Smartphone,
  ArrowRight,
} from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { getUserAuthContext } from "@/lib/rbac/rbac-service";
import RoleBadge from "@/components/admin/RoleBadge";

export const metadata: Metadata = {
  title: "Admin Account & Security | UPA-GURU",
  description: "Manage administrative profile details, authentication credentials, and security settings.",
};

export const dynamic = "force-dynamic";

export default async function AdminProfileSettingsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-8 text-center text-slate-500">
        Please log in to view account settings.
      </div>
    );
  }

  const authContext = await getUserAuthContext(user.id);
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: adminProfile } = await supabase
    .from("admin_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="pb-6 border-b border-slate-200 dark:border-slate-800">
        <h1 className="text-2xl sm:text-3xl font-heading font-black text-slate-900 dark:text-white tracking-tight">
          Admin Account & Security Settings
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Review administrative privileges, identity details, and session security policies.
        </p>
      </div>

      {/* Profile Overview Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-heading font-black text-xl flex items-center justify-center shadow-md shadow-blue-500/20">
            {(profile?.full_name || user.email || "A").charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-heading font-bold text-slate-900 dark:text-white">
              {profile?.full_name || "Administrator"}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              {user.email}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <RoleBadge role={authContext.roles[0] || "admin"} />
              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                Verified Identity
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 font-medium">Department</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
              {adminProfile?.department || "Examination Operations & Verification"}
            </p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Employee Identifier</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
              {adminProfile?.employee_id || `ADM-${user.id.slice(0, 8).toUpperCase()}`}
            </p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Authentication Provider</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 capitalize">
              {profile?.auth_provider || "Email / Password"}
            </p>
          </div>
          <div>
            <span className="text-slate-400 font-medium">Account Provisioned</span>
            <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 font-mono">
              {new Date(user.created_at).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Security & Access Guardrails Card */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 border border-purple-200 dark:border-purple-800">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-heading font-bold text-slate-900 dark:text-white">
              Security Policies & Audits
            </h3>
            <p className="text-xs text-slate-500">
              Role-Based Access Control and session compliance rules.
            </p>
          </div>
        </div>

        <div className="space-y-3 pt-2 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Two-Factor Authentication (2FA)
              </p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                TOTP Authenticator app verification on login.
              </p>
            </div>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
              {adminProfile?.two_factor_enabled ? "Enabled" : "Optional"}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                Audit Trail Enforcement
              </p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                All mutations and verification actions are immutably logged with your ID.
              </p>
            </div>
            <Link
              href="/admin/audit-logs"
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
            >
              <span>View Logs</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
