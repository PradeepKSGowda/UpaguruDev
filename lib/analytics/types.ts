/**
 * @file lib/analytics/types.ts
 * @description TypeScript interface contracts for UPA-GURU GA4 & PostHog product analytics.
 * Enforces type safety across all tracked candidate actions, searches, and navigation events.
 * 
 * Task Reference: TASK-07020101 (SUB-0702010101, SUB-0702010102)
 * Architecture Reference: ADR-001 (Frontend), ADR-013 (Observability & Analytics)
 */

export interface SearchPerformedProperties {
  query: string;
  results_count?: number;
  category?: string;
  state?: string;
  filter_count?: number;
  timestamp?: string;
}

export interface NotificationViewedProperties {
  notification_id: string;
  slug: string;
  title: string;
  category?: string;
  state?: string;
  total_vacancies?: number;
  source_portal?: string;
}

export interface FilterAppliedProperties {
  filter_type: 'category' | 'state' | 'qualification' | 'status' | 'sort';
  filter_value: string;
  active_filters_count?: number;
}

export interface OutboundClickProperties {
  url: string;
  target_type: 'official_notification_pdf' | 'apply_online_portal' | 'official_website';
  notification_id?: string;
  notification_slug?: string;
}

export interface BookmarkToggledProperties {
  notification_id: string;
  action: 'added' | 'removed';
  title?: string;
}

export interface SubscriptionUpdatedProperties {
  channels: string[];
  categories: string[];
  states?: string[];
  exam_ids?: string[];
}

export type AnalyticsEvent =
  | { name: 'search_performed'; properties: SearchPerformedProperties }
  | { name: 'notification_viewed'; properties: NotificationViewedProperties }
  | { name: 'filter_applied'; properties: FilterAppliedProperties }
  | { name: 'outbound_click'; properties: OutboundClickProperties }
  | { name: 'bookmark_toggled'; properties: BookmarkToggledProperties }
  | { name: 'subscription_updated'; properties: SubscriptionUpdatedProperties }
  | { name: 'page_view'; properties: { path: string; title?: string; referrer?: string } };
