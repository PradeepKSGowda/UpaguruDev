/**
 * @file lib/utils.ts
 * @module AppUtilities
 * @description General helper utilities for date formatting, Indian numerical notation,
 * exam urgency calculations, and styling helpers.
 * 
 * Task ID: TASK-02020102
 * Architecture Reference: ADR-001 (Frontend RSC), ADR-008 (SEO)
 */

import type { ExamCategory } from "../types/notifications";

/**
 * Urgency status metadata for exam application deadlines
 */
export type UrgencyLevel = "expired" | "today" | "urgent" | "closing_soon" | "open";

export interface UrgencyMeta {
  level: UrgencyLevel;
  label: string;
  daysRemaining: number;
  badgeClass: string;
  pulseClass: string;
  isUrgent: boolean;
}

/**
 * Calculates calendar days remaining until the application deadline
 * and returns styled urgency tokens and animation classes.
 * 
 * @param endDateStr ISO or YYYY-MM-DD date string for application deadline
 * @returns UrgencyMeta object containing status, badge colors, and animation flags
 */
export function calculateDaysRemaining(endDateStr: string | null | undefined): UrgencyMeta {
  if (!endDateStr) {
    return {
      level: "open",
      label: "Dates Announced Soon",
      daysRemaining: 999,
      badgeClass: "bg-surface-elevated text-text-muted border-border",
      pulseClass: "",
      isUrgent: false,
    };
  }

  const targetDate = new Date(endDateStr);
  if (isNaN(targetDate.getTime())) {
    return {
      level: "open",
      label: "Refer Notification",
      daysRemaining: 999,
      badgeClass: "bg-surface-elevated text-text-muted border-border",
      pulseClass: "",
      isUrgent: false,
    };
  }

  // Pure calendar day difference calculated at midnight
  const now = new Date();
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  const diffTime = targetMidnight.getTime() - nowMidnight.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return {
      level: "expired",
      label: "Applications Closed",
      daysRemaining: diffDays,
      badgeClass: "bg-surface-elevated text-text-muted border-border/80 opacity-75",
      pulseClass: "",
      isUrgent: false,
    };
  }

  if (diffDays === 0) {
    return {
      level: "today",
      label: "Closes Today!",
      daysRemaining: 0,
      badgeClass: "bg-danger/10 text-danger border-danger/30 font-semibold",
      pulseClass: "animate-pulse ring-1 ring-danger/30",
      isUrgent: true,
    };
  }

  if (diffDays <= 5) {
    return {
      level: "urgent",
      label: `Closes in ${diffDays} day${diffDays > 1 ? "s" : ""}`,
      daysRemaining: diffDays,
      badgeClass: "bg-danger/10 text-danger border-danger/30 font-semibold",
      pulseClass: "animate-pulse ring-1 ring-danger/20",
      isUrgent: true,
    };
  }

  if (diffDays <= 15) {
    return {
      level: "closing_soon",
      label: `${diffDays} days left`,
      daysRemaining: diffDays,
      badgeClass: "bg-warning/10 text-warning border-warning/30 font-medium",
      pulseClass: "",
      isUrgent: false,
    };
  }

  return {
    level: "open",
    label: `${diffDays} days left`,
    daysRemaining: diffDays,
    badgeClass: "bg-success/10 text-success border-success/30 font-medium",
    pulseClass: "",
    isUrgent: false,
  };
}

/**
 * Formats a number according to Indian numerical formatting (e.g. 14,500)
 */
export function formatVacancies(count: number): string {
  if (!count || count <= 0) return "Not Specified";
  return count.toLocaleString("en-IN");
}

/**
 * Formats an ISO or date string into human-readable Indian standard format (e.g., 05 Mar 2026)
 */
export function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "TBD";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Returns human-readable label and styling classes for exam categories
 */
export function getCategoryBadge(category: ExamCategory): { label: string; badgeClass: string } {
  switch (category) {
    case "civil_services":
      return { label: "Civil Services", badgeClass: "bg-primary/10 text-primary border-primary/20" };
    case "banking":
      return { label: "Banking", badgeClass: "bg-accent/10 text-accent border-accent/20" };
    case "railways":
      return { label: "Railways", badgeClass: "bg-warning/10 text-warning border-warning/20" };
    case "defense":
      return { label: "Defence", badgeClass: "bg-danger/10 text-danger border-danger/20" };
    case "state_psc":
      return { label: "State PSC", badgeClass: "bg-secondary/10 text-secondary border-secondary/20" };
    case "teaching":
      return { label: "Teaching", badgeClass: "bg-primary-light/10 text-primary-light border-primary-light/20" };
    case "police":
      return { label: "Police", badgeClass: "bg-danger/10 text-danger border-danger/20" };
    case "other":
    default:
      return { label: "General", badgeClass: "bg-surface-elevated text-text-muted border-border" };
  }
}
