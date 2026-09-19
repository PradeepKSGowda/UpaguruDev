/**
 * @file types/subscriptions.ts
 * @module SubscriptionTypes
 * @description Strongly-typed domain models, enum constants, and server action contracts
 * for Candidate Subscription Preference Center and Omnichannel Push Alert Engine.
 * 
 * Task ID: TASK-05010101
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-002 (Database), ADR-007 (Omnichannel Push Alert Engine)
 * 
 * Complies with:
 * - TypeScript strict mode (Zero `any`)
 * - Exact alignment with public.user_subscriptions database table
 * - WCAG-accessible form state interfaces
 */

import type { ExamCategoryEnum } from "./database.types";

export type NotificationChannel = "web_push" | "telegram" | "whatsapp" | "email";

export interface ChannelMetadata {
  id: NotificationChannel;
  label: string;
  description: string;
  badgeText: string;
  iconName: string;
  requiresExtraInput?: "telegramChatId" | "whatsappPhoneNumber";
  inputPlaceholder?: string;
  inputHelpText?: string;
}

export interface UserSubscription {
  id: string;
  userId: string;
  preferredChannels: NotificationChannel[];
  telegramChatId: string | null;
  whatsappPhoneNumber: string | null;
  fcmDeviceToken: string | null;
  subscribedExamIds: string[];
  subscribedCategories: ExamCategoryEnum[];
  subscribedStates: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionFormData {
  subscribedCategories: ExamCategoryEnum[];
  subscribedStates: string[];
  preferredChannels: NotificationChannel[];
  telegramChatId?: string;
  whatsappPhoneNumber?: string;
}

export interface SubscriptionActionResponse {
  success: boolean;
  message: string;
  subscription?: UserSubscription;
  errors?: Record<string, string[]>;
}
