/**
 * @file tests/unit/syllabus-tracker.test.ts
 * @description Unit tests for Interactive Exam Syllabus & Subject Mastery Tracker.
 *
 * Enhancement: ENH-0011 (Interactive Exam Syllabus & Subject Mastery Tracker)
 */

import { describe, it, expect } from "vitest";
import {
  extractCanonicalSyllabus,
  mergeSyllabusWithProgress,
  calculateSyllabusMastery,
  DEFAULT_SYLLABUS_TEMPLATES,
  type MergedSyllabusTopic,
  type RawSyllabusTopicRecord,
} from "@/lib/syllabus/syllabus-tracker";
import {
  updateTopicProgressSchema,
  addCustomTopicSchema,
  deleteCustomTopicSchema,
  resetSyllabusProgressSchema,
} from "@/lib/schemas/syllabus-tracking";

describe("Syllabus Engine — extractCanonicalSyllabus", () => {
  it("returns category fallback template when syllabusSummary is null or undefined", () => {
    const syllabus = extractCanonicalSyllabus(null, "banking");
    expect(syllabus).toBeDefined();
    expect(syllabus["Reasoning Ability"]).toBeDefined();
    expect(syllabus["Reasoning Ability"].length).toBeGreaterThan(0);
    expect(syllabus["Quantitative Aptitude"]).toBeDefined();
  });

  it("returns civil services template for civil_services exam category", () => {
    const syllabus = extractCanonicalSyllabus({}, "civil_services");
    expect(syllabus["General Studies - Paper I"]).toBeDefined();
    expect(syllabus["CSAT / Aptitude - Paper II"]).toBeDefined();
  });

  it("extracts structured array topics from JSON", () => {
    const raw = {
      "General Studies": ["Indian History", "Indian Polity", "Geography"],
      "Aptitude Test": ["Data Interpretation", "Logical Reasoning"],
    };
    const extracted = extractCanonicalSyllabus(raw, "other");
    expect(extracted["General Studies"]).toEqual(["Indian History", "Indian Polity", "Geography"]);
    expect(extracted["Aptitude Test"]).toEqual(["Data Interpretation", "Logical Reasoning"]);
  });

  it("splits comma and bullet separated strings into distinct topics", () => {
    const raw = {
      "Subject A": "Topic 1, Topic 2; Topic 3\nTopic 4",
    };
    const extracted = extractCanonicalSyllabus(raw, "other");
    expect(extracted["Subject A"]).toContain("Topic 1");
    expect(extracted["Subject A"]).toContain("Topic 2");
    expect(extracted["Subject A"]).toContain("Topic 3");
    expect(extracted["Subject A"]).toContain("Topic 4");
  });
});

describe("Syllabus Engine — mergeSyllabusWithProgress", () => {
  const canonical = {
    "General Studies": ["Indian Polity", "Modern History", "Geography"],
  };

  it("merges persisted progress with canonical topics", () => {
    const persisted: RawSyllabusTopicRecord[] = [
      {
        id: "rec-1",
        subject_key: "General Studies",
        topic_title: "Indian Polity",
        status: "completed",
        revision_count: 2,
        confidence_level: 5,
        last_reviewed_at: "2026-09-20T10:00:00Z",
        notes: "Remember Article 21 and 32",
      },
    ];

    const merged = mergeSyllabusWithProgress(canonical, persisted);
    expect(merged.length).toBe(3);

    const polity = merged.find((t) => t.topicTitle === "Indian Polity");
    expect(polity?.status).toBe("completed");
    expect(polity?.revisionCount).toBe(2);
    expect(polity?.confidenceLevel).toBe(5);
    expect(polity?.notes).toBe("Remember Article 21 and 32");

    const history = merged.find((t) => t.topicTitle === "Modern History");
    expect(history?.status).toBe("not_started");
    expect(history?.revisionCount).toBe(0);
    expect(history?.confidenceLevel).toBe(1);
  });

  it("preserves custom user topics not present in canonical template", () => {
    const persisted: RawSyllabusTopicRecord[] = [
      {
        id: "custom-1",
        subject_key: "Custom Subject",
        topic_title: "State High Court Judgments",
        status: "in_progress",
        revision_count: 1,
        confidence_level: 4,
        last_reviewed_at: null,
        notes: null,
      },
    ];

    const merged = mergeSyllabusWithProgress(canonical, persisted);
    expect(merged.length).toBe(4); // 3 canonical + 1 custom

    const custom = merged.find((t) => t.topicTitle === "State High Court Judgments");
    expect(custom).toBeDefined();
    expect(custom?.isCustom).toBe(true);
    expect(custom?.status).toBe("in_progress");
  });
});

describe("Syllabus Engine — calculateSyllabusMastery", () => {
  it("calculates 0% mastery when all topics are not started", () => {
    const topics: MergedSyllabusTopic[] = [
      {
        subjectKey: "Math",
        topicTitle: "Algebra",
        status: "not_started",
        revisionCount: 0,
        confidenceLevel: 1,
        lastReviewedAt: null,
        notes: null,
      },
      {
        subjectKey: "Math",
        topicTitle: "Calculus",
        status: "not_started",
        revisionCount: 0,
        confidenceLevel: 1,
        lastReviewedAt: null,
        notes: null,
      },
    ];

    const mastery = calculateSyllabusMastery(topics);
    expect(mastery.totalTopics).toBe(2);
    expect(mastery.completedTopics).toBe(0);
    expect(mastery.notStartedTopics).toBe(2);
    expect(mastery.masteryPercentage).toBe(0);
  });

  it("calculates 100% mastery when all topics are completed", () => {
    const topics: MergedSyllabusTopic[] = [
      {
        subjectKey: "Math",
        topicTitle: "Algebra",
        status: "completed",
        revisionCount: 3,
        confidenceLevel: 5,
        lastReviewedAt: new Date().toISOString(),
        notes: null,
      },
      {
        subjectKey: "Math",
        topicTitle: "Calculus",
        status: "completed",
        revisionCount: 2,
        confidenceLevel: 5,
        lastReviewedAt: new Date().toISOString(),
        notes: null,
      },
    ];

    const mastery = calculateSyllabusMastery(topics);
    expect(mastery.masteryPercentage).toBe(100);
    expect(mastery.readinessScore).toBe(100);
    expect(mastery.dueForRevisionCount).toBe(0);
  });

  it("detects topics due for spaced-repetition revision (>7 days or needs_revision)", () => {
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

    const topics: MergedSyllabusTopic[] = [
      {
        subjectKey: "History",
        topicTitle: "Vedic Period",
        status: "completed",
        revisionCount: 1,
        confidenceLevel: 3,
        lastReviewedAt: eightDaysAgo,
        notes: null,
      },
      {
        subjectKey: "History",
        topicTitle: "Mughal Empire",
        status: "needs_revision",
        revisionCount: 0,
        confidenceLevel: 2,
        lastReviewedAt: twoDaysAgo,
        notes: null,
      },
      {
        subjectKey: "History",
        topicTitle: "Modern India",
        status: "completed",
        revisionCount: 1,
        confidenceLevel: 4,
        lastReviewedAt: twoDaysAgo,
        notes: null,
      },
    ];

    const mastery = calculateSyllabusMastery(topics);
    expect(mastery.dueForRevisionCount).toBe(2); // Vedic Period (>7 days) + Mughal Empire (needs_revision)
  });

  it("handles empty topic list gracefully", () => {
    const mastery = calculateSyllabusMastery([]);
    expect(mastery.totalTopics).toBe(0);
    expect(mastery.masteryPercentage).toBe(0);
    expect(mastery.readinessScore).toBe(0);
  });
});

describe("Syllabus Schemas — Validation", () => {
  const validUUID = "550e8400-e29b-41d4-a716-446655440000";

  it("validates updateTopicProgressSchema with valid fields", () => {
    const input = {
      notificationId: validUUID,
      subjectKey: "General Studies",
      topicTitle: "Fundamental Rights",
      status: "completed" as const,
      confidenceLevel: 4,
      revisionIncrement: true,
      notes: "High yield for prelims",
    };

    const parsed = updateTopicProgressSchema.parse(input);
    expect(parsed.status).toBe("completed");
    expect(parsed.revisionIncrement).toBe(true);
  });

  it("rejects invalid status", () => {
    const input = {
      notificationId: validUUID,
      subjectKey: "General Studies",
      topicTitle: "Fundamental Rights",
      status: "invalid_status",
    };

    expect(() => updateTopicProgressSchema.parse(input)).toThrow();
  });

  it("validates addCustomTopicSchema", () => {
    const input = {
      notificationId: validUUID,
      subjectKey: "Legal Studies",
      topicTitle: "Constitutional Law Amendments",
    };

    const parsed = addCustomTopicSchema.parse(input);
    expect(parsed.topicTitle).toBe("Constitutional Law Amendments");
  });

  it("validates resetSyllabusProgressSchema", () => {
    const input = {
      notificationId: validUUID,
    };

    const parsed = resetSyllabusProgressSchema.parse(input);
    expect(parsed.notificationId).toBe(validUUID);
  });
});
