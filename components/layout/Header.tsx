"use client";

/**
 * @file components/layout/Header.tsx
 * @description Main application header component with responsive desktop navigation,
 * search quick-trigger, reactive authentication session listener, Admin Console quick-link,
 * and mobile drawer toggle.
 * 
 * Task ID: TASK-02010102 (Subtask: SUB-0201010201)
 * Architecture Reference: ADR-001 (Frontend Architecture), ADR-003 (RBAC)
 */

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, Search, ArrowRight, Shield, LogOut, User as UserIcon, Bell } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import MobileNav from "./MobileNav";

interface AuthUserState {
  email?: string;
  role?: string;
  fullName?: string;
}

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<AuthUserState | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  useEffect(() => {
    const supabase = createBrowserClient();

    async function checkSession() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const role =
            (authUser.app_metadata?.role as string) ||
            (authUser.user_metadata?.role as string) ||
            "candidate";
          setUser({
            email: authUser.email,
            role,
            fullName: (authUser.user_metadata?.full_name as string) || undefined,
          });
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error("[Header] Error checking auth user session:", err);
        setUser(null);
      } finally {
        setIsLoadingAuth(false);
      }
    }

    checkSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const role =
          (session.user.app_metadata?.role as string) ||
          (session.user.user_metadata?.role as string) ||
          "candidate";
        setUser({
          email: session.user.email,
          role,
          fullName: (session.user.user_metadata?.full_name as string) || undefined,
        });
      } else {
        setUser(null);
      }
      setIsLoadingAuth(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      const supabase = createBrowserClient();
      await supabase.auth.signOut();
      setUser(null);
      window.location.href = "/";
    } catch (err) {
      console.error("[Header] Sign out failed:", err);
    }
  };

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  return (
    <>
      <header
        id="app-global-header"
        className="w-full sticky top-0 z-40 bg-white/85 dark:bg-slate-900/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Brand Logo & Tagline */}
          <div className="flex items-center gap-3">
            <Link
              id="header-brand-logo-link"
              href="/"
              className="flex items-center gap-2.5 group focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-lg"
            >
              <div className="h-9 w-9 rounded-xl bg-blue-600 text-white font-heading font-black text-lg flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform">
                UG
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="font-heading font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">
                    UPA-GURU
                  </span>
                  <span className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    Live
                  </span>
                </div>
                <span className="hidden lg:block text-[11px] font-medium text-slate-500 dark:text-slate-400 leading-none">
                  Pan-India Exam Intelligence
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav
            id="header-desktop-nav"
            className="hidden md:flex items-center gap-1"
            aria-label="Main Navigation"
          >
            <Link
              id="header-nav-link-home"
              href="/"
              className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Home
            </Link>

            <Link
              id="header-nav-link-notifications"
              href="/#notifications"
              className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Notifications
            </Link>

            <Link
              id="header-nav-link-categories"
              href="/#categories"
              className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              Categories
            </Link>

            <Link
              id="header-nav-link-about"
              href="/#about"
              className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              About
            </Link>
          </nav>

          {/* Right Action Cluster: Search Trigger + Auth CTA + Mobile Toggle */}
          <div className="flex items-center gap-2.5">
            {/* Search Quick Trigger */}
            <Link
              id="header-search-trigger-btn"
              href="/search"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 text-xs font-medium hover:border-slate-300 dark:hover:border-slate-700 transition"
              aria-label="Search notifications"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Search exams...</span>
              <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded text-slate-400">
                ⌘K
              </kbd>
            </Link>

            {/* Reactive Auth State Actions */}
            {!isLoadingAuth && (
              <div className="hidden sm:flex items-center gap-2">
                {user ? (
                  <>
                    {/* Admin Dashboard Trigger */}
                    {isAdmin && (
                      <Link
                        id="header-admin-dashboard-btn"
                        href="/admin"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition shadow-sm"
                      >
                        <Shield className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                        <span>Admin Dashboard</span>
                      </Link>
                    )}

                    {/* Alert Preferences Trigger */}
                    <Link
                      id="header-preferences-btn"
                      href="/preferences"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-200 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                      title="Alert Preferences"
                    >
                      <Bell className="h-3.5 w-3.5 text-blue-600" />
                      <span>Alerts</span>
                    </Link>

                    {/* Authenticated User Identity */}
                    <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-[11px] uppercase">
                          {user.fullName ? user.fullName.charAt(0) : user.email ? user.email.charAt(0) : "U"}
                        </div>
                        <span className="hidden lg:inline-block truncate max-w-[120px]">
                          {user.fullName || (user.email ? user.email.split("@")[0] : "Account")}
                        </span>
                      </div>

                      {/* Sign Out Button */}
                      <button
                        id="header-signout-btn"
                        onClick={handleSignOut}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                        title="Sign Out"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span className="hidden md:inline">Sign Out</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <Link
                      id="header-login-btn"
                      href="/auth/login"
                      className="text-xs font-semibold px-3 py-2 rounded-lg text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                    >
                      Sign In
                    </Link>
                    <Link
                      id="header-register-btn"
                      href="/auth/register"
                      className="inline-flex items-center gap-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg shadow-sm shadow-blue-500/20 transition hover:scale-[1.02]"
                    >
                      <span>Get Alerts</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </>
                )}
              </div>
            )}

            {/* Mobile Hamburger Menu Button */}
            <button
              id="header-mobile-menu-toggle-btn"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition focus:outline-none focus:ring-2 focus:ring-blue-600"
              aria-label="Open mobile navigation menu"
              aria-expanded={isMobileMenuOpen}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Render Slide-out Mobile Navigation Drawer */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        user={user}
        isAdmin={isAdmin}
        onSignOut={handleSignOut}
      />
    </>
  );
}
