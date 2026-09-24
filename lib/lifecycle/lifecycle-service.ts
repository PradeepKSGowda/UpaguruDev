/**
 * @file lib/lifecycle/lifecycle-service.ts
 * @description Pure evaluation engine for multi-phase examination lifecycles:
 * Notification -> Admit Card -> Exam Day -> Answer Key & Objections -> Result.
 *
 * Enhancement: ENH-0012 (Exam Lifecycle Automated Status Tracker)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-004 (Backend)
 */

import type { LifecycleEventType } from "@/lib/schemas/exam-lifecycle";

export interface RawLifecycleEvent {
  id: string;
  notification_id: string;
  event_type: LifecycleEventType;
  title: string;
  description: string | null;
  official_url: string | null;
  release_date: string;
  closing_date: string | null;
  metadata?: Record<string, unknown> | null;
  status: "draft" | "published" | "archived";
}

export type PhaseStatus = "completed" | "active" | "upcoming";

export interface LifecyclePhaseDetail {
  id: "notification" | "admit_card" | "exam_day" | "answer_key" | "result";
  title: string;
  subtitle: string;
  status: PhaseStatus;
  dateDisplay: string;
  closingDateDisplay: string | null;
  daysRemaining: number | null;
  isUrgent: boolean; // e.g. closing in <= 3 days
  officialUrl: string | null;
  eventRecord?: RawLifecycleEvent | null;
}

export interface ExamLifecycleTimelineSummary {
  notificationId: string;
  currentActivePhase: LifecyclePhaseDetail["id"];
  overallStatusLabel: string;
  phases: LifecyclePhaseDetail[];
  urgentAlert: {
    message: string;
    url: string | null;
    eventType: LifecycleEventType;
  } | null;
  events: RawLifecycleEvent[];
}

/**
 * Calculates days remaining from now until target date.
 */
export function calculateDaysRemaining(targetDateStr: string | null | undefined, now: Date = new Date()): number | null {
  if (!targetDateStr) return null;
  const target = new Date(targetDateStr);
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Constructs a full 5-phase timeline combining notification dates with published lifecycle events.
 */
export function buildExamLifecycleTimeline(
  notification: {
    id: string;
    title: string;
    applicationStartDate?: string | null;
    applicationEndDate?: string | null;
  },
  events: RawLifecycleEvent[],
  now: Date = new Date()
): ExamLifecycleTimelineSummary {
  const publishedEvents = events.filter((e) => e.status === "published");

  // Helper to find latest event of a given type
  const findLatest = (type: LifecycleEventType) =>
    publishedEvents
      .filter((e) => e.event_type === type)
      .sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime())[0] || null;

  const admitCardEvent = findLatest("admit_card");
  const examDateEvent = findLatest("exam_date");
  const answerKeyEvent = findLatest("answer_key") || findLatest("objection_window");
  const resultEvent = findLatest("result") || findLatest("cutoff_list");

  // 1. Notification / Application Phase
  const appEndDays = calculateDaysRemaining(notification.applicationEndDate, now);
  const isAppOpen = appEndDays !== null && appEndDays >= 0;
  const isAppPassed = appEndDays !== null && appEndDays < 0;

  const notificationPhase: LifecyclePhaseDetail = {
    id: "notification",
    title: "Application Window",
    subtitle: isAppOpen
      ? `Closes in ${appEndDays} day(s)`
      : isAppPassed
      ? "Applications Closed"
      : "Application Window Announced",
    status: isAppOpen ? "active" : "completed",
    dateDisplay: notification.applicationStartDate
      ? new Date(notification.applicationStartDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
      : "Announced",
    closingDateDisplay: notification.applicationEndDate
      ? new Date(notification.applicationEndDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
      : null,
    daysRemaining: appEndDays,
    isUrgent: isAppOpen && appEndDays <= 3,
    officialUrl: null,
  };

  // 2. Admit Card / Hall Ticket Phase
  const admitCardDays = admitCardEvent
    ? calculateDaysRemaining(admitCardEvent.closing_date, now)
    : null;
  const isAdmitCardActive =
    admitCardEvent !== null &&
    (admitCardDays === null || admitCardDays >= 0);

  const admitCardPhase: LifecyclePhaseDetail = {
    id: "admit_card",
    title: "Admit Card / Hall Ticket",
    subtitle: admitCardEvent
      ? admitCardDays !== null && admitCardDays <= 3
        ? `Download closes in ${admitCardDays} day(s)!`
        : "Hall Ticket Available"
      : "Awaiting Release",
    status: isAdmitCardActive
      ? "active"
      : admitCardEvent
      ? "completed"
      : "upcoming",
    dateDisplay: admitCardEvent
      ? new Date(admitCardEvent.release_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
      : "TBA",
    closingDateDisplay: admitCardEvent?.closing_date
      ? new Date(admitCardEvent.closing_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
      : null,
    daysRemaining: admitCardDays,
    isUrgent: isAdmitCardActive && admitCardDays !== null && admitCardDays <= 3,
    officialUrl: admitCardEvent?.official_url || null,
    eventRecord: admitCardEvent,
  };

  // 3. Examination Day Phase
  const examDays = examDateEvent
    ? calculateDaysRemaining(examDateEvent.release_date, now)
    : null;
  const isExamConducted = examDays !== null && examDays < 0;
  const isExamToday = examDays === 0;

  const examDayPhase: LifecyclePhaseDetail = {
    id: "exam_day",
    title: "Examination Day",
    subtitle: examDateEvent
      ? isExamToday
        ? "Exam Conducted Today!"
        : isExamConducted
        ? "Exam Completed"
        : `Exam in ${examDays} day(s)`
      : "Schedule Pending",
    status: isExamToday || (examDays !== null && examDays > 0 && examDays <= 7)
      ? "active"
      : isExamConducted
      ? "completed"
      : "upcoming",
    dateDisplay: examDateEvent
      ? new Date(examDateEvent.release_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
      : "TBA",
    closingDateDisplay: examDateEvent?.closing_date
      ? new Date(examDateEvent.closing_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
      : null,
    daysRemaining: examDays,
    isUrgent: examDays !== null && examDays >= 0 && examDays <= 3,
    officialUrl: examDateEvent?.official_url || null,
    eventRecord: examDateEvent,
  };

  // 4. Answer Key & Objections Phase
  const objectionDays = answerKeyEvent
    ? calculateDaysRemaining(answerKeyEvent.closing_date, now)
    : null;
  const isObjectionActive =
    answerKeyEvent !== null &&
    (objectionDays === null || objectionDays >= 0);

  const answerKeyPhase: LifecyclePhaseDetail = {
    id: "answer_key",
    title: "Answer Key & Objections",
    subtitle: answerKeyEvent
      ? isObjectionActive
        ? objectionDays !== null
          ? `Objections close in ${objectionDays} day(s)`
          : "Provisional Key Published"
        : "Objection Window Closed"
      : "Awaiting Release",
    status: isObjectionActive
      ? "active"
      : answerKeyEvent
      ? "completed"
      : "upcoming",
    dateDisplay: answerKeyEvent
      ? new Date(answerKeyEvent.release_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
      : "TBA",
    closingDateDisplay: answerKeyEvent?.closing_date
      ? new Date(answerKeyEvent.closing_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
      : null,
    daysRemaining: objectionDays,
    isUrgent: isObjectionActive && objectionDays !== null && objectionDays <= 3,
    officialUrl: answerKeyEvent?.official_url || null,
    eventRecord: answerKeyEvent,
  };

  // 5. Result & Merit List Phase
  const isResultOut = resultEvent !== null;

  const resultPhase: LifecyclePhaseDetail = {
    id: "result",
    title: "Results & Merit List",
    subtitle: isResultOut
      ? "Official Results Declared"
      : "Results Pending",
    status: isResultOut ? "active" : "upcoming",
    dateDisplay: resultEvent
      ? new Date(resultEvent.release_date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })
      : "TBA",
    closingDateDisplay: null,
    daysRemaining: null,
    isUrgent: false,
    officialUrl: resultEvent?.official_url || null,
    eventRecord: resultEvent,
  };

  const phases = [notificationPhase, admitCardPhase, examDayPhase, answerKeyPhase, resultPhase];

  // Determine current active phase & highest priority urgent alert
  let currentActivePhase: LifecyclePhaseDetail["id"] = "notification";
  let urgentAlert: ExamLifecycleTimelineSummary["urgentAlert"] = null;
  let overallStatusLabel = "Applications Open";

  if (isResultOut) {
    currentActivePhase = "result";
    overallStatusLabel = "Results Declared";
  } else if (isObjectionActive) {
    currentActivePhase = "answer_key";
    overallStatusLabel = "Answer Key & Objections Open";
    urgentAlert = {
      message: answerKeyPhase.subtitle,
      url: answerKeyPhase.officialUrl,
      eventType: "answer_key",
    };
  } else if (isExamConducted) {
    currentActivePhase = "exam_day";
    overallStatusLabel = "Exam Completed (Awaiting Key)";
  } else if (isAdmitCardActive) {
    currentActivePhase = "admit_card";
    overallStatusLabel = "Admit Card Out";
    urgentAlert = {
      message: `Hall ticket download active! ${admitCardPhase.subtitle}`,
      url: admitCardPhase.officialUrl,
      eventType: "admit_card",
    };
  } else if (isAppOpen) {
    currentActivePhase = "notification";
    overallStatusLabel = "Applications Open";
  } else {
    currentActivePhase = "admit_card";
    overallStatusLabel = "Applications Closed (Awaiting Hall Ticket)";
  }

  return {
    notificationId: notification.id,
    currentActivePhase,
    overallStatusLabel,
    phases,
    urgentAlert,
    events: publishedEvents,
  };
}
