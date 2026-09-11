/**
 * @file app/state/[state]/page.tsx
 * @module StateProgrammaticPage
 * @description Programmatic SEO landing page for Indian States, Union Territories, and Central Government
 * recruitments in UPA-GURU.
 * Renders state-filtered exam notifications, regional metadata, Schema.org JSON-LD schemas,
 * conducting PSC highlights, and regional cross-discovery links.
 * 
 * Task ID: TASK-02050102 (Subtask: SUB-0205010201)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-008 (Programmatic SEO & Structured Data)
 * 
 * Complies with:
 * - Next.js 15 App Router asynchronous params contract (`await params`)
 * - Pure React Server Component (0KB client bundle overhead)
 * - Static Site Generation (SSG) via generateStaticParams() for all 28 states, 8 UTs, and Central
 * - Incremental Static Regeneration (ISR revalidate = 3600s)
 * - Automatic 404 trigger for non-existent state slugs via notFound()
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

export interface StateRegionInfo {
  name: string;
  slug: string;
  type: "state" | "ut" | "central";
  pscName: string;
  region: "South" | "North" | "East" | "West" | "Central" | "North-East" | "Union Territory" | "All-India";
  popularExams: string[];
  description: string;
}

/**
 * Complete directory mapping all 28 Indian States, 8 Union Territories, and Central Government
 */
export const STATE_REGIONS_MAP: Record<string, StateRegionInfo> = {
  // Central / All-India
  central: {
    name: "Central",
    slug: "central",
    type: "central",
    pscName: "UPSC, SSC, RRB & IBPS",
    region: "All-India",
    popularExams: ["UPSC Civil Services", "SSC CGL", "RRB NTPC", "IBPS PO", "NDA & NA"],
    description: "Central Government examination notifications, All-India competitive recruitments across ministries, PSUs, armed forces, railways, and public sector banks.",
  },

  // 28 Indian States
  "andhra-pradesh": {
    name: "Andhra Pradesh",
    slug: "andhra-pradesh",
    type: "state",
    pscName: "APPSC (Andhra Pradesh Public Service Commission)",
    region: "South",
    popularExams: ["APPSC Group 1", "APPSC Group 2", "AP Police SI", "AP DSC Teacher"],
    description: "Official Andhra Pradesh state government jobs, APPSC notifications, police recruitment, teacher vacancies, and district-level recruitments.",
  },
  "arunachal-pradesh": {
    name: "Arunachal Pradesh",
    slug: "arunachal-pradesh",
    type: "state",
    pscName: "APPSC (Arunachal Pradesh PSC)",
    region: "North-East",
    popularExams: ["APPSC Combined Competitive", "Arunachal Police SI", "Arunachal Teacher Recruitment"],
    description: "Government exam notifications and employment alerts for the state of Arunachal Pradesh and APPSC administrative services.",
  },
  assam: {
    name: "Assam",
    slug: "assam",
    type: "state",
    pscName: "APSC (Assam Public Service Commission)",
    region: "North-East",
    popularExams: ["APSC Combined Competitive (CCE)", "Assam Police Constable", "Assam TET"],
    description: "Assam state government job alerts, APSC notifications, Assam Police recruitments, and departmental competitive examinations.",
  },
  bihar: {
    name: "Bihar",
    slug: "bihar",
    type: "state",
    pscName: "BPSC (Bihar Public Service Commission)",
    region: "East",
    popularExams: ["BPSC Combined Competitive", "BSSC CGL", "Bihar Police SI & Constable", "BPSC Teacher (TRE)"],
    description: "Bihar government recruitment notifications, BPSC civil services exams, BSSC vacancies, and state police recruitment schedules.",
  },
  chhattisgarh: {
    name: "Chhattisgarh",
    slug: "chhattisgarh",
    type: "state",
    pscName: "CGPSC (Chhattisgarh Public Service Commission)",
    region: "Central",
    popularExams: ["CGPSC State Service", "CG Vyapam Recruitment", "Chhattisgarh Police Constable"],
    description: "Chhattisgarh government job openings, CGPSC administrative recruitment notifications, and CG Vyapam examination announcements.",
  },
  goa: {
    name: "Goa",
    slug: "goa",
    type: "state",
    pscName: "GPSC (Goa Public Service Commission)",
    region: "West",
    popularExams: ["GPSC Junior Scale Officer", "Goa Police SI", "Goa Directorate of Education"],
    description: "Goa state government recruitment alerts, GPSC civil services exams, and departmental job openings across North and South Goa.",
  },
  gujarat: {
    name: "Gujarat",
    slug: "gujarat",
    type: "state",
    pscName: "GPSC (Gujarat Public Service Commission)",
    region: "West",
    popularExams: ["GPSC Class 1 & 2", "GSSSB CCE", "Gujarat Police Lokrakshak", "GSERC Teacher"],
    description: "Gujarat state recruitment alerts, GPSC civil services, GSSSB departmental openings, and Gujarat police constable recruitments.",
  },
  haryana: {
    name: "Haryana",
    slug: "haryana",
    type: "state",
    pscName: "HPSC & HSSC",
    region: "North",
    popularExams: ["HPSC HCS (Judicial & Executive)", "HSSC CET Group C & D", "Haryana Police Constable", "HTET"],
    description: "Haryana state government examination notifications, HPSC civil services, HSSC Common Eligibility Test (CET), and police recruitment.",
  },
  "himachal-pradesh": {
    name: "Himachal Pradesh",
    slug: "himachal-pradesh",
    type: "state",
    pscName: "HPPSC (Himachal Pradesh PSC)",
    region: "North",
    popularExams: ["HPPSC HAS (Himachal Administrative Service)", "HP Police Constable", "HP TET", "HP Forest Guard"],
    description: "Himachal Pradesh government notifications, HPPSC administrative competitive exams, teacher recruitments, and police department alerts.",
  },
  jharkhand: {
    name: "Jharkhand",
    slug: "jharkhand",
    type: "state",
    pscName: "JPSC & JSSC",
    region: "East",
    popularExams: ["JPSC Combined Civil Services", "JSSC CGL", "Jharkhand Police Constable", "JTET"],
    description: "Jharkhand state government recruitment alerts, JPSC state examinations, JSSC staff recruitment notifications, and police department vacancies.",
  },
  karnataka: {
    name: "Karnataka",
    slug: "karnataka",
    type: "state",
    pscName: "KPSC & KEA",
    region: "South",
    popularExams: ["KPSC Gazetted Probationers (KAS)", "KSP Police Sub-Inspector", "KEA Recruitment", "Karnataka TET"],
    description: "Karnataka government job notifications, KPSC Gazetted Probationers examination, Karnataka State Police (KSP) recruitment, and KEA exams.",
  },
  kerala: {
    name: "Kerala",
    slug: "kerala",
    type: "state",
    pscName: "Kerala PSC",
    region: "South",
    popularExams: ["Kerala PSC KAS", "Kerala Police CPO", "Kerala University Assistant", "KTET"],
    description: "Kerala Public Service Commission (Kerala PSC) examination notifications, KAS alerts, police recruitment, and school teaching vacancies.",
  },
  "madhya-pradesh": {
    name: "Madhya Pradesh",
    slug: "madhya-pradesh",
    type: "state",
    pscName: "MPPSC & MP ESB",
    region: "Central",
    popularExams: ["MPPSC State Service Exam", "MP Police Constable", "MP ESB Patwari", "MP TET"],
    description: "Madhya Pradesh state government exam notifications, MPPSC civil services, MP Police recruitment alerts, and MP ESB (Vyapam) recruitments.",
  },
  maharashtra: {
    name: "Maharashtra",
    slug: "maharashtra",
    type: "state",
    pscName: "MPSC (Maharashtra Public Service Commission)",
    region: "West",
    popularExams: ["MPSC Rajyaseva", "MPSC Combined Group B & C", "Maharashtra Police Bharti", "MahaTET"],
    description: "Maharashtra state government recruitment notifications, MPSC Rajyaseva examination, Maharashtra Police Bharti, and departmental recruitments.",
  },
  manipur: {
    name: "Manipur",
    slug: "manipur",
    type: "state",
    pscName: "Manipur PSC",
    region: "North-East",
    popularExams: ["Manipur PSC Civil Services", "Manipur Police SI", "Manipur TET"],
    description: "Manipur state government competitive examination notifications, Manipur PSC recruitments, and departmental employment updates.",
  },
  meghalaya: {
    name: "Meghalaya",
    slug: "meghalaya",
    type: "state",
    pscName: "Meghalaya PSC",
    region: "North-East",
    popularExams: ["Meghalaya PSC Civil Services", "Meghalaya Police Constable", "MTET"],
    description: "Meghalaya state government job openings, Meghalaya PSC announcements, and state police recruitment notifications.",
  },
  mizoram: {
    name: "Mizoram",
    slug: "mizoram",
    type: "state",
    pscName: "Mizoram PSC",
    region: "North-East",
    popularExams: ["Mizoram PSC Combined Competitive", "Mizoram Police SI", "Mizoram TET"],
    description: "Mizoram government recruitment alerts, Mizoram PSC notifications, and state administrative service vacancies.",
  },
  nagaland: {
    name: "Nagaland",
    slug: "nagaland",
    type: "state",
    pscName: "NPSC & NSSB",
    region: "North-East",
    popularExams: ["NPSC Civil Services (NCS/NPS)", "NSSB Group C", "Nagaland Police Recruitment"],
    description: "Nagaland state government examination notices, NPSC civil services, NSSB recruitment announcements, and police vacancies.",
  },
  odisha: {
    name: "Odisha",
    slug: "odisha",
    type: "state",
    pscName: "OPSC & OSSSC",
    region: "East",
    popularExams: ["OPSC Odisha Civil Services (OAS)", "OSSSC Combined Recruitment", "Odisha Police SI", "OTET"],
    description: "Odisha government job notifications, OPSC Odisha Civil Services, OSSSC examinations, and Odisha Police departmental alerts.",
  },
  punjab: {
    name: "Punjab",
    slug: "punjab",
    type: "state",
    pscName: "PPSC & PSSSB",
    region: "North",
    popularExams: ["PPSC Punjab Civil Services", "Punjab Police SI & Constable", "PSSSB Clerk", "PSTET"],
    description: "Punjab government examination alerts, PPSC civil services, PSSSB recruitment notices, and Punjab Police department updates.",
  },
  rajasthan: {
    name: "Rajasthan",
    slug: "rajasthan",
    type: "state",
    pscName: "RPSC & RSMSSB",
    region: "North",
    popularExams: ["RPSC RAS/RTS", "RSMSSB Patwari & CET", "Rajasthan Police Constable", "REET"],
    description: "Rajasthan state government recruitment notifications, RPSC RAS administrative examination, RSMSSB CET, and police vacancy announcements.",
  },
  sikkim: {
    name: "Sikkim",
    slug: "sikkim",
    type: "state",
    pscName: "SPSC (Sikkim Public Service Commission)",
    region: "North-East",
    popularExams: ["SPSC Under Secretary & DSP", "Sikkim Police Constable", "STET"],
    description: "Sikkim state government employment alerts, SPSC civil services competitive exams, and state departmental job announcements.",
  },
  "tamil-nadu": {
    name: "Tamil Nadu",
    slug: "tamil-nadu",
    type: "state",
    pscName: "TNPSC & TNUSRB",
    region: "South",
    popularExams: ["TNPSC Group 1", "TNPSC Group 2 & 2A", "TNPSC Group 4 & VAO", "TNUSRB Police SI", "TNTET"],
    description: "Tamil Nadu state government job alerts, TNPSC Group 1, 2, 4 examination notifications, TNUSRB police recruitments, and TRB educator vacancies.",
  },
  telangana: {
    name: "Telangana",
    slug: "telangana",
    type: "state",
    pscName: "TGPSC (Telangana Public Service Commission)",
    region: "South",
    popularExams: ["TGPSC Group 1", "TGPSC Group 2", "TGPSC Group 3 & 4", "TSLPRB Police SI", "TSTET"],
    description: "Telangana government recruitment notifications, TGPSC Group 1 and 2 exams, TSLPRB police recruitment notices, and DSC teacher jobs.",
  },
  tripura: {
    name: "Tripura",
    slug: "tripura",
    type: "state",
    pscName: "TPSC (Tripura Public Service Commission)",
    region: "North-East",
    popularExams: ["TPSC Tripura Civil Service (TCS/TPS)", "Tripura Police SI", "TTET"],
    description: "Tripura state government examination notifications, TPSC civil service exams, and state departmental recruitment announcements.",
  },
  "uttar-pradesh": {
    name: "Uttar Pradesh",
    slug: "uttar-pradesh",
    type: "state",
    pscName: "UPPSC & UPSSSC",
    region: "North",
    popularExams: ["UPPSC Combined State / Upper Subordinate (PCS)", "UPSSSC PET", "UP Police Constable & SI", "UPTET"],
    description: "Uttar Pradesh government recruitment notifications, UPPSC PCS civil services, UPSSSC PET exams, and massive UP Police recruitment updates.",
  },
  uttarakhand: {
    name: "Uttarakhand",
    slug: "uttarakhand",
    type: "state",
    pscName: "UKPSC & UKSSSC",
    region: "North",
    popularExams: ["UKPSC Combined State Civil / Upper Subordinate", "UKSSSC Graduate Level", "Uttarakhand Police SI", "UTET"],
    description: "Uttarakhand state government examination announcements, UKPSC civil services exams, UKSSSC vacancies, and state police recruitment.",
  },
  "west-bengal": {
    name: "West Bengal",
    slug: "west-bengal",
    type: "state",
    pscName: "WBPSC & WBPRB",
    region: "East",
    popularExams: ["WBPSC West Bengal Civil Service (WBCS)", "WBPRB Police SI & Constable", "WB Primary TET", "WBPSC Clerkship"],
    description: "West Bengal government job openings, WBPSC WBCS administrative examination, WBPRB police recruitments, and primary teacher recruitments.",
  },

  // 8 Union Territories
  "andaman-and-nicobar-islands": {
    name: "Andaman and Nicobar Islands",
    slug: "andaman-and-nicobar-islands",
    type: "ut",
    pscName: "Andaman & Nicobar Administration",
    region: "Union Territory",
    popularExams: ["A&N Police Recruitment", "Directorate of Education A&N", "A&N Secretariat Assistant"],
    description: "Andaman and Nicobar Islands Union Territory recruitment announcements, administrative vacancies, and police department alerts.",
  },
  chandigarh: {
    name: "Chandigarh",
    slug: "chandigarh",
    type: "ut",
    pscName: "Chandigarh Administration",
    region: "Union Territory",
    popularExams: ["Chandigarh Police Constable", "Chandigarh Education Department JBT", "Chandigarh Administration Clerk"],
    description: "Chandigarh Administration recruitment alerts, Chandigarh Police recruitment notices, and government school teacher appointments.",
  },
  "dadra-nagar-haveli-daman-diu": {
    name: "Dadra and Nagar Haveli and Daman and Diu",
    slug: "dadra-nagar-haveli-daman-diu",
    type: "ut",
    pscName: "DNHDD Administration",
    region: "Union Territory",
    popularExams: ["DNHDD Staff Selection Board", "DNHDD Police Recruitment", "DNHDD Teacher Vacancies"],
    description: "Dadra and Nagar Haveli and Daman and Diu Union Territory government job notifications and Staff Selection Board alerts.",
  },
  delhi: {
    name: "Delhi",
    slug: "delhi",
    type: "ut",
    pscName: "DSSSB (Delhi Subordinate Services Selection Board)",
    region: "Union Territory",
    popularExams: ["DSSSB TGT/PGT Teacher", "Delhi Police Constable & SI", "DSSSB Junior Assistant", "DSSSB Nursing Officer"],
    description: "Delhi NCT government job notifications, DSSSB examinations, teaching vacancies in Directorate of Education, and Delhi Police alerts.",
  },
  "jammu-and-kashmir": {
    name: "Jammu and Kashmir",
    slug: "jammu-and-kashmir",
    type: "ut",
    pscName: "JKPSC & JKSSB",
    region: "Union Territory",
    popularExams: ["JKPSC Combined Competitive (CCE)", "JKSSB Panchayat Secretary", "JK Police Sub-Inspector", "JKSSB Junior Assistant"],
    description: "Jammu & Kashmir Union Territory government examination alerts, JKPSC administrative services, and JKSSB recruitment notifications.",
  },
  ladakh: {
    name: "Ladakh",
    slug: "ladakh",
    type: "ut",
    pscName: "Ladakh Autonomous Hill Development Council",
    region: "Union Territory",
    popularExams: ["SSC Ladakh Selection Posts", "Ladakh Police Constable", "LAHDC District Cadre"],
    description: "Ladakh Union Territory recruitment announcements, SSC Ladakh selection posts, and Ladakh Police recruitment notices.",
  },
  lakshadweep: {
    name: "Lakshadweep",
    slug: "lakshadweep",
    type: "ut",
    pscName: "Lakshadweep Administration",
    region: "Union Territory",
    popularExams: ["Lakshadweep Police Recruitment", "Department of Education Lakshadweep"],
    description: "Lakshadweep Union Territory administrative alerts, departmental recruitment announcements, and government appointments.",
  },
  puducherry: {
    name: "Puducherry",
    slug: "puducherry",
    type: "ut",
    pscName: "Puducherry PSC / Recruitment Cell",
    region: "Union Territory",
    popularExams: ["Puducherry Police Constable", "Puducherry Upper Division Clerk (UDC)", "Puducherry Teacher Recruitment"],
    description: "Puducherry Union Territory government job notifications, administrative recruitment exams, and public sector employment alerts.",
  },
};

/**
 * Pre-renders all 37 official state, UT, and central routes at build time (SSG)
 */
export async function generateStaticParams() {
  return Object.values(STATE_REGIONS_MAP).map((region) => ({
    state: region.slug,
  }));
}

interface PageProps {
  params: Promise<{ state: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * Dynamic Metadata Generator for State Programmatic SEO
 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { state: stateSlug } = await params;
  const info = STATE_REGIONS_MAP[stateSlug];

  if (!info) {
    return {
      title: "State Not Found | UPA-GURU",
      description: "The requested state or regional exam page does not exist.",
      robots: { index: false, follow: false },
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in";
  const canonicalUrl = `${siteUrl}/state/${info.slug}`;
  const title = `${info.name} Government Exams & Recruitment 2026 - UPA-GURU`;
  const metaDescription = `Latest ${info.name} government job notifications, ${info.pscName} exam alerts, eligibility, vacancies, and application deadlines on UPA-GURU.`;

  return {
    title,
    description: metaDescription,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description: metaDescription,
      url: canonicalUrl,
      siteName: "UPA-GURU",
      type: "website",
      locale: "en_IN",
      images: [
        {
          url: `${siteUrl}/api/og?state=${info.slug}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: metaDescription,
    },
  };
}

export default async function StatePage({ params, searchParams }: PageProps) {
  const { state: stateSlug } = await params;
  const info = STATE_REGIONS_MAP[stateSlug];

  // Validate state slug against registered Indian regions
  if (!info) {
    notFound();
  }

  const resolvedParams = await searchParams;
  const page = typeof resolvedParams?.page === "string" ? parseInt(resolvedParams.page, 10) || 1 : 1;
  const sortBy = typeof resolvedParams?.sortBy === "string" ? (resolvedParams.sortBy as NotificationSortBy) : "deadline_soonest";
  const category = typeof resolvedParams?.category === "string" ? (resolvedParams.category as ExamCategory) : undefined;

  // Query notifications filtered by the canonical state name
  const paginatedResult = await getPublishedNotifications({
    state: info.name,
    category,
    page,
    pageSize: 12,
    sortBy,
  });

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://upaguru.in";
  const canonicalUrl = `${siteUrl}/state/${info.slug}`;

  // Breadcrumbs
  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "States & Regions", href: "/#states" },
    { label: info.name, isCurrent: true },
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
        name: "States & Regions",
        item: `${siteUrl}/#states`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: info.name,
        item: canonicalUrl,
      },
    ],
  };

  const collectionPageSchema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${info.name} Government Exams & Recruitment 2026 - UPA-GURU`,
    description: info.description,
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

  // Get neighboring / regional states for internal link graph
  const regionalPeers = Object.values(STATE_REGIONS_MAP).filter(
    (item) => item.slug !== info.slug && (item.region === info.region || info.type === "central")
  ).slice(0, 8);

  return (
    <div
      id="state-page-container"
      data-testid="state-page"
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
        <div data-testid="state-breadcrumb">
          <Breadcrumb items={breadcrumbItems} />
        </div>
      </div>

      {/* State Hero Header Section */}
      <section
        id="state-hero-section"
        data-testid="state-hero"
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-8"
      >
        <div className="relative rounded-2xl bg-gradient-to-br from-surface-elevated/90 to-surface-card/90 border border-border p-6 sm:p-8 lg:p-10 shadow-sm overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            {/* Region Badge & Live Counters */}
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>
                  {info.type === "central"
                    ? "Central Government / All-India"
                    : info.type === "ut"
                    ? `Union Territory • ${info.region}`
                    : `State • ${info.region} India`}
                </span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-base border border-border text-xs text-text-secondary font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <strong className="text-text-primary">{paginatedResult.total}</strong> Active Notifications
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-base border border-border text-xs text-text-muted">
                Agency: <span className="text-text-secondary font-medium">{info.pscName}</span>
              </span>
            </div>

            {/* Page H1: State Name Government Exams & Recruitment */}
            <h1
              data-testid="state-h1"
              className="font-heading text-2xl sm:text-3xl lg:text-4xl font-extrabold text-text-primary tracking-tight leading-tight mb-3"
            >
              {info.name} Government Exams & Recruitment 2026 - UPA-GURU
            </h1>

            {/* State Description */}
            <p className="text-text-secondary text-sm sm:text-base max-w-3xl leading-relaxed mb-6">
              {info.description}
            </p>

            {/* Popular State Exam Keywords */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider mr-1">
                Popular in {info.name}:
              </span>
              {info.popularExams.map((examName) => (
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

      {/* Regional States Cross-Discovery Bar */}
      {regionalPeers.length > 0 && (
        <section
          id="regional-states-section"
          data-testid="regional-states-links"
          className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8"
        >
          <div className="flex items-center justify-between gap-4 pb-2 border-b border-border">
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Explore Other {info.type === "central" ? "Major" : `${info.region} India`} States & UTs
            </h2>
            <Link
              href="/#states"
              className="text-xs font-semibold text-primary hover:underline"
            >
              View All 36 States & UTs →
            </Link>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto py-3 no-scrollbar">
            {regionalPeers.map((peer) => (
              <Link
                key={peer.slug}
                href={`/state/${peer.slug}`}
                className="flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium bg-surface-elevated hover:bg-surface-card text-text-secondary hover:text-text-primary border border-border transition-all"
              >
                {peer.name}
              </Link>
            ))}
          </div>
        </section>
      )}

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
                notifications in {info.name}
              </div>

              {/* Sort Order Display */}
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
              id="state-results-grid"
              data-testid="state-grid"
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
              <div className="mt-10" data-testid="state-pagination">
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
          /* Empty State for State / UT */
          <div
            id="state-empty-state"
            data-testid="state-empty-state"
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h3 className="font-heading text-lg font-bold text-text-primary mb-2">
              No Active Recruitment Notifications for {info.name}
            </h3>
            <p className="text-sm text-text-secondary max-w-md mb-6 leading-relaxed">
              There are currently no active public exam notifications specifically listed for {info.name}. You can explore Central All-India opportunities or browse all government exams.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/state/central"
                className="px-5 py-2.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors shadow-sm"
              >
                View Central Government Exams
              </Link>
              <Link
                href="/"
                className="px-5 py-2.5 rounded-lg bg-surface-card hover:bg-surface-elevated text-text-primary text-sm font-semibold transition-colors border border-border"
              >
                Browse All Exams
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
