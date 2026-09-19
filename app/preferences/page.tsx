/**
 * @file app/preferences/page.tsx
 * @module SubscriptionPreferencesPage
 * @description Candidate Subscription Preference Center page. Renders the interactive alert
 * configuration interface for exam categories, Indian states, and delivery channels.
 * 
 * Task ID: TASK-05010101 (Subtasks: SUB-0501010101, SUB-0501010102)
 * Architecture Reference: ADR-001 (Next.js 15 App Router RSC), ADR-002 (Database), ADR-007 (Push Engine)
 * 
 * Complies with:
 * - Next.js 15 React Server Component (RSC) standards
 * - User authentication enforcement (Redirects unauthenticated users to /auth/login)
 * - Server-side data prefetching via getUserSubscription()
 * - Responsive layout with breadcrumb and high contrast WCAG standards
 */

import { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Bell, ChevronRight, Sliders, ShieldCheck } from "lucide-react";
import { createServerClient } from "@/lib/supabase/server";
import { getUserSubscription } from "@/lib/data/subscriptions";
import SubscriptionPreferenceForm from "@/components/preferences/SubscriptionPreferenceForm";

export const metadata: Metadata = {
  title: "Alert Preferences | UPA-GURU Pan-India Exam Intelligence",
  description: "Customize your real-time government exam alert preferences across exam categories, Indian states, Web Push, Telegram, and WhatsApp.",
};

export default async function PreferencesPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?redirect=/preferences");
  }

  // Pre-fetch candidate's existing subscription profile
  const subscription = await getUserSubscription(user.id);

  return (
    <div className="min-h-screen bg-gray-50/60 pb-16 pt-6">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-gray-500">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-semibold text-gray-900" aria-current="page">
            Alert Preferences
          </span>
        </nav>

        {/* Page Hero Header */}
        <div className="bg-linear-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-md relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/20 text-blue-200 border border-blue-400/30">
                <Sliders className="w-3.5 h-3.5 text-blue-300" />
                <span>Omnichannel Notification Hub</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Exam Alert Preferences
              </h1>
              <p className="text-sm text-blue-100/80 leading-relaxed">
                Filter notifications by your exact target competitive exams and states. Choose where and how fast you receive new recruitment alerts.
              </p>
            </div>

            <div className="flex-shrink-0 bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/15 text-xs text-blue-100 space-y-2">
              <div className="flex items-center gap-2 text-white font-semibold">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Zero Spam Guarantee</span>
              </div>
              <p className="text-blue-200/80 leading-tight">
                You will only receive notifications matching your exact selected categories and jurisdictions.
              </p>
            </div>
          </div>
        </div>

        {/* Interactive Subscription Form */}
        <main>
          <SubscriptionPreferenceForm
            initialSubscription={subscription}
            userEmail={user.email || "Candidate"}
          />
        </main>
      </div>
    </div>
  );
}
