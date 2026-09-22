/**
 * @file app/auth/layout.tsx
 * @module AuthLayout
 * @description Layout container for all UPA-GURU authentication routes (/auth/*).
 * 
 * Complies with:
 * - Next.js 15 App Router RSC layout architecture
 * - WCAG 2.1 AA accessibility (semantic markup, clear landmarks)
 * - Mobile-first responsive layout (320px to 1440px)
 */

import React from "react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      id="auth-layout-container"
      className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center py-12 sm:px-6 lg:px-8 transition-colors"
    >
      <header className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6">
        <Link
          id="auth-brand-home-link"
          href="/"
          className="inline-flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-lg px-2 py-1"
        >
          <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            U
          </span>
          <span>UPA-GURU</span>
        </Link>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 font-medium">
          Pan-India Exam Notifications & Verification Portal
        </p>
      </header>

      <main className="sm:mx-auto sm:w-full sm:max-w-md">
        <div
          id="auth-card"
          data-testid="auth-card"
          className="bg-white dark:bg-slate-900 py-8 px-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-200/80 dark:border-slate-800 rounded-2xl sm:px-10 transition-all"
        >
          {children}
        </div>
      </main>

      <footer className="mt-8 text-center text-xs text-slate-500 dark:text-slate-500">
        <p>
          Secure authentication provided by Supabase Auth with Row Level Security.
        </p>
        <div className="mt-2 flex justify-center gap-4">
          <Link
            id="auth-footer-privacy"
            href="/privacy"
            className="hover:text-slate-800 dark:hover:text-slate-300 underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          <span>•</span>
          <Link
            id="auth-footer-terms"
            href="/terms"
            className="hover:text-slate-800 dark:hover:text-slate-300 underline underline-offset-2"
          >
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
