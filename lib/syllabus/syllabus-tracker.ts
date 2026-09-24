/**
 * @file lib/syllabus/syllabus-tracker.ts
 * @description Core calculation and parsing engine for interactive exam syllabus
 * progress and subject mastery tracking.
 *
 * Enhancement: ENH-0011 (Interactive Exam Syllabus & Subject Mastery Tracker)
 * Architecture Reference: ADR-001 (App Router RSC), ADR-004 (Backend)
 */

import type { TopicStatus } from "@/lib/schemas/syllabus-tracking";

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface RawSyllabusTopicRecord {
  id?: string;
  subject_key: string;
  topic_title: string;
  status: TopicStatus;
  revision_count: number;
  confidence_level: number;
  last_reviewed_at: string | null;
  notes: string | null;
}

export interface MergedSyllabusTopic {
  id?: string;
  subjectKey: string;
  topicTitle: string;
  status: TopicStatus;
  revisionCount: number;
  confidenceLevel: number;
  lastReviewedAt: string | null;
  notes: string | null;
  isCustom?: boolean;
}

export interface SubjectProgressBreakdown {
  subjectKey: string;
  totalTopics: number;
  completedTopics: number;
  inProgressTopics: number;
  needsRevisionTopics: number;
  notStartedTopics: number;
  masteryPercentage: number;
  topics: MergedSyllabusTopic[];
}

export interface SyllabusMasterySummary {
  totalTopics: number;
  completedTopics: number;
  inProgressTopics: number;
  needsRevisionTopics: number;
  notStartedTopics: number;
  masteryPercentage: number;
  readinessScore: number; // 0-100 composite score
  dueForRevisionCount: number;
  subjects: SubjectProgressBreakdown[];
}

// ─── Canonical Default Templates by Exam Category ───────────────────────────

export const DEFAULT_SYLLABUS_TEMPLATES: Record<string, Record<string, string[]>> = {
  civil_services: {
    "General Studies - Paper I": [
      "Current Events of National and International Importance",
      "History of India and Indian National Movement",
      "Indian and World Geography - Physical, Social, Economic",
      "Indian Polity and Governance - Constitution, Political System, Panchayati Raj",
      "Economic and Social Development - Sustainable Development, Poverty, Inclusion",
      "General Issues on Environmental Ecology, Bio-diversity and Climate Change",
      "General Science and Technological Developments",
    ],
    "CSAT / Aptitude - Paper II": [
      "Reading Comprehension",
      "Interpersonal Skills including Communication Skills",
      "Logical Reasoning and Analytical Ability",
      "Decision Making and Problem Solving",
      "General Mental Ability",
      "Basic Numeracy (Class X level)",
      "Data Interpretation (Charts, graphs, tables)",
    ],
  },
  state_psc: {
    "General Studies & State Heritage": [
      "State History, Culture, and Heritage",
      "State Administrative Structure & Panchayati Raj",
      "Indian Constitution & Public Administration",
      "State Geography & Natural Resources",
      "State Economy & Rural Development Initiatives",
      "General Science & Everyday Technology",
      "Current Affairs of State & National Importance",
    ],
    "General Mental Ability & Language": [
      "Logical Reasoning & Analytical Ability",
      "Numerical Ability & Problem Solving",
      "Regional Language Comprehension & Grammar",
      "General English Grammar & Vocabulary",
      "Computer Literacy & Digital Awareness",
    ],
  },
  banking: {
    "Reasoning Ability": [
      "Syllogisms & Logical Venn Diagrams",
      "Puzzles & Seating Arrangement",
      "Coding-Decoding & Machine Input-Output",
      "Blood Relations & Direction Sense",
      "Inequalities & Data Sufficiency",
    ],
    "Quantitative Aptitude": [
      "Simplification & Approximation",
      "Data Interpretation (Bar, Pie, Radar, Caselet)",
      "Arithmetic (Percentage, Profit & Loss, Ratio, Average)",
      "Time & Work, Pipes & Cisterns",
      "Speed, Time & Distance, Trains & Boats",
      "Number Series & Quadratic Equations",
    ],
    "General & Financial Awareness": [
      "Current Financial & Banking Affairs",
      "RBI Monetary Policy & Banking Regulations",
      "Government Schemes & Budget Highlights",
      "Static GK (Capital, Currency, Headquarters)",
    ],
    "English Language": [
      "Reading Comprehension & Cloze Test",
      "Error Detection & Phrase Replacement",
      "Para Jumbles & Sentence Rearrangement",
      "Vocabulary & Fillers",
    ],
  },
  railways: {
    "Mathematics": [
      "Number System, BODMAS & Decimals",
      "LCM & HCF, Ratio & Proportion",
      "Percentages, Mensuration, Time & Work",
      "Simple & Compound Interest, Profit & Loss",
      "Algebra, Geometry & Trigonometry",
    ],
    "General Intelligence & Reasoning": [
      "Analogies & Alphabetical Number Series",
      "Coding-Decoding & Mathematical Operations",
      "Relationships, Syllogisms & Venn Diagrams",
      "Data Interpretation & Sufficiency",
      "Analytical Reasoning & Classification",
    ],
    "General Science": [
      "Physics (Class X standard)",
      "Chemistry (Class X standard)",
      "Life Sciences / Biology (Class X standard)",
    ],
    "General Awareness": [
      "Current Affairs in Science & Tech, Sports, Culture",
      "Indian History, Geography & Economics",
      "Indian Polity & Constitution",
    ],
  },
  police: {
    "General Knowledge & Law Awareness": [
      "Indian Constitution & Fundamental Rights",
      "Police Administration & Human Rights",
      "Indian Penal Code & Criminal Procedure Basics",
      "Current Events of National & State Importance",
      "Geography & History of the State",
    ],
    "Mental Ability & Aptitude": [
      "Arithmetic & Problem Solving",
      "Logical Reasoning & Pattern Matching",
      "Spatial Orientation & Observation",
      "Language Ability & Comprehension",
    ],
  },
  defense: {
    "Mathematics": [
      "Arithmetic, Algebra & Trigonometry",
      "Geometry, Mensuration & Statistics",
      "Probability & Vectors",
    ],
    "General Ability Test": [
      "English Grammar & Comprehension",
      "Physics & Chemistry Fundamentals",
      "General Science, Social Studies, Geography",
      "Current National & Defense Events",
    ],
  },
  teaching: {
    "Child Development & Pedagogy": [
      "Child Development Principles & Theories",
      "Inclusive Education & Understanding Children with Special Needs",
      "Learning and Pedagogy Methodologies",
    ],
    "Language & Subject Content": [
      "Language I (Proficiency & Grammar)",
      "Language II (Comprehension & Vocabulary)",
      "Subject Matter Pedagogy (Mathematics / Science / Social)",
    ],
  },
  other: {
    "General Studies & Aptitude": [
      "General Awareness & Current Affairs",
      "Numerical & Quantitative Ability",
      "Logical & Analytical Reasoning",
      "General English & Language Proficiency",
      "Basic Computer & Office Applications",
    ],
  },
};

// ─── Parsing & Normalization ────────────────────────────────────────────────

/**
 * Parses raw notification syllabus summary JSON into structured subjects and topics.
 * If raw summary is missing or empty, returns standard category defaults.
 */
export function extractCanonicalSyllabus(
  syllabusSummary: unknown,
  examCategory: string = "other"
): Record<string, string[]> {
  const normalizedCategory = examCategory.toLowerCase().trim();
  const fallback = DEFAULT_SYLLABUS_TEMPLATES[normalizedCategory] || DEFAULT_SYLLABUS_TEMPLATES.other;

  if (!syllabusSummary || typeof syllabusSummary !== "object") {
    return fallback;
  }

  const result: Record<string, string[]> = {};
  const entries = Object.entries(syllabusSummary as Record<string, unknown>);

  if (entries.length === 0) {
    return fallback;
  }

  for (const [key, val] of entries) {
    const trimmedKey = key.trim() || "General Subject";
    if (Array.isArray(val)) {
      const topicList = val
        .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
        .map((t) => t.trim());
      if (topicList.length > 0) {
        result[trimmedKey] = topicList;
      }
    } else if (typeof val === "string" && val.trim().length > 0) {
      // Split by newlines, semicolons, bullets, commas, or numbered list indicators (e.g. "1. ")
      const splitTopics = val
        .split(/(?:\r?\n|;|•|(?:\s*\d+\.\s*)|,)/)
        .map((t) => t.trim())
        .filter((t) => t.length > 2 && !/^(and|or|the|in|of)$/i.test(t));

      if (splitTopics.length > 0) {
        result[trimmedKey] = Array.from(new Set(splitTopics));
      } else {
        result[trimmedKey] = [val.trim()];
      }
    }
  }

  return Object.keys(result).length > 0 ? result : fallback;
}

/**
 * Merges canonical syllabus structure with candidate's persisted progress.
 * Also preserves any user-added custom topics that were saved to the DB.
 */
export function mergeSyllabusWithProgress(
  canonicalSyllabus: Record<string, string[]>,
  persistedRecords: RawSyllabusTopicRecord[]
): MergedSyllabusTopic[] {
  const recordMap = new Map<string, RawSyllabusTopicRecord>();

  for (const rec of persistedRecords) {
    const key = `${rec.subject_key.toLowerCase()}:::${rec.topic_title.toLowerCase()}`;
    recordMap.set(key, rec);
  }

  const merged: MergedSyllabusTopic[] = [];
  const processedKeys = new Set<string>();

  // 1. Process canonical topics
  for (const [subjectKey, topics] of Object.entries(canonicalSyllabus)) {
    for (const topicTitle of topics) {
      const compositeKey = `${subjectKey.toLowerCase()}:::${topicTitle.toLowerCase()}`;
      processedKeys.add(compositeKey);

      const record = recordMap.get(compositeKey);
      if (record) {
        merged.push({
          id: record.id,
          subjectKey,
          topicTitle,
          status: record.status,
          revisionCount: record.revision_count,
          confidenceLevel: record.confidence_level || 1,
          lastReviewedAt: record.last_reviewed_at,
          notes: record.notes,
          isCustom: false,
        });
      } else {
        merged.push({
          subjectKey,
          topicTitle,
          status: "not_started",
          revisionCount: 0,
          confidenceLevel: 1,
          lastReviewedAt: null,
          notes: null,
          isCustom: false,
        });
      }
    }
  }

  // 2. Process custom topics created by the user not in canonical list
  for (const rec of persistedRecords) {
    const compositeKey = `${rec.subject_key.toLowerCase()}:::${rec.topic_title.toLowerCase()}`;
    if (!processedKeys.has(compositeKey)) {
      merged.push({
        id: rec.id,
        subjectKey: rec.subject_key,
        topicTitle: rec.topic_title,
        status: rec.status,
        revisionCount: rec.revision_count,
        confidenceLevel: rec.confidence_level || 1,
        lastReviewedAt: rec.last_reviewed_at,
        notes: rec.notes,
        isCustom: true,
      });
    }
  }

  return merged;
}

/**
 * Calculates comprehensive mastery and readiness metrics across all subjects and topics.
 */
export function calculateSyllabusMastery(
  topics: MergedSyllabusTopic[],
  examDate?: string | null
): SyllabusMasterySummary {
  const totalTopics = topics.length;
  if (totalTopics === 0) {
    return {
      totalTopics: 0,
      completedTopics: 0,
      inProgressTopics: 0,
      needsRevisionTopics: 0,
      notStartedTopics: 0,
      masteryPercentage: 0,
      readinessScore: 0,
      dueForRevisionCount: 0,
      subjects: [],
    };
  }

  const now = new Date();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

  let completedTopics = 0;
  let inProgressTopics = 0;
  let needsRevisionTopics = 0;
  let notStartedTopics = 0;
  let dueForRevisionCount = 0;
  let totalRevisions = 0;

  const subjectMap = new Map<string, MergedSyllabusTopic[]>();

  for (const topic of topics) {
    // Subject grouping
    const currentSubject = subjectMap.get(topic.subjectKey) || [];
    currentSubject.push(topic);
    subjectMap.set(topic.subjectKey, currentSubject);

    // Status counts
    if (topic.status === "completed") {
      completedTopics++;
    } else if (topic.status === "in_progress") {
      inProgressTopics++;
    } else if (topic.status === "needs_revision") {
      needsRevisionTopics++;
    } else {
      notStartedTopics++;
    }

    totalRevisions += topic.revisionCount;

    // Check if due for spaced-repetition review (reviewed over 7 days ago, or marked needs_revision)
    if (
      topic.status === "needs_revision" ||
      (topic.lastReviewedAt &&
        now.getTime() - new Date(topic.lastReviewedAt).getTime() > SEVEN_DAYS_MS)
    ) {
      dueForRevisionCount++;
    }
  }

  // Mastery % formula: completed = 100%, in_progress = 40%, needs_revision = 60%
  const weightedPoints =
    completedTopics * 1.0 +
    inProgressTopics * 0.4 +
    needsRevisionTopics * 0.6;
  const masteryPercentage = Math.round((weightedPoints / totalTopics) * 100);

  // Readiness Score (0-100):
  // 70% from mastery %, 20% from revision depth (capped at 2 revisions/topic average), 10% from confidence
  const avgConfidence =
    topics.reduce((acc, t) => acc + (t.confidenceLevel || 1), 0) / (totalTopics * 5); // 0.2 to 1.0
  const revisionBonus = Math.min(20, Math.round((totalRevisions / (totalTopics * 2)) * 20));
  const confidenceBonus = Math.round(avgConfidence * 10);
  const readinessScore = Math.min(
    100,
    Math.round(masteryPercentage * 0.7 + revisionBonus + confidenceBonus)
  );

  // Per-subject breakdowns
  const subjects: SubjectProgressBreakdown[] = Array.from(subjectMap.entries()).map(
    ([subjectKey, subjectTopics]) => {
      const subTotal = subjectTopics.length;
      const subCompleted = subjectTopics.filter((t) => t.status === "completed").length;
      const subInProgress = subjectTopics.filter((t) => t.status === "in_progress").length;
      const subNeedsRevision = subjectTopics.filter((t) => t.status === "needs_revision").length;
      const subNotStarted = subjectTopics.filter((t) => t.status === "not_started").length;

      const subWeighted =
        subCompleted * 1.0 + subInProgress * 0.4 + subNeedsRevision * 0.6;
      const subMastery = subTotal > 0 ? Math.round((subWeighted / subTotal) * 100) : 0;

      return {
        subjectKey,
        totalTopics: subTotal,
        completedTopics: subCompleted,
        inProgressTopics: subInProgress,
        needsRevisionTopics: subNeedsRevision,
        notStartedTopics: subNotStarted,
        masteryPercentage: subMastery,
        topics: subjectTopics,
      };
    }
  );

  return {
    totalTopics,
    completedTopics,
    inProgressTopics,
    needsRevisionTopics,
    notStartedTopics,
    masteryPercentage,
    readinessScore,
    dueForRevisionCount,
    subjects,
  };
}
