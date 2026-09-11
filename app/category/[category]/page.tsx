/**
 * @file app/category/[category]/page.tsx
 * @module CategoryProgrammaticPage
 * @description Programmatic SEO landing page for exam categories in UPA-GURU.
 * Renders filtered exam notifications, category-specific metadata, Schema.org JSON-LD schemas,
 * live stats, and cross-category discovery links.
 * 
 * Task ID: TASK-02050101 (Subtask: SUB-0205010101)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-008 (Programmatic SEO & Structured Data)
 * 
 * Complies with:
 * - Next.js 15 App Router asynchronous params contract (`await params`)
 * - Pure React Server Component (0KB client JavaScript overhead for content)
 * - Static Site Generation (SSG) via generateStaticParams() for all 8 categories
 * - Incremental Static Regeneration (ISR revalidate = 3600s)
 * - Automatic 404 trigger for non-existent categories via notFound()
 * - Full Playwright test landmarks
 */

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublishedNotifications } from "@/lib/data/notifications";
import Breadcrumb from "@/components/notifications/Breadcrumb";
import NotificationCard from "@/components/notifications/NotificationCard";
import Pagination from "@/components/notifications/Pagination";
import type { ExamCategory, NotificationSortBy, NotificationListItem } from "@/types/notifications";

export const revalidate = 3600; // 1 hour ISR edge cache
export const dynamicParams = true;

/**
 * All 8 official examination categories defined in database enum
 */
export const VALID_CATEGORIES: ExamCategory[] = [
  "civil_services",
  "banking",
  "railways",
  "defense",
  "state_psc",
  "teaching",
  "police",
  "other",
];

interface CategoryDefinition {
  name: string;
  shortName: string;
  badgeLabel: string;
  badgeClass: string;
  iconSvg: string;
  title: string;
  description: string;
  metaDescription: string;
  popularExams: string[];
}

export const CATEGORY_DEFINITIONS: Record<ExamCategory, CategoryDefinition> = {
  civil_services: {
    name: "Civil Services",
    shortName: "Civil Services",
    badgeLabel: "Civil Services",
    badgeClass: "bg-primary/10 text-primary border-primary/20",
    iconSvg: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
    title: "Civil Services Government Exams - UPA-GURU",
    description: "Official recruitment notifications, examination schedules, syllabus details, and application deadlines for prestigious Indian Civil Services examinations.",
    metaDescription: "Latest Civil Services exam notifications, UPSC CSE, IAS, IPS, IFS recruitments, eligibility criteria, vacancies, and application deadlines on UPA-GURU.",
    popularExams: ["UPSC Civil Services (IAS/IPS)", "Indian Forest Service (IFS)", "Combined Medical Services", "Civil Services Prelims"],
  },
  banking: {
    name: "Banking & IBPS",
    shortName: "Banking",
    badgeLabel: "Banking & IBPS",
    badgeClass: "bg-accent/10 text-accent border-accent/20",
    iconSvg: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "Banking & IBPS Government Exams - UPA-GURU",
    description: "Explore all public sector bank recruitments, IBPS PO, Clerk, Specialist Officers, SBI PO, and RBI recruitment alerts with application deadlines.",
    metaDescription: "Explore public sector bank recruitment notifications including IBPS PO, Clerk, SBI PO, SO, and RBI exam notifications and deadlines on UPA-GURU.",
    popularExams: ["IBPS Probationary Officer (PO)", "SBI PO Recruitment", "IBPS Clerk", "RBI Grade B Officer", "IBPS Specialist Officer"],
  },
  railways: {
    name: "Railways (RRB)",
    shortName: "Railways",
    badgeLabel: "Railways (RRB)",
    badgeClass: "bg-warning/10 text-warning border-warning/20",
    iconSvg: "M13 10V3L4 14h7v7l9-11h-7z",
    title: "Railways (RRB) Government Exams - UPA-GURU",
    description: "Official Railway Recruitment Board (RRB) exam announcements, NTPC, Group D, Assistant Loco Pilot (ALP), and Junior Engineer vacancies across India.",
    metaDescription: "Official Railway Recruitment Board (RRB) exam notifications, NTPC, Group D, ALP, JE vacancies, exam dates, and eligibility details on UPA-GURU.",
    popularExams: ["RRB NTPC (Non-Technical)", "RRB Group D (Level 1)", "RRB Assistant Loco Pilot", "RRB Junior Engineer", "RPF Sub-Inspector"],
  },
  defense: {
    name: "Defence & Military",
    shortName: "Defence",
    badgeLabel: "Defence & Military",
    badgeClass: "bg-danger/10 text-danger border-danger/20",
    iconSvg: "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
    title: "Defence & Military Government Exams - UPA-GURU",
    description: "Latest Indian Armed Forces recruitment alerts for NDA, CDS, AFCAT, Indian Army, Indian Navy, Indian Air Force, and paramilitary forces.",
    metaDescription: "Latest Indian Armed Forces recruitment alerts for NDA, CDS, AFCAT, Indian Army, Navy, Air Force, and paramilitary forces on UPA-GURU.",
    popularExams: ["National Defence Academy (NDA)", "Combined Defence Services (CDS)", "Air Force Common Admission Test (AFCAT)", "Indian Navy INET", "CAPF Assistant Commandant"],
  },
  state_psc: {
    name: "State PSCs",
    shortName: "State PSC",
    badgeLabel: "State PSC",
    badgeClass: "bg-secondary/10 text-secondary border-secondary/20",
    iconSvg: "M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    title: "State PSCs Government Exams - UPA-GURU",
    description: "Comprehensive state public service commission exams covering KPSC, UPPSC, MPSC, BPSC, TNPSC, and administrative services across Indian states.",
    metaDescription: "State Public Service Commission recruitment notifications across all Indian states including KPSC, UPPSC, MPSC, BPSC, and TNPSC on UPA-GURU.",
    popularExams: ["KPSC Gazetted Probationer", "UPPSC Combined State", "MPSC State Services", "BPSC Combined Competitive", "TNPSC Combined Civil"],
  },
  teaching: {
    name: "Teaching & Faculty",
    shortName: "Teaching",
    badgeLabel: "Teaching & Faculty",
    badgeClass: "bg-primary-light/10 text-primary-light border-primary-light/20",
    iconSvg: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
    title: "Teaching & Faculty Government Exams - UPA-GURU",
    description: "Central and State government teaching recruitment alerts, CTET, State TETs, UGC NET, Assistant Professor, and government school educator vacancies.",
    metaDescription: "Government teaching exam notifications, CTET, State TETs, UGC NET, Assistant Professor, and school teacher recruitments on UPA-GURU.",
    popularExams: ["Central Teacher Eligibility Test (CTET)", "UGC NET Examination", "Kendriya Vidyalaya (KVS) Faculty", "Navodaya Vidyalaya (NVS) Teaching", "State Level TETs"],
  },
  police: {
    name: "Police & Security",
    shortName: "Police",
    badgeLabel: "Police & Security",
    badgeClass: "bg-danger/10 text-danger border-danger/20",
    iconSvg: "M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 004 11a7.96 7.96 0 00.99 3.868",
    title: "Police & Security Government Exams - UPA-GURU",
    description: "Police Sub-Inspector (SI), Constable, DSP, and law enforcement recruitment notifications, physical endurance criteria, and schedules across India.",
    metaDescription: "Police Sub-Inspector (SI), Constable, DSP recruitment notifications, physical standards, and examination schedules across India on UPA-GURU.",
    popularExams: ["SSC CPO (Sub-Inspector)", "State Police Sub-Inspector", "Police Constable Recruitment", "Delhi Police Head Constable", "Intelligence Bureau ACIO"],
  },
  other: {
    name: "Other Government",
    shortName: "Other Exams",
    badgeLabel: "Other Government",
    badgeClass: "bg-surface-elevated text-text-muted border-border",
    iconSvg: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
    title: "Other Government Exams - UPA-GURU",
    description: "Recruitment notices for PSUs, statutory corporations, autonomous government bodies, scientific research institutes, and central organizations.",
    metaDescription: "Latest recruitment notices for statutory bodies, PSUs, autonomous institutions, and other central and state government organizations on UPA-GURU.",
    popularExams: ["SSC Combined Graduate Level (CGL)", "ISRO ICRB Recruitment", "DRDO CEPTAM", "Food Corporation of India (FCI)", "LIC Administrative Officer"],
  },
};

/**
 * Pre-renders all 8 official category routes at build time (SSG)
 */
export async function generateStaticParams() {
  return VALID_CATEGORIES.map((category) => ({
    category,
  }));
}

interface PageProps {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Dynamic Metadata Generator for Category Programmatic SEO
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const def = CATEGORY_DEFINITIONS[category as ExamCategory];

  if (!def) {
    return {
      title: "Category Not Found | UPA-GURU",
      description: "The requested examination category does not exist or has been moved.",
      robots: { index: false, follow: false },
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in";
  const canonicalUrl = `${siteUrl}/category/${category}`;

  return {
    title: `${def.name} Government Exams - UPA-GURU`,
    description: def.metaDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `${def.name} Government Exams - UPA-GURU`,
      description: def.metaDescription,
      url: canonicalUrl,
      siteName: "UPA-GURU",
      type: "website",
      locale: "en_IN",
      images: [
        {
          url: `${siteUrl}/api/og?category=${category}`,
          width: 1200,
          height: 630,
          alt: `${def.name} Government Exams - UPA-GURU`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${def.name} Government Exams - UPA-GURU`,
      description: def.metaDescription,
    },
  };
}

export default async function CategoryPage({ params, searchParams }: PageProps) {
  const { category: rawCategory } = await params;
  const category = rawCategory as ExamCategory;

  // Validate category param against official enum list
  if (!VALID_CATEGORIES.includes(category)) {
    notFound();
  }

  const def = CATEGORY_DEFINITIONS[category];
  const resolvedParams = await searchParams;

  const page = typeof resolvedParams?.page === "string" ? parseInt(resolvedParams.page, 10) || 1 : 1;
  const sortBy = typeof resolvedParams?.sortBy === "string" ? (resolvedParams.sortBy as NotificationSortBy) : "deadline_soonest";
  const state = typeof resolvedParams?.state === "string" ? resolvedParams.state : undefined;

  // Fetch category-filtered notifications from Supabase
  const paginatedResult = await getPublishedNotifications({
    category,
    page,
    pageSize: 12,
    sortBy,
    state,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in";
  const canonicalUrl = `${siteUrl}/category/${category}`;

  // Breadcrumb items
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Categories", href: "/#categories" },
    { label: def.name, isCurrent: true },
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
        name: "Categories",
        item: `${siteUrl}/#categories`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: def.name,
        item: canonicalUrl,
      },
    ],
  };

  const collectionPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${def.name} Government Exams - UPA-GURU`,
    description: def.metaDescription,
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
      id="category-page-container"
      data-testid="category-page"
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
        <div data-testid="category-breadcrumb">
          <Breadcrumb items={breadcrumbItems} />
        </div>
      </div>

      {/* Category Hero Header Section */}
      <section
        id="category-hero-section"
        data-testid="category-hero"
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8"
      >
        <div className="relative rounded-2xl bg-gradient-to-br from-surface-elevated/90 to-surface-card/90 border border-border p-6 sm:p-8 lg:p-10 shadow-sm overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10">
            {/* Category Badge & Live Stats */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${def.badgeClass}`}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={def.iconSvg} />
                </svg>
                <span>{def.badgeLabel}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-base border border-border text-xs text-text-secondary font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                <strong className="text-text-primary">{paginatedResult.total}</strong> Active Notifications
              </span>
            </div>

            {/* Page H1: Strictly conforms to acceptance criteria */}
            <h1
              data-testid="category-h1"
              className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold text-text-primary tracking-tight leading-tight mb-3"
            >
              {def.name} Government Exams - UPA-GURU
            </h1>

            {/* Category Description */}
            <p className="text-text-secondary text-sm sm:text-base max-w-3xl leading-relaxed mb-6">
              {def.description}
            </p>

            {/* Popular Exam Keywords in this Category */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider mr-1">
                Popular Series:
              </span>
              {def.popularExams.map((examName) => (
                <Link
                  key={examName}
                  href={`/search?q=${encodeURIComponent(examName)}`}
                  className="px-2.5 py-1 rounded-md bg-surface-base hover:bg-surface-elevated text-xs text-text-secondary hover:text-primary transition-colors border border-border/70"
                >
                  {examName}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Cross-Category Discovery Bar */}
      <section
        id="cross-category-section"
        data-testid="cross-category-links"
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8"
      >
        <div className="flex items-center justify-between gap-4 pb-2 border-b border-border">
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
            Explore Other Exam Categories
          </h2>
          <Link
            href="/"
            className="text-xs font-semibold text-primary hover:underline"
          >
            View All Categories →
          </Link>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto py-3 no-scrollbar">
          {VALID_CATEGORIES.map((catKey) => {
            const isCurrent = catKey === category;
            const catDef = CATEGORY_DEFINITIONS[catKey];
            return (
              <Link
                key={catKey}
                href={`/category/${catKey}`}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  isCurrent
                    ? "bg-primary text-white shadow-sm font-semibold pointer-events-none"
                    : "bg-surface-elevated hover:bg-surface-card text-text-secondary hover:text-text-primary border border-border"
                }`}
              >
                {catDef.name}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Main Content: Notification Cards Grid or Empty State */}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {paginatedResult.data.length > 0 ? (
          <>
            {/* Grid Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="text-sm text-text-muted">
                Showing{" "}
                <span className="font-semibold text-text-primary">
                  {(page - 1) * paginatedResult.pageSize + 1}-
                  {Math.min(page * paginatedResult.pageSize, paginatedResult.total)}
                </span>{" "}
                of <span className="font-semibold text-text-primary">{paginatedResult.total}</span>{" "}
                {def.name} notifications
              </div>

              {/* Quick Sort Link */}
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span>Sorted by:</span>
                <span className="font-semibold text-text-primary">
                  {sortBy === "recently_published"
                    ? "Recently Added"
                    : sortBy === "vacancies_high_low"
                    ? "Highest Vacancies"
                    : "Closing Soonest"}
                </span>
              </div>
            </div>

            {/* Notification Card Responsive Grid */}
            <div
              id="category-results-grid"
              data-testid="category-grid"
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
              <div className="mt-10" data-testid="category-pagination">
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
          /* Empty State for Category */
          <div
            id="category-empty-state"
            data-testid="category-empty-state"
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
                <path strokeLinecap="round" strokeLinejoin="round" d={def.iconSvg} />
              </svg>
            </div>
            <h3 className="font-heading text-lg font-bold text-text-primary mb-2">
              No Active {def.name} Notifications Currently
            </h3>
            <p className="text-sm text-text-secondary max-w-md mb-6 leading-relaxed">
              There are currently no active public recruitment notifications in the {def.name} category. Check back soon or browse all active exams.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/"
                className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors shadow-sm"
              >
                Browse All Government Exams
              </Link>
              <Link
                href="/search"
                className="px-5 py-2.5 rounded-lg bg-surface-card hover:bg-surface-elevated text-text-primary text-sm font-semibold transition-colors border border-border"
              >
                Search Specific Exam
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
