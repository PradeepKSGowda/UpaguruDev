/**
 * @file components/admin/StatsCard.tsx
 * @description Reusable administrative KPI statistics card with color schemes,
 * micro-animations, linkable navigation, and test landmarks.
 * 
 * Task ID: TASK-03010102 (Subtask: SUB-0301010201)
 * Architecture Reference: ADR-001 (Frontend Architecture)
 */

import React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export type StatsCardColorScheme = "blue" | "amber" | "emerald" | "purple";

export interface StatsCardProps {
  /** Label describing the metric */
  title: string;
  /** Primary numeric or textual count display */
  value: number | string;
  /** Subtitle or contextual helper description */
  description?: string;
  /** Lucide icon component to render */
  icon: React.ComponentType<{ className?: string }>;
  /** Optional destination route when clicking the card */
  href?: string;
  /** Color theme accent */
  colorScheme?: StatsCardColorScheme;
  /** Testing identifier for automated testing */
  testId?: string;
  /** Optional alert tag or badge text (e.g. "Action Required", "Live") */
  badgeText?: string;
}

const COLOR_STYLES: Record<
  StatsCardColorScheme,
  {
    iconBg: string;
    iconColor: string;
    badgeBg: string;
    badgeColor: string;
    borderAccent: string;
    glow: string;
  }
> = {
  blue: {
    iconBg: "bg-blue-100 dark:bg-blue-950/60",
    iconColor: "text-blue-600 dark:text-blue-400",
    badgeBg: "bg-blue-50 dark:bg-blue-900/30",
    badgeColor: "text-blue-700 dark:text-blue-300",
    borderAccent: "hover:border-blue-300 dark:hover:border-blue-700",
    glow: "group-hover:shadow-blue-500/10",
  },
  amber: {
    iconBg: "bg-amber-100 dark:bg-amber-950/60",
    iconColor: "text-amber-600 dark:text-amber-400",
    badgeBg: "bg-amber-50 dark:bg-amber-900/30",
    badgeColor: "text-amber-700 dark:text-amber-300",
    borderAccent: "hover:border-amber-300 dark:hover:border-amber-700",
    glow: "group-hover:shadow-amber-500/10",
  },
  emerald: {
    iconBg: "bg-emerald-100 dark:bg-emerald-950/60",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    badgeBg: "bg-emerald-50 dark:bg-emerald-900/30",
    badgeColor: "text-emerald-700 dark:text-emerald-300",
    borderAccent: "hover:border-emerald-300 dark:hover:border-emerald-700",
    glow: "group-hover:shadow-emerald-500/10",
  },
  purple: {
    iconBg: "bg-purple-100 dark:bg-purple-950/60",
    iconColor: "text-purple-600 dark:text-purple-400",
    badgeBg: "bg-purple-50 dark:bg-purple-900/30",
    badgeColor: "text-purple-700 dark:text-purple-300",
    borderAccent: "hover:border-purple-300 dark:hover:border-purple-700",
    glow: "group-hover:shadow-purple-500/10",
  },
};

export default function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  href,
  colorScheme = "blue",
  testId,
  badgeText,
}: StatsCardProps) {
  const styles = COLOR_STYLES[colorScheme];

  const cardContent = (
    <div
      id={testId}
      className={`group relative rounded-2xl bg-white dark:bg-slate-900 p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm transition-all duration-200 hover:shadow-md ${styles.borderAccent} ${styles.glow}`}
    >
      <div className="flex items-center justify-between gap-3 mb-4">
        {/* Icon Container */}
        <div className={`p-3 rounded-xl ${styles.iconBg} ${styles.iconColor} transition-transform group-hover:scale-105`}>
          <Icon className="w-6 h-6" />
        </div>

        {/* Optional Badge or Arrow */}
        <div className="flex items-center gap-2">
          {badgeText && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${styles.badgeBg} ${styles.badgeColor}`}>
              {badgeText}
            </span>
          )}
          {href && (
            <div className="p-1 rounded-lg text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200 group-hover:bg-slate-100 dark:group-hover:bg-slate-800 transition">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          )}
        </div>
      </div>

      {/* Metric Content */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 tracking-tight">
          {title}
        </h3>
        <div className="text-3xl font-heading font-black text-slate-900 dark:text-white tracking-tight">
          {typeof value === "number" ? value.toLocaleString("en-IN") : value}
        </div>
        {description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
            {description}
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus:ring-2 focus:ring-blue-600 rounded-2xl">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}
