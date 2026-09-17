"use client";

/**
 * @file components/admin/AdminHeader.tsx
 * @description Administrative portal top header displaying mobile drawer toggle, current user identity,
 * role badge (Admin/Super Admin), and sign-out action redirecting to /auth/login.
 * 
 * Task ID: TASK-03010101 (Subtask: SUB-0301010102)
 * Architecture Reference: ADR-001 (Frontend Architecture), ADR-003 (RBAC)
 */

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, Loader2, Shield } from "lucide-react";
import { createBrowserClient } from "../../lib/supabase/client";

export interface AdminUserInfo {
  id?: string;
  email: string;
  fullName?: string | null;
  role: string;
  avatarUrl?: string | null;
}

export interface AdminHeaderProps {
  /** Authenticated administrator identity */
  user: AdminUserInfo;
  /** Callback fired to toggle the mobile sidebar drawer */
  onToggleSidebar: () => void;
}

export default function AdminHeader({ user, onToggleSidebar }: AdminHeaderProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
      router.push("/auth/login");
      router.refresh();
    } catch (err) {
      console.error("[AdminHeader] Logout failed:", err);
      setIsLoggingOut(false);
    }
  };

  const displayName = user.fullName || (user.email ? user.email.split("@")[0] : "Admin") || "Admin";
  const isSuperAdmin = user.role === "super_admin";

  return (
    <header
      id="admin-header"
      className="sticky top-0 z-20 h-16 w-full bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition-colors"
    >
      <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Left Section: Mobile Menu Toggle & Title */}
        <div className="flex items-center gap-3">
          <button
            id="admin-sidebar-toggle-btn"
            type="button"
            onClick={onToggleSidebar}
            className="lg:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
            aria-label="Open Sidebar Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="hidden sm:flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Shield className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-slate-900 dark:text-white">HITL Management Console</span>
          </div>
        </div>

        {/* Right Section: User Profile & Logout */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* User Identity Details */}
          <div
            id="admin-user-profile-badge"
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80"
          >
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={displayName}
                className="w-7 h-7 rounded-full object-cover border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs uppercase">
                {displayName.charAt(0)}
              </div>
            )}

            <div className="flex flex-col text-left leading-none">
              <span className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[120px] sm:max-w-[180px]">
                {displayName}
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[120px] sm:max-w-[180px] mt-0.5">
                {user.email}
              </span>
            </div>

            {/* Role Badge */}
            <span
              id="admin-user-role-tag"
              className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md shrink-0 ${
                isSuperAdmin
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/60"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60"
              }`}
            >
              {isSuperAdmin ? "Super Admin" : "Admin"}
            </span>
          </div>

          {/* Logout Button */}
          <button
            id="admin-logout-btn"
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-900/50 transition focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            title="Sign out of Admin Portal"
            aria-label="Sign out of Admin Portal"
          >
            {isLoggingOut ? (
              <Loader2 className="w-4 h-4 animate-spin text-red-600 dark:text-red-400" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            <span className="hidden sm:inline text-xs font-semibold">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
