/**
 * @file app/notification/[slug]/page.tsx
 * @module NotificationDetailPage
 * @description Candidate Portal dynamic notification detail page rendering structured sections for key dates,
 * eligibility criteria, vacancies, selection stages, syllabus, CTA action buttons, and related exam alerts.
 * 
 * Task ID: TASK-02030102 (Subtasks: SUB-0203010201, SUB-0203010202, SUB-0203010203)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-008 (SEO & Lighthouse)
 * 
 * Complies with:
 * - Next.js 15 App Router asynchronous params contract (`await params`)
 * - Pure React Server Component (0KB client bundle overhead)
 * - 404 page trigger via notFound() for invalid slugs
 * - generateStaticParams() ISR pre-rendering for top 100 notifications
 * - Full Playwright test landmarks
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { 
  getNotificationBySlug, 
  getRelatedNotifications, 
  getAllPublishedNotificationSlugs 
} from "@/lib/data/notifications";
import { 
  calculateDaysRemaining, 
  formatVacancies, 
  formatDisplayDate, 
  getCategoryBadge 
} from "@/lib/utils";
import { generateAllNotificationSchemas } from "@/lib/seo/json-ld";
import Breadcrumb from "@/components/notifications/Breadcrumb";
import NotificationCard from "@/components/notifications/NotificationCard";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Dynamic Metadata Generator for SEO, OpenGraph & Twitter Cards
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const notification = await getNotificationBySlug(slug);

  if (!notification) {
    return {
      title: "Notification Not Found | UPA-GURU",
      description: "The requested exam notification could not be found or has not yet been published.",
      robots: { index: false, follow: false },
    };
  }

  const { exam } = notification;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in";
  const canonicalUrl = `${siteUrl}/notification/${slug}`;
  const title = `${notification.title} - Apply Online | UPA-GURU`;
  const description = `${notification.title}. Conducted by ${exam.conductingBody}. Total Vacancies: ${formatVacancies(notification.totalVacancies)}. Last Date to Apply: ${formatDisplayDate(notification.applicationEndDate)}. Check eligibility, syllabus, exam pattern, and apply online.`;

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
      locale: "en_IN",
      type: "article",
      publishedTime: notification.publishedAt || notification.applicationStartDate,
      modifiedTime: notification.updatedAt,
      authors: [exam.conductingBody],
      images: [
        {
          url: `${siteUrl}/api/og?title=${encodeURIComponent(notification.title)}&body=${encodeURIComponent(exam.conductingBody)}&vacancies=${notification.totalVacancies}`,
          width: 1200,
          height: 630,
          alt: `${notification.title} - UPA-GURU`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        `${siteUrl}/api/og?title=${encodeURIComponent(notification.title)}&body=${encodeURIComponent(exam.conductingBody)}&vacancies=${notification.totalVacancies}`,
      ],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
  };
}

/**
 * Incremental Static Regeneration (ISR) configuration
 * Revalidates cached static pages every 3600 seconds (1 hour)
 */
export const revalidate = 3600;

/**
 * Enable dynamic parameters so uncached slugs render on-demand and are then cached
 */
export const dynamicParams = true;

/**
 * Next.js App Router ISR Static Path Generation
 * Pre-renders top 100 notification detail pages at build time.
 * Falls back to dynamic on-demand rendering if build-time data access fails.
 */
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  try {
    const slugs = await getAllPublishedNotificationSlugs(100);
    return slugs.map((item) => ({ slug: item.slug }));
  } catch (error) {
    console.error("[generateStaticParams] Failed to pre-render static slugs:", error);
    return [];
  }
}

export default async function NotificationDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const notification = await getNotificationBySlug(slug);

  if (!notification) {
    notFound();
  }

  const { exam } = notification;
  const urgency = calculateDaysRemaining(notification.applicationEndDate);
  const categoryMeta = getCategoryBadge(exam.category);

  // Fetch related notifications in the same category
  const relatedNotifications = await getRelatedNotifications(
    {
      category: exam.category,
      currentId: notification.id,
      conductingBody: exam.conductingBody,
    },
    3
  );

  // Parse syllabus summary if provided as key-value JSON
  const syllabusEntries = Object.entries(
    (notification.syllabusSummary as Record<string, string>) || {}
  );

  // Generate Schema.org compliant JSON-LD structured data (JobPosting, BreadcrumbList, Event)
  const schemas = generateAllNotificationSchemas(notification);

  return (
    <div
      id="notification-detail-page"
      data-testid="notification-detail"
      className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8"
    >
      {/* Schema.org Structured Data (Google Rich Snippets) */}
      {schemas.map((schema, index) => (
        <script
          key={`schema-jsonld-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}

      {/* Breadcrumb Navigation */}
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: categoryMeta.label, href: `/?category=${exam.category}` },
          { label: notification.title, isCurrent: true },
        ]}
      />

      {/* Hero Header Card */}
      <header className="rounded-2xl border border-border bg-surface dark:bg-surface-elevated/30 p-6 sm:p-8 shadow-sm">
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/60">
          <div className="flex flex-wrap items-center gap-2">
            <span
              id="detail-conducting-body"
              className="text-xs font-bold uppercase tracking-wider text-text-muted"
            >
              {exam.conductingBody}
            </span>
            <span className="text-border">•</span>
            <span
              id="detail-state-badge"
              className="inline-flex items-center rounded-full bg-surface-elevated px-2.5 py-0.5 text-xs font-medium text-text-secondary border border-border/70"
            >
              {exam.stateOrCentral} Jurisdiction
            </span>
            <span
              id="detail-category-badge"
              className={`inline-flex items-center rounded-full px-3 py-0.5 text-xs font-medium border ${categoryMeta.badgeClass}`}
            >
              {categoryMeta.label}
            </span>
          </div>

          {/* Deadline Countdown Pill */}
          <div className="flex items-center gap-2">
            <span
              id="detail-deadline-pill"
              data-testid="detail-deadline-pill"
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border ${urgency.badgeClass} ${urgency.pulseClass}`}
            >
              {urgency.isUrgent && (
                <span className="h-2 w-2 rounded-full bg-danger animate-ping" />
              )}
              {urgency.label}
            </span>
          </div>
        </div>

        {/* Title & Advertisement Number */}
        <div className="pt-5 space-y-3">
          {notification.notificationNumber && (
            <span
              id="detail-notif-number"
              className="inline-block font-mono text-xs font-medium text-text-muted bg-surface-elevated/80 px-2.5 py-1 rounded border border-border/50"
            >
              Official Advt. No: {notification.notificationNumber}
            </span>
          )}

          <h1
            id="detail-notification-title"
            className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold text-text-primary leading-tight tracking-tight"
          >
            {notification.title}
          </h1>

          <p className="text-xs text-text-muted flex items-center gap-2">
            <span>Published: {formatDisplayDate(notification.publishedAt || notification.createdAt)}</span>
            <span>•</span>
            <span className="text-success font-medium flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Verified Direct Official Notice
            </span>
          </p>
        </div>

        {/* Primary Action Buttons (SUB-0203010202) */}
        <div className="mt-8 pt-6 border-t border-border/60 flex flex-wrap items-center gap-3.5">
          {notification.applyOnlineUrl ? (
            <a
              href={notification.applyOnlineUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="detail-apply-online-btn"
              data-testid="detail-apply-online-btn"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-contrast shadow-md transition-all duration-200 hover:bg-primary-dark hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <span>Apply Online</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ) : (
            <button
              disabled
              id="detail-apply-online-btn-disabled"
              data-testid="detail-apply-online-btn"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-surface-elevated px-6 py-3 text-sm font-semibold text-text-muted opacity-60 cursor-not-allowed"
            >
              <span>Application Link Awaited</span>
            </button>
          )}

          {notification.officialPdfUrl ? (
            <a
              href={notification.officialPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              id="detail-download-pdf-btn"
              data-testid="detail-download-pdf-btn"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface hover:bg-surface-elevated px-5 py-3 text-sm font-semibold text-text-primary transition-all duration-200 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <svg className="w-4 h-4 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span>Download Official PDF</span>
            </a>
          ) : (
            <button
              disabled
              id="detail-download-pdf-btn-disabled"
              data-testid="detail-download-pdf-btn"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/60 bg-surface-elevated px-5 py-3 text-sm font-semibold text-text-muted opacity-60 cursor-not-allowed"
            >
              <span>Official PDF Awaited</span>
            </button>
          )}

          {exam.officialWebsite && (
            <a
              href={exam.officialWebsite}
              target="_blank"
              rel="noopener noreferrer"
              id="detail-official-portal-btn"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-primary transition-colors ml-auto"
            >
              <span>Official Board Portal</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          )}
        </div>
      </header>

      {/* Main Two-Column Layout (SUB-0203010201) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left / Main Column (2 spans) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Key Summary Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Vacancies Card */}
            <div
              id="detail-vacancies-card"
              className="rounded-xl border border-border bg-surface dark:bg-surface-elevated/20 p-4 shadow-sm"
            >
              <span className="text-xs text-text-muted block">Total Vacancies</span>
              <span className="font-heading text-2xl font-bold text-text-primary tracking-tight mt-1 block">
                {formatVacancies(notification.totalVacancies)}
              </span>
              <span className="text-[11px] text-text-muted mt-1 block">All Posts / Cadres</span>
            </div>

            {/* Age Limit Card */}
            <div
              id="detail-age-limit-card"
              className="rounded-xl border border-border bg-surface dark:bg-surface-elevated/20 p-4 shadow-sm"
            >
              <span className="text-xs text-text-muted block">Age Limits</span>
              <span className="font-heading text-xl font-bold text-text-primary tracking-tight mt-1 block">
                {notification.ageLimitMin && notification.ageLimitMax
                  ? `${notification.ageLimitMin} – ${notification.ageLimitMax} Years`
                  : notification.ageLimitMin
                  ? `Min ${notification.ageLimitMin} Years`
                  : "Refer Notification"}
              </span>
              <span className="text-[11px] text-text-muted mt-1 block">Category relaxations apply</span>
            </div>

            {/* Application Mode */}
            <div className="rounded-xl border border-border bg-surface dark:bg-surface-elevated/20 p-4 shadow-sm">
              <span className="text-xs text-text-muted block">Application Mode</span>
              <span className="font-heading text-xl font-bold text-text-primary tracking-tight mt-1 block">
                Online Portal
              </span>
              <span className="text-[11px] text-text-muted mt-1 block">Through Official Website</span>
            </div>
          </div>

          {/* Educational Qualifications Section */}
          <section
            id="detail-eligibility-section"
            data-testid="detail-eligibility-section"
            className="rounded-xl border border-border bg-surface dark:bg-surface-elevated/20 p-6 shadow-sm space-y-4"
          >
            <h2 className="font-heading text-lg font-bold text-text-primary flex items-center gap-2">
              <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path d="M12 14l9-5-9-5-9 5 9 5z" />
                <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
              <span>Educational Eligibility & Criteria</span>
            </h2>

            {notification.qualificationRequired && notification.qualificationRequired.length > 0 ? (
              <ul className="space-y-2.5 text-xs text-text-secondary">
                {notification.qualificationRequired.map((qual, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <span className="leading-relaxed">{qual}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-text-muted">
                Please consult the official notification PDF for specific educational qualification requirements across posts.
              </p>
            )}
          </section>

          {/* Selection Process Stages Section */}
          <section
            id="detail-selection-section"
            data-testid="detail-selection-section"
            className="rounded-xl border border-border bg-surface dark:bg-surface-elevated/20 p-6 shadow-sm space-y-4"
          >
            <h2 className="font-heading text-lg font-bold text-text-primary flex items-center gap-2">
              <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Selection Process Stages</span>
            </h2>

            {notification.selectionProcess && notification.selectionProcess.length > 0 ? (
              <ol className="space-y-3">
                {notification.selectionProcess.map((stage, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 p-3 rounded-lg bg-surface-elevated/60 border border-border/50 text-xs"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-contrast flex-shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-text-primary self-center">{stage}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-text-muted">
                Selection methodology follows the statutory rules prescribed in the official advertisement.
              </p>
            )}
          </section>

          {/* Syllabus Outline Section */}
          <section
            id="detail-syllabus-section"
            data-testid="detail-syllabus-section"
            className="rounded-xl border border-border bg-surface dark:bg-surface-elevated/20 p-6 shadow-sm space-y-4"
          >
            <h2 className="font-heading text-lg font-bold text-text-primary flex items-center gap-2">
              <svg className="w-5 h-5 text-warning" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span>Examination Pattern & Syllabus Summary</span>
            </h2>

            {syllabusEntries.length > 0 ? (
              <div className="space-y-3">
                {syllabusEntries.map(([stageKey, summary], idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-lg bg-surface-elevated/70 border border-border/60 text-xs space-y-1"
                  >
                    <span className="font-semibold uppercase tracking-wider text-primary block">
                      {stageKey.replace(/_/g, " ")}
                    </span>
                    <p className="text-text-secondary leading-relaxed">{summary}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-text-muted">
                Refer to the official examination notification PDF for the complete post-wise syllabus and exam scheme.
              </p>
            )}
          </section>
        </div>

        {/* Right / Sidebar Column (1 span) */}
        <aside className="space-y-6">
          {/* Important Dates Card */}
          <div
            id="detail-dates-card"
            data-testid="detail-dates-card"
            className="rounded-xl border border-border bg-surface dark:bg-surface-elevated/30 p-5 shadow-sm space-y-4"
          >
            <h3 className="font-heading text-base font-bold text-text-primary border-b border-border/60 pb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Important Dates</span>
            </h3>

            <dl className="space-y-3.5 text-xs">
              <div className="flex justify-between items-center">
                <dt className="text-text-muted">Applications Open</dt>
                <dd className="font-semibold text-text-primary">
                  {formatDisplayDate(notification.applicationStartDate)}
                </dd>
              </div>

              <div className="flex justify-between items-center">
                <dt className="text-text-muted">Application Deadline</dt>
                <dd className="font-bold text-danger">
                  {formatDisplayDate(notification.applicationEndDate)}
                </dd>
              </div>

              <div className="flex justify-between items-center">
                <dt className="text-text-muted">Exam Date</dt>
                <dd className="font-semibold text-text-primary">
                  {formatDisplayDate(notification.examDate)}
                </dd>
              </div>

              <div className="pt-2 border-t border-border/50 flex justify-between items-center">
                <dt className="text-text-muted">Status</dt>
                <dd>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] border ${urgency.badgeClass}`}>
                    {urgency.label}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          {/* Conducting Body Information Card */}
          <div className="rounded-xl border border-border bg-surface dark:bg-surface-elevated/30 p-5 shadow-sm space-y-3.5 text-xs">
            <h3 className="font-heading text-base font-bold text-text-primary border-b border-border/60 pb-3">
              Recruitment Authority
            </h3>

            <div>
              <span className="text-text-muted block text-[11px]">Authority</span>
              <span className="font-bold text-text-primary text-sm mt-0.5 block">{exam.conductingBody}</span>
            </div>

            <div>
              <span className="text-text-muted block text-[11px]">Jurisdiction</span>
              <span className="font-medium text-text-secondary mt-0.5 block">{exam.stateOrCentral}</span>
            </div>

            {exam.officialWebsite && (
              <div className="pt-2 border-t border-border/50">
                <a
                  href={exam.officialWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-primary hover:underline text-xs"
                >
                  <span>Visit Authority Website</span>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}
          </div>

          {/* Statutory Disclaimer Notice */}
          <div className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-[11px] text-text-muted leading-relaxed space-y-1.5">
            <span className="font-bold text-warning block">Statutory Candidate Note</span>
            <p>
              Candidates are strongly advised to cross-verify all eligibility rules and instructions directly from the official notification PDF before submitting applications.
            </p>
          </div>
        </aside>
      </div>

      {/* Related Exam Notifications Section (SUB-0203010203) */}
      {relatedNotifications.length > 0 && (
        <section
          id="detail-related-section"
          data-testid="detail-related-section"
          className="pt-10 border-t border-border/80 space-y-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-xl font-bold text-text-primary">
                Related {categoryMeta.label} Notifications
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Other active examinations in the same cadre
              </p>
            </div>
            <Link
              href={`/?category=${exam.category}`}
              className="text-xs font-semibold text-primary hover:text-primary-dark transition-colors"
            >
              View All in {categoryMeta.label} →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {relatedNotifications.map((related) => (
              <NotificationCard key={related.id} notification={related} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
