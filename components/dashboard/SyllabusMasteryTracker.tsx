"use client";

/**
 * @file components/dashboard/SyllabusMasteryTracker.tsx
 * @description Interactive Exam Syllabus & Subject Mastery Tracker UI.
 * Allows candidates to track topic-by-topic progress, trigger spaced repetition
 * revisions, rate confidence, and add custom study topics.
 *
 * Enhancement: ENH-0011 (Interactive Exam Syllabus & Subject Mastery Tracker)
 * Architecture Reference: ADR-001 (App Router RSC)
 */

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  Plus,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Award,
  ArrowLeft,
  FileText,
  Save,
  Check,
} from "lucide-react";
import type {
  SyllabusMasterySummary,
  MergedSyllabusTopic,
  SubjectProgressBreakdown,
} from "@/lib/syllabus/syllabus-tracker";
import type { TopicStatus } from "@/lib/schemas/syllabus-tracking";
import {
  updateTopicProgressAction,
  addCustomTopicAction,
  deleteCustomTopicAction,
  resetSyllabusProgressAction,
} from "@/app/dashboard/tracking/syllabus-actions";

interface Props {
  notificationId: string;
  examTitle: string;
  examCategory: string;
  notificationSlug: string;
  initialSummary: SyllabusMasterySummary;
}

export default function SyllabusMasteryTracker({
  notificationId,
  examTitle,
  examCategory,
  notificationSlug,
  initialSummary,
}: Props) {
  const [summary, setSummary] = useState<SyllabusMasterySummary>(initialSummary);
  const [activeSubject, setActiveSubject] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [expandedTopicKey, setExpandedTopicKey] = useState<string | null>(null);
  const [topicNotes, setTopicNotes] = useState<Record<string, string>>({});
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newTopicSubject, setNewTopicSubject] = useState<string>(
    initialSummary.subjects[0]?.subjectKey || "General Studies"
  );
  const [newTopicTitle, setNewTopicTitle] = useState<string>("");
  const [isPending, startTransition] = useTransition();
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; isError?: boolean } | null>(null);

  // Topic key helper
  const getTopicKey = (subjectKey: string, topicTitle: string) =>
    `${subjectKey}:::${topicTitle}`;

  // Local state updater
  const updateLocalTopic = (
    subjectKey: string,
    topicTitle: string,
    updater: (topic: MergedSyllabusTopic) => MergedSyllabusTopic
  ) => {
    setSummary((prev) => {
      const updatedSubjects = prev.subjects.map((sub) => {
        if (sub.subjectKey !== subjectKey) return sub;
        const updatedTopics = sub.topics.map((t) =>
          t.topicTitle === topicTitle ? updater(t) : t
        );
        const total = updatedTopics.length;
        const comp = updatedTopics.filter((t) => t.status === "completed").length;
        const inProg = updatedTopics.filter((t) => t.status === "in_progress").length;
        const needsRev = updatedTopics.filter((t) => t.status === "needs_revision").length;
        const notStart = updatedTopics.filter((t) => t.status === "not_started").length;
        const weighted = comp * 1.0 + inProg * 0.4 + needsRev * 0.6;
        const mastery = total > 0 ? Math.round((weighted / total) * 100) : 0;

        return {
          ...sub,
          totalTopics: total,
          completedTopics: comp,
          inProgressTopics: inProg,
          needsRevisionTopics: needsRev,
          notStartedTopics: notStart,
          masteryPercentage: mastery,
          topics: updatedTopics,
        };
      });

      const allTopics = updatedSubjects.flatMap((s) => s.topics);
      const totalAll = allTopics.length;
      const compAll = allTopics.filter((t) => t.status === "completed").length;
      const inProgAll = allTopics.filter((t) => t.status === "in_progress").length;
      const needsRevAll = allTopics.filter((t) => t.status === "needs_revision").length;
      const notStartAll = allTopics.filter((t) => t.status === "not_started").length;
      const weightedAll = compAll * 1.0 + inProgAll * 0.4 + needsRevAll * 0.6;
      const masteryAll = totalAll > 0 ? Math.round((weightedAll / totalAll) * 100) : 0;

      return {
        ...prev,
        totalTopics: totalAll,
        completedTopics: compAll,
        inProgressTopics: inProgAll,
        needsRevisionTopics: needsRevAll,
        notStartedTopics: notStartAll,
        masteryPercentage: masteryAll,
        subjects: updatedSubjects,
      };
    });
  };

  // Status toggle handler
  const handleStatusChange = (
    subjectKey: string,
    topicTitle: string,
    newStatus: TopicStatus
  ) => {
    updateLocalTopic(subjectKey, topicTitle, (t) => ({ ...t, status: newStatus }));

    startTransition(async () => {
      const res = await updateTopicProgressAction({
        notificationId,
        subjectKey,
        topicTitle,
        status: newStatus,
        notes: topicNotes[getTopicKey(subjectKey, topicTitle)] ?? null,
      });
      if (!res.success) {
        setFeedbackMsg({ text: res.error || "Failed to update", isError: true });
      }
    });
  };

  // Revision increment handler
  const handleRevisionIncrement = (topic: MergedSyllabusTopic) => {
    updateLocalTopic(topic.subjectKey, topic.topicTitle, (t) => ({
      ...t,
      revisionCount: t.revisionCount + 1,
      lastReviewedAt: new Date().toISOString(),
    }));

    startTransition(async () => {
      const res = await updateTopicProgressAction({
        notificationId,
        subjectKey: topic.subjectKey,
        topicTitle: topic.topicTitle,
        status: topic.status === "not_started" ? "in_progress" : topic.status,
        revisionIncrement: true,
      });
      if (res.success) {
        setFeedbackMsg({ text: `Revision recorded for "${topic.topicTitle}"!` });
        setTimeout(() => setFeedbackMsg(null), 3000);
      }
    });
  };

  // Confidence rating handler
  const handleConfidenceChange = (topic: MergedSyllabusTopic, rating: number) => {
    updateLocalTopic(topic.subjectKey, topic.topicTitle, (t) => ({
      ...t,
      confidenceLevel: rating,
    }));

    startTransition(async () => {
      await updateTopicProgressAction({
        notificationId,
        subjectKey: topic.subjectKey,
        topicTitle: topic.topicTitle,
        status: topic.status,
        confidenceLevel: rating,
      });
    });
  };

  // Save notes
  const handleSaveNotes = (topic: MergedSyllabusTopic) => {
    const key = getTopicKey(topic.subjectKey, topic.topicTitle);
    const notesToSave = topicNotes[key] ?? topic.notes;

    startTransition(async () => {
      const res = await updateTopicProgressAction({
        notificationId,
        subjectKey: topic.subjectKey,
        topicTitle: topic.topicTitle,
        status: topic.status,
        confidenceLevel: topic.confidenceLevel,
        notes: notesToSave,
      });
      if (res.success) {
        setFeedbackMsg({ text: "Notes saved successfully" });
        setTimeout(() => setFeedbackMsg(null), 2500);
      }
    });
  };

  // Add custom topic
  const handleAddCustomTopic = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopicTitle.trim()) return;

    startTransition(async () => {
      const res = await addCustomTopicAction({
        notificationId,
        subjectKey: newTopicSubject,
        topicTitle: newTopicTitle.trim(),
      });

      if (res.success) {
        setShowAddModal(false);
        setNewTopicTitle("");
        setFeedbackMsg({ text: "Custom topic added to syllabus!" });
        // Add to local state
        setSummary((prev) => {
          const subjects = prev.subjects.map((sub) => {
            if (sub.subjectKey !== newTopicSubject) return sub;
            const newTopic: MergedSyllabusTopic = {
              subjectKey: newTopicSubject,
              topicTitle: newTopicTitle.trim(),
              status: "not_started",
              revisionCount: 0,
              confidenceLevel: 1,
              lastReviewedAt: null,
              notes: null,
              isCustom: true,
            };
            return {
              ...sub,
              totalTopics: sub.totalTopics + 1,
              notStartedTopics: sub.notStartedTopics + 1,
              topics: [...sub.topics, newTopic],
            };
          });
          return { ...prev, totalTopics: prev.totalTopics + 1, subjects };
        });
        setTimeout(() => setFeedbackMsg(null), 3000);
      } else {
        setFeedbackMsg({ text: res.error || "Failed to add topic", isError: true });
      }
    });
  };

  // Delete custom topic
  const handleDeleteTopic = (subjectKey: string, topicTitle: string) => {
    startTransition(async () => {
      const res = await deleteCustomTopicAction({
        notificationId,
        subjectKey,
        topicTitle,
      });
      if (res.success) {
        setSummary((prev) => {
          const updatedSubjects = prev.subjects.map((s) => {
            if (s.subjectKey !== subjectKey) return s;
            return {
              ...s,
              totalTopics: s.totalTopics - 1,
              topics: s.topics.filter((t) => t.topicTitle !== topicTitle),
            };
          });
          return { ...prev, totalTopics: prev.totalTopics - 1, subjects: updatedSubjects };
        });
        setFeedbackMsg({ text: "Topic deleted" });
        setTimeout(() => setFeedbackMsg(null), 2500);
      }
    });
  };

  // Reset all
  const handleResetProgress = () => {
    if (!confirm("Are you sure you want to reset all topic progress for this exam?")) return;
    startTransition(async () => {
      const res = await resetSyllabusProgressAction({ notificationId });
      if (res.success) {
        window.location.reload();
      }
    });
  };

  // Filter topics
  const displayedSubjects: SubjectProgressBreakdown[] = summary.subjects
    .filter((s) => activeSubject === "ALL" || s.subjectKey === activeSubject)
    .map((s) => ({
      ...s,
      topics: s.topics.filter((t) => {
        if (statusFilter === "ALL") return true;
        return t.status === statusFilter;
      }),
    }))
    .filter((s) => s.topics.length > 0);

  return (
    <div className="space-y-6">
      {/* Top Header Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <Link
              href="/dashboard/tracking"
              className="hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Back to Tracker
            </Link>
            <span>/</span>
            <span className="capitalize">{examCategory.replace("_", " ")}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {examTitle}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Topic-by-topic mastery checklist, revision tracker, and readiness scoring.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/notification/${notificationSlug}`}
            target="_blank"
            className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1 transition"
          >
            <FileText className="w-3.5 h-3.5" /> Notification PDF
          </Link>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg flex items-center gap-1 transition shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Topic
          </button>
          <button
            onClick={handleResetProgress}
            title="Reset All Progress"
            className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Feedback banner */}
      {feedbackMsg && (
        <div
          className={`p-3 rounded-lg text-xs font-medium flex items-center justify-between ${
            feedbackMsg.isError
              ? "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900"
              : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900"
          }`}
        >
          <span>{feedbackMsg.text}</span>
          <button onClick={() => setFeedbackMsg(null)} className="opacity-70 hover:opacity-100">
            ×
          </button>
        </div>
      )}

      {/* Spaced-Repetition Banner */}
      {summary.dueForRevisionCount > 0 && (
        <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl flex items-start gap-3">
          <div className="p-2 bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {summary.dueForRevisionCount} Topic(s) Due for Spaced Revision
            </h4>
            <p className="text-xs text-amber-700 dark:text-amber-400/90 mt-0.5">
              Reviewing concepts every 7 days improves long-term recall by over 80%. Filter by &quot;Needs Revision&quot; to review them today.
            </p>
          </div>
        </div>
      )}

      {/* KPI Mastery & Readiness Summary Card */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Overall Mastery Percentage */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Syllabus Covered
            </span>
            <BookOpen className="w-4 h-4 text-primary-500" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-slate-900 dark:text-white">
                {summary.masteryPercentage}%
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ({summary.completedTopics}/{summary.totalTopics} topics)
              </span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-primary-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${summary.masteryPercentage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Exam Readiness Composite Score */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Exam Readiness Score
            </span>
            <Award className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                {summary.readinessScore}
                <span className="text-sm font-normal text-slate-400">/100</span>
              </span>
              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                {summary.readinessScore >= 80
                  ? "Exam Ready 🎯"
                  : summary.readinessScore >= 50
                  ? "Good Progress 📈"
                  : "Preparation Phase 🚀"}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Combines completion, multiple revisions &amp; confidence ratings.
            </p>
          </div>
        </div>

        {/* Status Count Mini-Grid */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm md:col-span-2 flex flex-col justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Topic Breakdown
          </span>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900">
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {summary.completedTopics}
              </div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium uppercase">
                Completed
              </div>
            </div>
            <div className="p-2 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900">
              <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
                {summary.inProgressTopics}
              </div>
              <div className="text-[10px] text-amber-700 dark:text-amber-300 font-medium uppercase">
                In Progress
              </div>
            </div>
            <div className="p-2 rounded-lg bg-orange-50/70 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900">
              <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                {summary.needsRevisionTopics}
              </div>
              <div className="text-[10px] text-orange-700 dark:text-orange-300 font-medium uppercase">
                Revision
              </div>
            </div>
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
              <div className="text-lg font-bold text-slate-600 dark:text-slate-300">
                {summary.notStartedTopics}
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase">
                Not Started
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        {/* Subject Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveSubject("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
              activeSubject === "ALL"
                ? "bg-primary-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            All Subjects ({summary.totalTopics})
          </button>
          {summary.subjects.map((sub) => (
            <button
              key={sub.subjectKey}
              onClick={() => setActiveSubject(sub.subjectKey)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 ${
                activeSubject === sub.subjectKey
                  ? "bg-primary-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              <span>{sub.subjectKey}</span>
              <span className="text-[10px] opacity-80">({sub.masteryPercentage}%)</span>
            </button>
          ))}
        </div>

        {/* Status Dropdown Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-slate-200 font-medium focus:ring-1 focus:ring-primary-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="needs_revision">Needs Revision</option>
            <option value="not_started">Not Started</option>
          </select>
        </div>
      </div>

      {/* Subject Groups and Topic Cards */}
      <div className="space-y-6">
        {displayedSubjects.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No topics match the selected filters
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Try switching subject or status filters to view your syllabus.
            </p>
          </div>
        ) : (
          displayedSubjects.map((sub) => (
            <div
              key={sub.subjectKey}
              className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm"
            >
              {/* Subject Group Header */}
              <div className="p-4 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {sub.subjectKey}
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      • {sub.completedTopics}/{sub.totalTopics} completed
                    </span>
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full"
                      style={{ width: `${sub.masteryPercentage}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {sub.masteryPercentage}%
                  </span>
                </div>
              </div>

              {/* Topics List */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {sub.topics.map((topic) => {
                  const topicKey = getTopicKey(topic.subjectKey, topic.topicTitle);
                  const isExpanded = expandedTopicKey === topicKey;
                  const currentNote = topicNotes[topicKey] ?? (topic.notes || "");

                  return (
                    <div
                      key={topic.topicTitle}
                      className="p-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition flex flex-col gap-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        {/* Status Toggle & Title */}
                        <div className="flex items-start gap-3 flex-1">
                          <button
                            onClick={() => {
                              const nextStatusMap: Record<TopicStatus, TopicStatus> = {
                                not_started: "in_progress",
                                in_progress: "completed",
                                completed: "needs_revision",
                                needs_revision: "not_started",
                              };
                              handleStatusChange(
                                topic.subjectKey,
                                topic.topicTitle,
                                nextStatusMap[topic.status]
                              );
                            }}
                            title="Click to advance status"
                            className="mt-0.5 shrink-0 transition"
                          >
                            {topic.status === "completed" && (
                              <CheckCircle2 className="w-5 h-5 text-emerald-500 fill-emerald-50 dark:fill-emerald-950" />
                            )}
                            {topic.status === "in_progress" && (
                              <Clock className="w-5 h-5 text-amber-500" />
                            )}
                            {topic.status === "needs_revision" && (
                              <RotateCcw className="w-5 h-5 text-orange-500" />
                            )}
                            {topic.status === "not_started" && (
                              <div className="w-5 h-5 rounded-full border-2 border-slate-300 dark:border-slate-600 hover:border-primary-500 transition" />
                            )}
                          </button>

                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-sm font-semibold ${
                                  topic.status === "completed"
                                    ? "text-slate-500 dark:text-slate-400 line-through decoration-slate-300 dark:decoration-slate-600"
                                    : "text-slate-900 dark:text-white"
                                }`}
                              >
                                {topic.topicTitle}
                              </span>
                              {topic.isCustom && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-medium">
                                  Custom
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                              <span className="capitalize">{topic.status.replace("_", " ")}</span>
                              {topic.revisionCount > 0 && (
                                <span>• {topic.revisionCount} revision(s)</span>
                              )}
                              {topic.lastReviewedAt && (
                                <span>
                                  • Reviewed:{" "}
                                  {new Date(topic.lastReviewedAt).toLocaleDateString("en-IN", {
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Interactive Actions: Revision, Confidence, Notes Toggle */}
                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                          {/* Quick Revision Button */}
                          <button
                            onClick={() => handleRevisionIncrement(topic)}
                            title="Record revision session"
                            className="px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-primary-50 dark:hover:bg-primary-950/40 hover:text-primary-600 dark:hover:text-primary-400 rounded-lg flex items-center gap-1 transition"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Revise ({topic.revisionCount})</span>
                          </button>

                          {/* Confidence Rating (1-5) */}
                          <div className="flex items-center gap-0.5 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-lg">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                onClick={() => handleConfidenceChange(topic, star)}
                                title={`Confidence: ${star}/5`}
                                className={`text-xs ${
                                  star <= topic.confidenceLevel
                                    ? "text-amber-400"
                                    : "text-slate-300 dark:text-slate-600 hover:text-slate-400"
                                }`}
                              >
                                ★
                              </button>
                            ))}
                          </div>

                          {/* Notes toggle */}
                          <button
                            onClick={() =>
                              setExpandedTopicKey(isExpanded ? null : topicKey)
                            }
                            className={`p-1.5 rounded-lg text-xs font-medium transition ${
                              topic.notes
                                ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/40"
                                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            }`}
                            title="Add or view study notes / formulas"
                          >
                            <FileText className="w-4 h-4" />
                          </button>

                          {/* Delete custom topic */}
                          {topic.isCustom && (
                            <button
                              onClick={() => handleDeleteTopic(topic.subjectKey, topic.topicTitle)}
                              className="p-1.5 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition"
                              title="Delete topic"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expandable Notes Area */}
                      {isExpanded && (
                        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 pl-8">
                          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">
                            Quick Notes, Formulas &amp; Key Concepts
                          </label>
                          <div className="flex items-start gap-2">
                            <textarea
                              rows={2}
                              value={currentNote}
                              onChange={(e) =>
                                setTopicNotes((prev) => ({
                                  ...prev,
                                  [topicKey]: e.target.value,
                                }))
                              }
                              placeholder="Write memory anchors, article numbers, formulas, or high-yield points..."
                              className="w-full text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-primary-500"
                            />
                            <button
                              onClick={() => handleSaveNotes(topic)}
                              className="px-3 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg flex items-center gap-1 transition shrink-0"
                            >
                              <Save className="w-3.5 h-3.5" /> Save
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Custom Topic Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-xl animate-in fade-in">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Add Topic to Syllabus
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Add a specialized topic, test series module, or textbook chapter to track.
            </p>

            <form onSubmit={handleAddCustomTopic} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Subject Section
                </label>
                <select
                  value={newTopicSubject}
                  onChange={(e) => setNewTopicSubject(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-primary-500"
                >
                  {summary.subjects.map((s) => (
                    <option key={s.subjectKey} value={s.subjectKey}>
                      {s.subjectKey}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Topic Title
                </label>
                <input
                  type="text"
                  required
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  placeholder="e.g. Fundamental Rights (Articles 12-35)"
                  className="w-full text-xs p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition shadow-sm"
                >
                  {isPending ? "Adding..." : "Add to Syllabus"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
