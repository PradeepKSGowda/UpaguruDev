/**
 * @file tests/unit/exam-lifecycle.test.ts
 * @description Unit tests for Exam Lifecycle Automated Status Tracker
 * (Admit Card, Exam Day, Answer Key, Objections, Results).
 *
 * Enhancement: ENH-0012 (Exam Lifecycle Automated Status Tracker)
 */

import { describe, it, expect } from "vitest";
import {
  calculateDaysRemaining,
  buildExamLifecycleTimeline,
  type RawLifecycleEvent,
} from "@/lib/lifecycle/lifecycle-service";
import {
  createLifecycleEventSchema,
  filterLifecycleEventsSchema,
} from "@/lib/schemas/exam-lifecycle";

describe("Exam Lifecycle — calculateDaysRemaining", () => {
  const baseNow = new Date("2026-09-24T12:00:00Z");

  it("returns null when date is null or undefined", () => {
    expect(calculateDaysRemaining(null, baseNow)).toBeNull();
    expect(calculateDaysRemaining(undefined, baseNow)).toBeNull();
  });

  it("calculates positive days for future date", () => {
    const futureDate = "2026-09-27T12:00:00Z"; // 3 days ahead
    expect(calculateDaysRemaining(futureDate, baseNow)).toBe(3);
  });

  it("calculates negative days for past date", () => {
    const pastDate = "2026-09-20T12:00:00Z"; // 4 days ago
    expect(calculateDaysRemaining(pastDate, baseNow)).toBe(-4);
  });

  it("calculates 0 for today", () => {
    const sameDay = "2026-09-24T12:00:00Z";
    expect(calculateDaysRemaining(sameDay, baseNow)).toBe(0);
  });
});

describe("Exam Lifecycle — buildExamLifecycleTimeline", () => {
  const baseNow = new Date("2026-09-24T12:00:00Z");

  const baseNotification = {
    id: "notif-001",
    title: "KPSC Gazetted Probationers 2026",
    applicationStartDate: "2026-08-01T00:00:00Z",
    applicationEndDate: "2026-09-15T23:59:59Z", // closed
  };

  it("builds default 5-phase timeline when no extra events exist", () => {
    const timeline = buildExamLifecycleTimeline(baseNotification, [], baseNow);
    expect(timeline.phases.length).toBe(5);
    expect(timeline.phases[0]?.id).toBe("notification");
    expect(timeline.phases[0]?.status).toBe("completed"); // closed on Sep 15
    expect(timeline.phases[1]?.id).toBe("admit_card");
    expect(timeline.phases[1]?.status).toBe("upcoming");
    expect(timeline.currentActivePhase).toBe("admit_card");
  });

  it("marks admit card phase as active with urgent alert when closing in 2 days", () => {
    const events: RawLifecycleEvent[] = [
      {
        id: "evt-1",
        notification_id: "notif-001",
        event_type: "admit_card",
        title: "Prelims Hall Ticket Released",
        description: "Download hall ticket using your application number",
        official_url: "https://kpsc.kar.nic.in/hallticket",
        release_date: "2026-09-20T00:00:00Z",
        closing_date: "2026-09-26T23:59:59Z", // 2 days away
        status: "published",
      },
    ];

    const timeline = buildExamLifecycleTimeline(baseNotification, events, baseNow);
    expect(timeline.currentActivePhase).toBe("admit_card");
    expect(timeline.overallStatusLabel).toBe("Admit Card Out");
    expect(timeline.urgentAlert).toBeDefined();
    expect(timeline.urgentAlert?.eventType).toBe("admit_card");
    expect(timeline.phases[1]?.isUrgent).toBe(true);
    expect(timeline.phases[1]?.officialUrl).toBe("https://kpsc.kar.nic.in/hallticket");
  });

  it("advances to answer_key phase when answer key event is published", () => {
    const events: RawLifecycleEvent[] = [
      {
        id: "evt-1",
        notification_id: "notif-001",
        event_type: "admit_card",
        title: "Admit Card",
        description: null,
        official_url: null,
        release_date: "2026-09-10T00:00:00Z",
        closing_date: "2026-09-15T00:00:00Z",
        status: "published",
      },
      {
        id: "evt-2",
        notification_id: "notif-001",
        event_type: "exam_date",
        title: "Exam Conducted",
        description: null,
        official_url: null,
        release_date: "2026-09-16T00:00:00Z",
        closing_date: null,
        status: "published",
      },
      {
        id: "evt-3",
        notification_id: "notif-001",
        event_type: "answer_key",
        title: "Provisional Answer Key Out",
        description: "Submit objections before deadline",
        official_url: "https://kpsc.kar.nic.in/objections",
        release_date: "2026-09-22T00:00:00Z",
        closing_date: "2026-09-28T23:59:59Z",
        status: "published",
      },
    ];

    const timeline = buildExamLifecycleTimeline(baseNotification, events, baseNow);
    expect(timeline.currentActivePhase).toBe("answer_key");
    expect(timeline.overallStatusLabel).toBe("Answer Key & Objections Open");
    expect(timeline.phases[3]?.status).toBe("active");
  });

  it("advances to result phase when result event is published", () => {
    const events: RawLifecycleEvent[] = [
      {
        id: "evt-4",
        notification_id: "notif-001",
        event_type: "result",
        title: "Prelims 2026 Merit List & Cutoffs",
        description: "Official shortlisted candidates for Mains",
        official_url: "https://kpsc.kar.nic.in/results/prelims-2026.pdf",
        release_date: "2026-09-24T00:00:00Z",
        closing_date: null,
        status: "published",
      },
    ];

    const timeline = buildExamLifecycleTimeline(baseNotification, events, baseNow);
    expect(timeline.currentActivePhase).toBe("result");
    expect(timeline.overallStatusLabel).toBe("Results Declared");
    expect(timeline.phases[4]?.status).toBe("active");
    expect(timeline.phases[4]?.officialUrl).toBe("https://kpsc.kar.nic.in/results/prelims-2026.pdf");
  });
});

describe("Exam Lifecycle Schemas — Validation", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";

  it("validates createLifecycleEventSchema with valid data", () => {
    const input = {
      notificationId: validUUID,
      eventType: "admit_card" as const,
      title: "UPSC CSE 2026 E-Admit Card Released",
      description: "Download using Registration ID or Roll Number",
      officialUrl: "https://upsconline.nic.in/eadmitcard",
      releaseDate: new Date().toISOString(),
      closingDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const parsed = createLifecycleEventSchema.parse(input);
    expect(parsed.eventType).toBe("admit_card");
    expect(parsed.title).toBe("UPSC CSE 2026 E-Admit Card Released");
  });

  it("rejects invalid event type", () => {
    const input = {
      notificationId: validUUID,
      eventType: "invalid_stage",
      title: "Some Title",
    };

    expect(() => createLifecycleEventSchema.parse(input)).toThrow();
  });

  it("validates filterLifecycleEventsSchema with defaults", () => {
    const parsed = filterLifecycleEventsSchema.parse({});
    expect(parsed.status).toBe("published");
    expect(parsed.limit).toBe(20);
  });
});
