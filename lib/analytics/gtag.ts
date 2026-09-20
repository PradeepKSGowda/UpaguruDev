/**
 * @file lib/analytics/gtag.ts
 * @description Google Analytics 4 (GA4) client-side measurement library and types.
 * Safely wraps window.gtag dispatching with environment checks and error isolation.
 * 
 * Task Reference: TASK-07020101 (SUB-0702010101)
 * Architecture Reference: ADR-013 (Observability & Analytics)
 */

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[];
    gtag?: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date | Record<string, unknown>,
      config?: Record<string, unknown>
    ) => void;
  }
}

export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

/**
 * Check if Google Analytics is enabled and configured in current environment.
 */
export const isGAEnabled = (): boolean => {
  return typeof window !== 'undefined' && Boolean(GA_MEASUREMENT_ID);
};

/**
 * Track route changes and SPA page transitions in GA4.
 */
export const trackGAPageView = (url: string): void => {
  if (!isGAEnabled() || !window.gtag) return;
  window.gtag('config', GA_MEASUREMENT_ID, {
    page_path: url,
  });
};

/**
 * Send standard and custom behavioral events to GA4.
 */
export const trackGAEvent = (
  action: string,
  params: Record<string, unknown> = {}
): void => {
  if (!isGAEnabled() || !window.gtag) return;
  window.gtag('event', action, params);
};
