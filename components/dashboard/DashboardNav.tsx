"use client";

/**
 * @file components/dashboard/DashboardNav.tsx
 * @description Candidate Personal Workspace navigation tab bar.
 * Provides intuitive, responsive tab switching between Overview, Profile KYC, Bookmarks,
 * Notes, and Application Tracker.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UserCheck,
  Bookmark,
  FileText,
  Milestone,
  BellRing,
} from "lucide-react";

interface NavTab {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
}

const TABS: NavTab[] = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { name: "Profile & KYC", href: "/dashboard/profile", icon: UserCheck },
  { name: "Saved Circulars", href: "/dashboard/bookmarks", icon: Bookmark },
  { name: "Exam Notes", href: "/dashboard/notes", icon: FileText },
  { name: "Application Tracker", href: "/dashboard/tracking", icon: Milestone },
  { name: "Alert Preferences", href: "/preferences", icon: BellRing },
];

export default function DashboardNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-20 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-1 sm:space-x-4 overflow-x-auto py-2 scrollbar-none" aria-label="Tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                  isActive
                    ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-blue-600 dark:text-blue-400" : "text-slate-400"}`} />
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
