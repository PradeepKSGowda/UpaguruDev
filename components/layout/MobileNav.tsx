"use client";

/**
 * @file components/layout/MobileNav.tsx
 * @description Slide-out mobile navigation drawer for UPA-GURU with reactive auth session state,
 * Admin Dashboard trigger, user identity badge, and sign-out controls.
 * 
 * Task ID: TASK-02010102 (Subtask: SUB-0201010203)
 * Architecture Reference: ADR-001 (Frontend Architecture)
 */

import React, { useEffect } from "react";
import Link from "next/link";
import { X, Search, Bell, BookOpen, ShieldCheck, ArrowRight, Home, Shield, LogOut } from "lucide-react";

interface AuthUserState {
  email?: string;
  role?: string;
  fullName?: string;
}

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
  user?: AuthUserState | null;
  isAdmin?: boolean;
  onSignOut?: () => void;
}

export default function MobileNav({
  isOpen,
  onClose,
  user,
  isAdmin = false,
  onSignOut,
}: MobileNavProps) {
  // Lock body scrolling when the mobile drawer is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      id="mobile-nav-backdrop"
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 md:hidden"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        id="mobile-nav-drawer"
        className="w-full max-w-xs h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between p-6 overflow-y-auto animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Brand Logo & Close Button */}
        <div>
          <div className="flex items-center justify-between pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                UG
              </div>
              <span className="font-heading font-extrabold text-lg tracking-tight text-slate-900 dark:text-white">
                UPA-GURU
              </span>
            </div>
            <button
              id="nav-mobile-close-btn"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-blue-600"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* User Status Card (when authenticated) */}
          {user && (
            <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[170px]">
                    {user.fullName || (user.email ? user.email.split("@")[0] : "User")}
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[170px]">
                    {user.email}
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                  isAdmin 
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300"
                    : "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300"
                }`}>
                  {isAdmin ? "Admin" : "Candidate"}
                </span>
              </div>

              {/* Admin Console Shortcut in Mobile Drawer */}
              {isAdmin && (
                <Link
                  id="nav-mobile-admin-dashboard-btn"
                  href="/admin"
                  onClick={onClose}
                  className="mt-2.5 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition shadow-sm"
                >
                  <Shield className="h-3.5 w-3.5" />
                  <span>Admin Dashboard</span>
                </Link>
              )}

              {/* Alert Preferences Shortcut */}
              <Link
                id="nav-mobile-preferences-btn"
                href="/preferences"
                onClick={onClose}
                className="mt-2 w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 hover:bg-blue-100 transition"
              >
                <Bell className="h-3.5 w-3.5" />
                <span>Alert Preferences</span>
              </Link>
            </div>
          )}

          {/* Quick Search Trigger */}
          <div className="mt-4">
            <Link
              id="nav-mobile-search-btn"
              href="/search"
              onClick={onClose}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 text-sm font-medium hover:text-slate-900 dark:hover:text-white transition"
            >
              <Search className="h-4 w-4" />
              <span>Search 1,200+ exams...</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="mt-4 flex flex-col gap-1.5" aria-label="Mobile Navigation">
            <Link
              id="nav-mobile-home-link"
              href="/"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Home className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <span>Home Feed</span>
            </Link>

            <Link
              id="nav-mobile-notifications-link"
              href="/#notifications"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <Bell className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Live Notifications</span>
            </Link>

            <Link
              id="nav-mobile-categories-link"
              href="/#categories"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <BookOpen className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              <span>Exam Categories</span>
            </Link>

            <Link
              id="nav-mobile-about-link"
              href="/#about"
              onClick={onClose}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <ShieldCheck className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Verified Sources</span>
            </Link>
          </nav>
        </div>

        {/* Bottom Auth CTA Buttons */}
        <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2.5">
          {user ? (
            <button
              id="nav-mobile-signout-btn"
              onClick={() => {
                onSignOut?.();
                onClose();
              }}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          ) : (
            <>
              <Link
                id="nav-mobile-login-btn"
                href="/auth/login"
                onClick={onClose}
                className="w-full text-center py-2.5 px-4 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >
                Candidate Sign In
              </Link>

              <Link
                id="nav-mobile-register-btn"
                href="/auth/register"
                onClick={onClose}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition"
              >
                <span>Get Free Alerts</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
