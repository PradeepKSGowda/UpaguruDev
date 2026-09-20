'use client';

/**
 * @file components/analytics/AnalyticsProvider.tsx
 * @description Product Analytics Provider for Next.js 15 App Router.
 * Mounts Google Analytics 4 scripts and listens to SPA route transitions for PostHog and GA4 pageviews.
 * 
 * Task Reference: TASK-07020101 (SUB-0702010101)
 * Architecture Reference: ADR-001 (Frontend), ADR-013 (Observability & Analytics)
 */

import { useEffect, Suspense } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { GA_MEASUREMENT_ID, trackGAPageView } from '@/lib/analytics/gtag';
import { initPostHog, posthog } from '@/lib/analytics/posthog';

/**
 * Route change listener capturing client-side navigation transitions.
 * Wrapped in Suspense to satisfy Next.js 15 App Router static generation constraints.
 */
function AnalyticsPageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Initialize PostHog once on client mount
    initPostHog();
  }, []);

  useEffect(() => {
    if (!pathname) return;

    const queryString = searchParams?.toString();
    const fullUrl = queryString ? `${pathname}?${queryString}` : pathname;

    // 1. Report pageview to Google Analytics 4
    trackGAPageView(fullUrl);

    // 2. Report pageview to PostHog
    if (posthog.__loaded) {
      posthog.capture('$pageview', {
        $current_url: typeof window !== 'undefined' ? window.location.href : fullUrl,
        path: pathname,
        query: queryString,
      });
    }
  }, [pathname, searchParams]);

  return null;
}

export default function AnalyticsProvider() {
  return (
    <>
      {/* 1. Google Analytics 4 Script Integration */}
      {GA_MEASUREMENT_ID && (
        <>
          <Script
            id="ga4-script-loader"
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          />
          <Script
            id="ga4-inline-config"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_MEASUREMENT_ID}', {
                  page_path: window.location.pathname,
                  send_page_view: false
                });
              `,
            }}
          />
        </>
      )}

      {/* 2. Client-Side Pageview & PostHog Navigation Tracker */}
      <Suspense fallback={null}>
        <AnalyticsPageViewTracker />
      </Suspense>
    </>
  );
}
