/**
 * @file lib/analytics/posthog.ts
 * @description PostHog Product Analytics SDK initialization and client wrapper.
 * Manages client-side initialization, dynamic reverse-proxy host resolution, and user identification.
 * 
 * Task Reference: TASK-07020101 (SUB-0702010101)
 * Architecture Reference: ADR-013 (Observability & Analytics)
 */

import posthog, { PostHog } from 'posthog-js';

export const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
export const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let isInitialized = false;

/**
 * Initialize PostHog client in browser environment.
 * Safe to call multiple times (idempotent).
 */
export const initPostHog = (): PostHog | null => {
  if (typeof window === 'undefined') return null;

  if (isInitialized) {
    return posthog;
  }

  if (!POSTHOG_KEY) {
    return null;
  }

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only',
    capture_pageview: false, // Handled manually by Next.js navigation listener
    capture_pageleave: true,
    autocapture: true,
    persistence: 'localStorage+cookie',
    loaded: () => {
      isInitialized = true;
    },
  });

  isInitialized = true;
  return posthog;
};

/**
 * Capture an analytics event in PostHog if configured.
 */
export const capturePostHogEvent = (
  eventName: string,
  properties: Record<string, unknown> = {}
): void => {
  if (typeof window === 'undefined') return;
  if (!isInitialized) {
    initPostHog();
  }
  if (isInitialized && POSTHOG_KEY) {
    posthog.capture(eventName, properties);
  }
};

/**
 * Link an authenticated candidate session to PostHog person profile.
 */
export const identifyPostHogUser = (
  userId: string,
  traits: Record<string, unknown> = {}
): void => {
  if (typeof window === 'undefined') return;
  if (!isInitialized) {
    initPostHog();
  }
  if (isInitialized && POSTHOG_KEY) {
    posthog.identify(userId, traits);
  }
};

/**
 * Reset PostHog user session upon candidate logout.
 */
export const resetPostHogUser = (): void => {
  if (typeof window === 'undefined') return;
  if (isInitialized && POSTHOG_KEY) {
    posthog.reset();
  }
};

export { posthog };
