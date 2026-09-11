/**
 * @file app/layout.tsx
 * @description Next.js 15 Root Layout for UPA-GURU Pan-India Government Exam Notification Portal.
 * Initializes global fonts (Inter for body, Outfit for headings) via next/font/google with display swap,
 * sets mobile-first viewport constraints, and provides baseline semantic HTML structure with Header and Footer.
 * 
 * Task ID: TASK-02010102 (Subtasks: SUB-0201010201, SUB-0201010202, SUB-0201010203)
 * Architecture Reference: ADR-001 (Frontend Architecture), ADR-008 (SEO Strategy)
 */

import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import "./globals.css";

/**
 * Inter font configuration for body text and general interface typography.
 * Loaded with Latin subset, CSS variable binding, and display swap to prevent FOUT.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/**
 * Outfit font configuration for prominent headings, stats, and branding elements.
 * Loaded with Latin subset, CSS variable binding, and display swap for zero CLS.
 */
const outfit = Outfit({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-outfit",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: {
    default: "UPA-GURU | Pan-India Central & State Government Exam Notifications",
    template: "%s | UPA-GURU",
  },
  description: "Real-time government exam notifications, syllabus, eligibility criteria, and omnichannel alert tracking across UPSC, SSC, RRB, and State PSCs.",
  keywords: ["government exams", "UPSC notifications", "SSC CGL", "State PSC", "Sarkari Result", "exam alerts"],
  authors: [{ name: "UPA-GURU Team" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable} ${outfit.variable}`}>
      <body className="min-h-full flex flex-col font-sans antialiased bg-background text-foreground">
        <Header />
        <main className="flex-1 w-full flex flex-col">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
