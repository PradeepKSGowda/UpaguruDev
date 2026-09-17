"use client";

/**
 * @file components/admin/AdminLayoutShell.tsx
 * @description Client-side layout shell orchestrating AdminSidebar drawer state,
 * AdminHeader, and responsive main viewport area.
 * 
 * Task ID: TASK-03010101
 * Architecture Reference: ADR-001 (Frontend Architecture)
 */

import React, { useState } from "react";
import AdminSidebar from "./AdminSidebar";
import AdminHeader, { type AdminUserInfo } from "./AdminHeader";

export interface AdminLayoutShellProps {
  /** Authenticated administrative user identity */
  user: AdminUserInfo;
  /** Nested admin page contents */
  children: React.ReactNode;
}

export default function AdminLayoutShell({ user, children }: AdminLayoutShellProps) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div id="admin-layout" className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col text-slate-900 dark:text-slate-100">
      {/* Sidebar Navigation */}
      <AdminSidebar
        isMobileOpen={isMobileSidebarOpen}
        onMobileClose={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Wrapper (offset by desktop sidebar width 256px / lg:pl-64) */}
      <div className="flex-1 flex flex-col lg:pl-64 transition-all">
        {/* Sticky Header */}
        <AdminHeader
          user={user}
          onToggleSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
        />

        {/* Page Content Slot */}
        <main id="admin-main-area" className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
