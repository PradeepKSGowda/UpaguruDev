/**
 * @file components/admin/UserKpiCards.tsx
 * @description KPI Cards displaying user analytics: Total Users, Active Users, Verified Users, and Engagement.
 * 
 * Enhancement: ENH-RBAC-ADMIN-USER-PROFILE (ENH-0008)
 */

import React from "react";
import { Users, UserCheck, ShieldCheck, Bookmark, Sparkles } from "lucide-react";
import StatsCard from "./StatsCard";
import type { UserKpiStats } from "../../app/admin/users/actions";

interface UserKpiCardsProps {
  stats: UserKpiStats;
}

export default function UserKpiCards({ stats }: UserKpiCardsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatsCard
        testId="kpi-total-users"
        title="Total Registered Users"
        value={stats.totalUsers}
        description="All candidates and administrators on platform"
        icon={Users}
        colorScheme="blue"
        badgeText="All Time"
      />

      <StatsCard
        testId="kpi-active-users"
        title="Active Users"
        value={stats.activeUsers}
        description="Users with active session authentication"
        icon={UserCheck}
        colorScheme="emerald"
        badgeText="Active Status"
      />

      <StatsCard
        testId="kpi-verified-users"
        title="Verified Accounts"
        value={stats.verifiedUsers}
        description="Email address verified via OTP or OAuth"
        icon={ShieldCheck}
        colorScheme="purple"
        badgeText="Verified"
      />

      <StatsCard
        testId="kpi-candidate-engagement"
        title="Candidate Engagement"
        value={stats.totalBookmarks + stats.totalNotes}
        description="Total saved exams and personal study notes"
        icon={Bookmark}
        colorScheme="amber"
        badgeText="Workspace"
      />
    </div>
  );
}
