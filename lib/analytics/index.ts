/**
 * @file lib/analytics/index.ts
 * @description Central barrel export for UPA-GURU GA4 & PostHog product analytics.
 */

export * from './types';
export * from './gtag';
export * from './posthog';
export { useAnalytics } from '@/hooks/useAnalytics';
