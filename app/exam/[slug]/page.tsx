/**
 * @file app/exam/[slug]/page.tsx
 * @module ExamProgrammaticPage
 * @description Programmatic SEO entity landing page for specific government examination series
 * (e.g. UPSC Civil Services, KPSC Gazetted Probationers, RRB NTPC).
 * Renders the authoritative exam header, conducting authority details, official portal links,
 * Schema.org JSON-LD schemas, and all grouped notifications under this exam series.
 * 
 * Task ID: TASK-02050103 (Subtask: SUB-0205010301)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-008 (Programmatic SEO & Structured Data)
 * 
 * Complies with:
 * - Next.js 15 App Router asynchronous params contract (`await params`)
 * - Pure React Server Component (0KB client bundle overhead)
 * - Static Site Generation (SSG) via generateStaticParams() for all published exam slugs
 * - Incremental Static Regeneration (ISR revalidate = 3600s)
 * - Automatic 404 trigger for non-existent exam slugs via notFound()
 * - Full Playwright test landmarks
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { 
  getExamBySlug, 
  getNotificationsByExamSlug, 
  getAllExamSlugs 
} from "@/lib/data/notifications";
import { getCategoryBadge } from "@/lib/utils";
import Breadcrumb from "@/components/notifications/Breadcrumb";
import NotificationCard from "@/components/notifications/NotificationCard";
import Pagination from "@/components/notifications/Pagination";
import type { NotificationSortBy, NotificationListItem } from "@/types/notifications";

export const revalidate = 3600; // 1 hour ISR edge cache
export const dynamicParams = true;

/**
 * Pre-renders all published exam entity routes at build time (SSG)
 */
export async function generateStaticParams() {
  const slugs = await getAllExamSlugs();
  return slugs.map((item) => ({
    slug: item.slug,
  }));
}

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Dynamic Metadata Generator for Exam Programmatic SEO
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const exam = await getExamBySlug(slug);

  if (!exam) {
    return {
      title: "Exam Not Found | UPA-GURU",
      description: "The requested competitive examination series does not exist or has been removed.",
      robots: { index: false, follow: false },
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in";
  const canonicalUrl = `${siteUrl}/exam/${exam.slug}`;
  const title = `${exam.title} Notifications, Dates & Vacancies 2026 - UPA-GURU`;
  const description = `Official examination notifications, syllabus, eligibility, and vacancies for ${exam.title}, conducted by ${exam.conductingBody}. Apply online and check latest deadlines on UPA-GURU.`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "UPA-GURU",
      type: "website",
      locale: "en_IN",
      images: [
        {
          url: `${siteUrl}/api/og?exam=${exam.slug}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function ExamPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const exam = await getExamBySlug(slug);

  // Validate exam existence
  if (!exam) {
    notFound();
  }

  const resolvedParams = await searchParams;
  const page = typeof resolvedParams?.page === "string" ? parseInt(resolvedParams.page, 10) || 1 : 1;
  const sortBy = typeof resolvedParams?.sortBy === "string" ? (resolvedParams.sortBy as NotificationSortBy) : "deadline_soonest";

  // Query notifications associated with this exam series
  const paginatedResult = await getNotificationsByExamSlug(slug, {
    page,
    pageSize: 12,
    sortBy,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in";
  const canonicalUrl = `${siteUrl}/exam/${exam.slug}`;
  const categoryBadge = getCategoryBadge(exam.category);

  // Breadcrumbs
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Exams", href: "/#exams" },
    { label: exam.title, isCurrent: true },
  ];

  // Schema.org structured data (BreadcrumbList + CollectionPage)
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: siteUrl,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Exams",
        item: `${siteUrl}/#exams`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: exam.title,
        item: canonicalUrl,
      },
    ],
  };

  const collectionPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${exam.title} Notifications, Dates & Vacancies 2026 - UPA-GURU`,
    description: `Official notifications and recruitment announcements for ${exam.title} conducted by ${exam.conductingBody}.`,
    url: canonicalUrl,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: paginatedResult.total,
      itemListElement: paginatedResult.data.map((item: NotificationListItem, index: number) => ({
        "@type": "ListItem",
        position: (page - 1) * 12 + index + 1,
        url: `${siteUrl}/notification/${item.slug}`,
        name: item.title,
      })),
    },
  };

  return (
    <div
      id="exam-page-container"
      data-testid="exam-page"
      className="flex-1 flex flex-col items-center w-full min-h-screen pb-16"
    >
      {/* Schema.org Structured Data Injection */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionPageSchema) }}
      />

      {/* Top Breadcrumb Bar */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div data-testid="exam-breadcrumb">
          <Breadcrumb items={breadcrumbItems} />
        </div>
      </div>

      {/* Exam Header Section */}
      <section
        id="exam-header-section"
        data-testid="exam-header"
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8"
      >
        <div className="relative rounded-2xl bg-gradient-to-br from-surface-elevated/90 to-surface-card/90 border border-border p-6 sm:p-8 lg:p-10 shadow-sm overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            {/* Badges & Live Status */}
            <div className="flex flex-wrap items-center gap-2.5 mb-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${categoryBadge.badgeClass}`}>
                {categoryBadge.label}
              </span>

              <span className="inline-flex items-center px-3 py-1 rounded-full bg-surface-base border border-border text-xs text-text-secondary font-medium">
                {exam.stateOrCentral}
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-base border border-border text-xs text-text-secondary font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                <strong className="text-text-primary">{paginatedResult.total}</strong> Active Notifications
              </span>
            </div>

            {/* Exam Title (H1) */}
            <h1
              data-testid="exam-title"
              className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold text-text-primary tracking-tight leading-tight mb-3"
            >
              {exam.title}
            </h1>

            {/* Conducting Body Subheading */}
            <p
              data-testid="exam-conducting-body"
              className="text-text-secondary text-base sm:text-lg mb-6 flex items-center gap-2"
            >
              <span>Conducted by</span>
              <strong className="text-text-primary font-semibold">{exam.conductingBody}</strong>
            </p>

            {/* CTA Buttons & External Portal Link */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border/50">
              {exam.officialWebsite && (
                <a
                  href={exam.officialWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm"
                >
                  <span>Official Portal</span>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}

              <Link
                href={`/category/${exam.category}`}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-base hover:bg-surface-elevated text-text-secondary hover:text-text-primary text-xs sm:text-sm font-medium transition-colors border border-border"
              >
                <span>View all {categoryBadge.label} Exams</span>
                <span>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: Grouped Notifications Feed */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between pb-4 mb-6 border-b border-border">
          <h2 className="font-heading text-xl font-bold text-text-primary">
            Official Notifications for {exam.title}
          </h2>

          {paginatedResult.total > 0 && (
            <span className="text-xs text-text-muted">
              Showing {paginatedResult.data.length} of {paginatedResult.total} notifications
            </span>
          )}
        </div>

        {paginatedResult.data.length > 0 ? (
          <>
            {/* Notification Card Responsive Grid */}
            <div
              id="exam-notifications-grid"
              data-testid="exam-notifications-grid"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {paginatedResult.data.map((notification: NotificationListItem) => (
                <NotificationCard
                  key={notification.id}
                  notification={notification}
                />
              ))}
            </div>

            {/* Pagination Component */}
            {paginatedResult.totalPages > 1 && (
              <div className="mt-10" data-testid="exam-pagination">
                <Pagination
                  currentPage={paginatedResult.page}
                  totalPages={paginatedResult.totalPages}
                  totalItems={paginatedResult.total}
                  pageSize={paginatedResult.pageSize}
                  hasNextPage={paginatedResult.hasNextPage}
                  hasPreviousPage={paginatedResult.hasPreviousPage}
                />
              </div>
            )}
          </>
        ) : (
          /* Empty State for Exam Series */
          <div
            id="exam-empty-state"
            data-testid="exam-empty-state"
            className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-surface-elevated/50 border border-border my-8"
          >
            <div className="p-4 rounded-full bg-surface-card border border-border mb-4">
              <svg
                className="w-10 h-10 text-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="font-heading text-lg font-bold text-text-primary mb-2">
              No Active Notifications for {exam.title}
            </h3>
            <p className="text-sm text-text-secondary max-w-md mb-6 leading-relaxed">
              There are currently no active public recruitment cycles published for this exam series. Check back soon for the next recruitment cycle announcement.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={`/category/${exam.category}`}
                className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors shadow-sm"
              >
                Browse Similar {categoryBadge.label} Exams
              </Link>
              <Link
                href="/"
                className="px-5 py-2.5 rounded-lg bg-surface-card hover:bg-surface-elevated text-text-primary text-sm font-semibold transition-colors border border-border"
              >
                View All Government Exams
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
