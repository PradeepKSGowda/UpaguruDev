"use client";

/**
 * @file components/layout/Footer.tsx
 * @description Global footer component containing brand details, categorized exam links,
 * trust badges, and statutory legal disclosures (Privacy Policy, Terms, Disclaimer).
 * 
 * Task ID: TASK-02010102 (Subtask: SUB-0201010202)
 * Architecture Reference: ADR-001 (Frontend Architecture), ADR-008 (SEO Strategy)
 */

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, Bell, Sparkles } from "lucide-react";

export default function Footer() {
  const pathname = usePathname();

  // Hide the public consumer footer when browsing administrative routes (/admin/*).
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  const currentYear = new Date().getFullYear();

  return (
    <footer
      id="app-global-footer"
      className="w-full bg-slate-900 text-slate-300 border-t border-slate-800"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Column 1 & 2: Brand Identity & Mission */}
          <div className="lg:col-span-2 flex flex-col gap-4">
            <Link
              id="footer-brand-logo-link"
              href="/"
              className="flex items-center gap-2.5 group w-fit"
            >
              <div className="h-9 w-9 rounded-xl bg-blue-600 text-white font-heading font-black text-lg flex items-center justify-center shadow-md shadow-blue-500/20">
                UG
              </div>
              <span className="font-heading font-extrabold text-2xl tracking-tight text-white">
                UPA-GURU
              </span>
            </Link>

            <p className="text-sm text-slate-400 leading-relaxed max-w-sm">
              India&apos;s authoritative platform for real-time central and state government exam notifications.
              AI-extracted, human-verified circulars with omnichannel push alerts across Telegram, WhatsApp, and Web.
            </p>

            {/* Trust Badges */}
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-800/80 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>100% Verified Circulars</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-950/60 border border-blue-800/80 text-blue-400 text-xs font-semibold">
                <Bell className="h-3.5 w-3.5" />
                <span>Sub-Second Push Alerts</span>
              </span>
            </div>
          </div>

          {/* Column 3: Exam Categories */}
          <div>
            <h3 className="font-heading text-xs font-bold text-white uppercase tracking-wider mb-4">
              Major Exam Boards
            </h3>
            <ul className="space-y-2.5 text-sm" aria-label="Exam Boards Navigation">
              <li>
                <Link
                  id="footer-link-upsc"
                  href="/#categories"
                  className="hover:text-blue-400 transition"
                >
                  UPSC Civil Services
                </Link>
              </li>
              <li>
                <Link
                  id="footer-link-ssc"
                  href="/#categories"
                  className="hover:text-blue-400 transition"
                >
                  SSC (CGL, CHSL, MTS)
                </Link>
              </li>
              <li>
                <Link
                  id="footer-link-rrb"
                  href="/#categories"
                  className="hover:text-blue-400 transition"
                >
                  Railway Recruitment (RRB)
                </Link>
              </li>
              <li>
                <Link
                  id="footer-link-banking"
                  href="/#categories"
                  className="hover:text-blue-400 transition"
                >
                  Banking (IBPS, SBI, RBI)
                </Link>
              </li>
              <li>
                <Link
                  id="footer-link-state-psc"
                  href="/#categories"
                  className="hover:text-blue-400 transition"
                >
                  State PSCs (KPSC, MPPSC)
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4: Quick Resources */}
          <div>
            <h3 className="font-heading text-xs font-bold text-white uppercase tracking-wider mb-4">
              Aspirant Resources
            </h3>
            <ul className="space-y-2.5 text-sm" aria-label="Aspirant Resources">
              <li>
                <Link
                  id="footer-link-live-feed"
                  href="/#notifications"
                  className="hover:text-blue-400 transition"
                >
                  Live Notifications Feed
                </Link>
              </li>
              <li>
                <Link
                  id="footer-link-search"
                  href="/#search"
                  className="hover:text-blue-400 transition"
                >
                  Search Exam Database
                </Link>
              </li>
              <li>
                <Link
                  id="footer-link-alerts"
                  href="/auth/register"
                  className="hover:text-blue-400 transition"
                >
                  Subscribe to Alerts
                </Link>
              </li>
              <li>
                <Link
                  id="footer-link-login"
                  href="/auth/login"
                  className="hover:text-blue-400 transition"
                >
                  Candidate Portal
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 5: Trust & Legal */}
          <div>
            <h3 className="font-heading text-xs font-bold text-white uppercase tracking-wider mb-4">
              Trust & Legal
            </h3>
            <ul className="space-y-2.5 text-sm" aria-label="Legal Links">
              <li>
                <Link
                  id="footer-link-about"
                  href="/#about"
                  className="hover:text-blue-400 transition"
                >
                  About UPA-GURU
                </Link>
              </li>
              <li>
                <Link
                  id="footer-link-privacy"
                  href="/#privacy"
                  className="hover:text-blue-400 transition"
                >
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link
                  id="footer-link-terms"
                  href="/#terms"
                  className="hover:text-blue-400 transition"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  id="footer-link-disclaimer"
                  href="/#disclaimer"
                  className="hover:text-blue-400 transition"
                >
                  Government Disclaimer
                </Link>
              </li>
              <li>
                <Link
                  id="footer-link-contact"
                  href="/#contact"
                  className="hover:text-blue-400 transition"
                >
                  Contact & Support
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Disclaimer & Copyright Border Section */}
        <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2 text-center md:text-left">
            <Sparkles className="h-4 w-4 text-blue-400 shrink-0" />
            <p>
              &copy; {currentYear} UPA-GURU Platform. Dedicated to Empowering India&apos;s Aspirants.
            </p>
          </div>

          <p className="text-center md:text-right text-[11px] text-slate-500 max-w-xl">
            Disclaimer: UPA-GURU is an independent educational intelligence portal and is not affiliated with any official government recruitment board. All notifications reference verified official public circulars.
          </p>
        </div>
      </div>
    </footer>
  );
}
