"use client";

/**
 * @file components/admin/AdminSidebar.tsx
 * @description Admin navigation sidebar supporting desktop fixed view and mobile slide-over drawer
 * with active route highlighting and quick access to all verification portal modules.
 * 
 * Task ID: TASK-03010101 (Subtask: SUB-0301010101)
 * Architecture Reference: ADR-001 (Frontend Architecture), ADR-003 (RBAC)
 */

import React, { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardCheck,
  GraduationCap,
  Bell,
  ShieldAlert,
  ExternalLink,
  X,
  ShieldCheck,
} from "lucide-react";

export interface AdminSidebarProps {
  /** Controls mobile drawer visibility */
  isMobileOpen: boolean;
  /** Callback fired to close the mobile drawer */
  onMobileClose: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  id: string;
  exactMatch?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  {
    name: "Dashboard",
    href: "/admin",
    icon: LayoutDashboard,
    id: "admin-nav-dashboard",
    exactMatch: true,
  },
  {
    name: "Draft Queue",
    href: "/admin/drafts",
    icon: ClipboardCheck,
    id: "admin-nav-drafts",
  },
  {
    name: "Exams Master",
    href: "/admin/exams",
    icon: GraduationCap,
    id: "admin-nav-exams",
  },
  {
    name: "Notifications",
    href: "/admin/notifications",
    icon: Bell,
    id: "admin-nav-notifications",
  },
  {
    name: "Audit Logs",
    href: "/admin/audit-logs",
    icon: ShieldAlert,
    id: "admin-nav-audit-logs",
  },
];

export default function AdminSidebar({ isMobileOpen, onMobileClose }: AdminSidebarProps) {
  const pathname = usePathname();

  // Close drawer on escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isMobileOpen) {
        onMobileClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen, onMobileClose]);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  const isLinkActive = (item: NavItem) => {
    if (item.exactMatch) {
      return pathname === item.href;
    }
    return pathname.startsWith(item.href);
  };

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800">
        <Link
          id="admin-sidebar-brand-link"
          href="/admin"
          onClick={onMobileClose}
          className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-lg"
        >
          <div className="h-9 w-9 rounded-xl bg-blue-600 text-white font-heading font-black text-lg flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
            UG
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-heading font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                UPA-GURU
              </span>
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                HITL
              </span>
            </div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-none">
              Admin Portal
            </span>
          </div>
        </Link>

        {/* Mobile Close Button */}
        <button
          id="admin-sidebar-mobile-close-btn"
          type="button"
          onClick={onMobileClose}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-blue-600"
          aria-label="Close Admin Sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Section */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Operations & Verification
          </div>
          <nav id="admin-sidebar-nav-list" className="space-y-1.5" aria-label="Admin Navigation">
            {NAV_ITEMS.map((item) => {
              const active = isLinkActive(item);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  id={item.id}
                  href={item.href}
                  onClick={onMobileClose}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold shadow-sm shadow-blue-500/5"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Icon
                    className={`w-5 h-5 shrink-0 transition-colors ${
                      active ? "text-blue-600 dark:text-blue-400" : "text-slate-400 dark:text-slate-500"
                    }`}
                  />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* External / Quick Links */}
        <div>
          <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Quick Actions
          </div>
          <div className="space-y-1.5">
            <Link
              id="admin-nav-live-portal"
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white transition group"
            >
              <div className="flex items-center gap-3">
                <ExternalLink className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                <span>Live Candidate Portal</span>
              </div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 group-hover:text-slate-500">
                New Tab
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Security Footer Notice */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/60 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 text-xs">
          <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="leading-tight">
            <p className="font-semibold">RLS & RBAC Active</p>
            <p className="text-[11px] opacity-80">Audit logging strictly enforced</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        id="admin-sidebar"
        className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 z-30 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800"
      >
        {navContent}
      </aside>

      {/* Mobile Slide-Over Overlay & Drawer */}
      {isMobileOpen && (
        <div
          id="admin-sidebar-mobile-overlay"
          className="lg:hidden fixed inset-0 z-50 flex"
          role="dialog"
          aria-modal="true"
          aria-label="Mobile Navigation"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={onMobileClose}
            aria-hidden="true"
          />

          {/* Drawer Content */}
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-white dark:bg-slate-900 shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}
