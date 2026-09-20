'use client';

/**
 * @file hooks/useAnalytics.ts
 * @description Universal product analytics hook combining GA4 and PostHog dispatching.
 * Provides type-safe action dispatchers for candidate searches, notification views,
 * filter selections, bookmarks, and outbound official link clicks.
 * 
 * Task Reference: TASK-07020101 (SUB-0702010102)
 * Architecture Reference: ADR-001, ADR-013
 */

import { useCallback } from 'react';
import { trackGAEvent } from '@/lib/analytics/gtag';
import {
  capturePostHogEvent,
  identifyPostHogUser,
  resetPostHogUser,
} from '@/lib/analytics/posthog';
import type {
  SearchPerformedProperties,
  NotificationViewedProperties,
  FilterAppliedProperties,
  OutboundClickProperties,
  BookmarkToggledProperties,
  SubscriptionUpdatedProperties,
} from '@/lib/analytics/types';

export function useAnalytics() {
  /**
   * Track general custom event across both GA4 and PostHog.
   */
  const trackEvent = useCallback(
    (eventName: string, properties: Record<string, unknown> = {}) => {
      // Dispatch to GA4
      trackGAEvent(eventName, properties);
      // Dispatch to PostHog
      capturePostHogEvent(eventName, properties);
    },
    []
  );

  /**
   * Track candidate search query execution.
   */
  const trackSearch = useCallback(
    (props: SearchPerformedProperties) => {
      trackEvent('search_performed', {
        search_term: props.query,
        query: props.query,
        results_count: props.results_count ?? 0,
        category: props.category,
        state: props.state,
        filter_count: props.filter_count ?? 0,
        timestamp: new Date().toISOString(),
      });
    },
    [trackEvent]
  );

  /**
   * Track candidate view of an exam notification detail page.
   */
  const trackNotificationView = useCallback(
    (props: NotificationViewedProperties) => {
      trackEvent('notification_viewed', {
        notification_id: props.notification_id,
        slug: props.slug,
        notification_title: props.title,
        category: props.category,
        state: props.state,
        total_vacancies: props.total_vacancies,
        source_portal: props.source_portal,
      });
    },
    [trackEvent]
  );

  /**
   * Track candidate applying filter criteria (category, state, qualification).
   */
  const trackFilterApplied = useCallback(
    (props: FilterAppliedProperties) => {
      trackEvent('filter_applied', {
        filter_type: props.filter_type,
        filter_value: props.filter_value,
        active_filters_count: props.active_filters_count,
      });
    },
    [trackEvent]
  );

  /**
   * Track outbound click to official portal or notification PDF.
   */
  const trackOutboundClick = useCallback(
    (props: OutboundClickProperties) => {
      trackEvent('outbound_click', {
        destination_url: props.url,
        target_type: props.target_type,
        notification_id: props.notification_id,
        notification_slug: props.notification_slug,
      });
    },
    [trackEvent]
  );

  /**
   * Track bookmark add or remove actions.
   */
  const trackBookmark = useCallback(
    (props: BookmarkToggledProperties) => {
      trackEvent('bookmark_toggled', {
        notification_id: props.notification_id,
        action: props.action,
        title: props.title,
      });
    },
    [trackEvent]
  );

  /**
   * Track candidate preference center subscription updates.
   */
  const trackSubscription = useCallback(
    (props: SubscriptionUpdatedProperties) => {
      trackEvent('subscription_updated', {
        channels: props.channels,
        categories: props.categories,
        states: props.states,
        exam_ids: props.exam_ids,
      });
    },
    [trackEvent]
  );

  /**
   * Identify authenticated candidate.
   */
  const identifyUser = useCallback(
    (userId: string, traits: Record<string, unknown> = {}) => {
      identifyPostHogUser(userId, traits);
    },
    []
  );

  /**
   * Reset candidate identity upon logout.
   */
  const resetUser = useCallback(() => {
    resetPostHogUser();
  }, []);

  return {
    trackEvent,
    trackSearch,
    trackNotificationView,
    trackFilterApplied,
    trackOutboundClick,
    trackBookmark,
    trackSubscription,
    identifyUser,
    resetUser,
  };
}
