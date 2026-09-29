/**
 * @file lib/services/lifecycle-timeline.ts
 * @description Candidate Timeline Read Model service.
 * Assembles the full examination lifecycle view across:
 * - exam_master & organizations
 * - exam_cycle
 * - exam_event (including version revision history with supersedes_event_id chains)
 * - exam_document (source evidence PDFs/HTML notices)
 * - recruitment (post/cadre breakdown)
 * - important_dates & latest_update calculation
 * 
 * Complies with: AGENTS.md (Rule 1: TypeScript strict mode, Zod validation, RSC conventions)
 */

import { createServerClient } from "@/lib/supabase/server";
import type { CandidateTimelineResponse, TimelineEvent, TimelineEventVersion } from "@/lib/schemas/lifecycle";

interface GetTimelineOptions {
  examCode?: string;
  cycleCode?: string;
  year?: number;
}

/**
 * Fetch and construct candidate timeline read model.
 */
export async function getCandidateExamTimeline(
  options: GetTimelineOptions
): Promise<CandidateTimelineResponse | null> {
  const supabase = await createServerClient();

  // 1. Resolve Exam Cycle
  let cycleQuery = supabase
    .from("exam_cycle")
    .select(`
      id,
      exam_master_id,
      cycle_year,
      cycle_code,
      cycle_label,
      primary_reference_no,
      status,
      current_stage,
      total_vacancies_current,
      verification_status,
      start_date,
      end_date,
      latest_update_summary,
      latest_update_at,
      latest_document_id,
      exam_master:exam_master_id (
        id,
        exam_code,
        name,
        short_name,
        category,
        organization:organization_id (
          id,
          code,
          name,
          short_name,
          official_website
        )
      )
    `);

  if (options.cycleCode) {
    cycleQuery = cycleQuery.eq("cycle_code", options.cycleCode);
  } else if (options.examCode) {
    // If examCode provided, find master first or join
    const { data: masters } = await supabase
      .from("exam_master")
      .select("id")
      .eq("exam_code", options.examCode)
      .limit(1);

    const firstMaster = masters && masters.length > 0 ? masters[0] : null;
    if (!firstMaster) {
      return null;
    }

    cycleQuery = cycleQuery.eq("exam_master_id", firstMaster.id);
    if (options.year) {
      cycleQuery = cycleQuery.eq("cycle_year", options.year);
    } else {
      // Pick latest year or cycle
      cycleQuery = cycleQuery.order("cycle_year", { ascending: false, nullsFirst: false });
    }
  } else {
    return null;
  }

  const { data: cycles, error: cycleErr } = await cycleQuery.limit(1);
  if (cycleErr || !cycles || cycles.length === 0) {
    return null;
  }

  const cycleData = cycles[0];
  if (!cycleData) {
    return null;
  }

  const cycleId = cycleData.id;
  const examMaster = Array.isArray(cycleData.exam_master)
    ? cycleData.exam_master[0]
    : cycleData.exam_master;

  if (!examMaster) {
    return null;
  }

  const org = Array.isArray(examMaster.organization)
    ? examMaster.organization[0]
    : examMaster.organization;

  // 2. Fetch all events for this cycle (including historical superseded versions)
  const { data: rawEvents } = await supabase
    .from("exam_event")
    .select(`
      id,
      event_type,
      stage,
      event_name,
      start_datetime,
      end_datetime,
      is_date_tbd,
      date_precision,
      date_text_original,
      status,
      confidence,
      verification_status,
      is_current,
      version_number,
      supersedes_event_id,
      change_reason,
      created_at,
      source_document:source_document_id (
        id,
        title,
        source_url,
        document_type,
        publication_date
      )
    `)
    .eq("exam_cycle_id", cycleId)
    .order("version_number", { ascending: true });

  const allEvents = rawEvents || [];

  // Group events by lineage chain: separate current vs historical superseded
  const supersededMap = new Map<string, TimelineEventVersion[]>();
  const activeEvents: TimelineEvent[] = [];

  for (const ev of allEvents) {
    if (!ev.is_current) {
      const parentId = ev.supersedes_event_id || ev.id;
      const historyList = supersededMap.get(parentId) || [];
      historyList.push({
        id: ev.id,
        start_datetime: ev.start_datetime,
        end_datetime: ev.end_datetime,
        date_text_original: ev.date_text_original,
        status: ev.status,
        version_number: ev.version_number,
        change_reason: ev.change_reason,
        created_at: ev.created_at,
      });
      supersededMap.set(parentId, historyList);
    }
  }

  for (const ev of allEvents) {
    if (ev.is_current) {
      const srcDoc = Array.isArray(ev.source_document) ? ev.source_document[0] : ev.source_document;

      // Find prior versions pointing to this event or linked via chain
      const previousVersions: TimelineEventVersion[] = [];
      if (ev.supersedes_event_id) {
        // Collect all previous versions in the chain
        let curSupId: string | null = ev.supersedes_event_id;
        while (curSupId) {
          const prev = allEvents.find((e) => e.id === curSupId);
          if (prev) {
            previousVersions.unshift({
              id: prev.id,
              start_datetime: prev.start_datetime,
              end_datetime: prev.end_datetime,
              date_text_original: prev.date_text_original,
              status: prev.status,
              version_number: prev.version_number,
              change_reason: prev.change_reason,
              created_at: prev.created_at,
            });
            curSupId = prev.supersedes_event_id;
          } else {
            break;
          }
        }
      }

      activeEvents.push({
        id: ev.id,
        event_type: ev.event_type,
        stage: ev.stage,
        event_name: ev.event_name,
        start_datetime: ev.start_datetime,
        end_datetime: ev.end_datetime,
        is_date_tbd: ev.is_date_tbd ?? false,
        date_precision: ev.date_precision ?? "DAY",
        date_text_original: ev.date_text_original,
        status: ev.status,
        confidence: Number(ev.confidence ?? 100),
        verification_status: ev.verification_status,
        is_current: ev.is_current,
        version_number: ev.version_number,
        change_reason: ev.change_reason,
        previous_versions: previousVersions,
        source_document: srcDoc
          ? {
              id: srcDoc.id,
              title: srcDoc.title,
              source_url: srcDoc.source_url,
              document_type: srcDoc.document_type,
              publication_date: srcDoc.publication_date,
            }
          : null,
      });
    }
  }

  // 3. Fetch linked documents for this cycle
  const { data: rawDocs } = await supabase
    .from("exam_document")
    .select(`
      id,
      title,
      document_type,
      source_url,
      publication_date,
      reference_number,
      verification_status
    `)
    .eq("exam_cycle_id", cycleId)
    .order("publication_date", { ascending: false, nullsFirst: false });

  const documents = (rawDocs || []).map((doc) => ({
    id: doc.id,
    title: doc.title,
    document_type: doc.document_type,
    source_url: doc.source_url,
    publication_date: doc.publication_date,
    reference_number: doc.reference_number,
    verification_status: doc.verification_status,
  }));

  // 4. Fetch recruitments (cadre/post layers)
  const { data: rawRecruitments } = await supabase
    .from("recruitment")
    .select("id, title, department_or_cadre, vacancies_current, pay_level, status")
    .eq("exam_cycle_id", cycleId);

  const recruitments = (rawRecruitments || []).map((r) => ({
    id: r.id,
    title: r.title,
    department_or_cadre: r.department_or_cadre,
    vacancies_current: r.vacancies_current,
    pay_level: r.pay_level,
    status: r.status,
  }));

  // 5. Compute important_dates dictionary
  const importantDates: Record<string, string | null> = {
    application_open: null,
    application_close: null,
    prelims_exam: null,
    mains_exam: null,
    admit_card_release: null,
    result_declared: null,
  };

  for (const ev of activeEvents) {
    const dt = ev.start_datetime ? ev.start_datetime.split("T")[0] : (ev.date_text_original || null);
    if (ev.event_type === "APPLICATION_OPEN") importantDates.application_open = dt ?? null;
    if (ev.event_type === "APPLICATION_CLOSE") importantDates.application_close = dt ?? null;
    if (ev.event_type === "PRELIMS_EXAM" || ev.event_type === "TIER_1_EXAM" || ev.event_type === "CBT_1") {
      importantDates.prelims_exam = dt ?? null;
    }
    if (ev.event_type === "MAINS_EXAM" || ev.event_type === "TIER_2_EXAM" || ev.event_type === "CBT_2") {
      importantDates.mains_exam = dt ?? null;
    }
    if (ev.event_type === "ADMIT_CARD_RELEASE") importantDates.admit_card_release = dt ?? null;
    if (ev.event_type === "FINAL_RESULT" || ev.event_type === "RESULT") {
      importantDates.result_declared = dt ?? null;
    }
  }

  // 6. Compute latest_update
  let latestUpdate = null;
  if (documents.length > 0 && documents[0]) {
    const topDoc = documents[0];
    latestUpdate = {
      title: topDoc.title,
      published_date: topDoc.publication_date,
      document_type: topDoc.document_type,
      source_url: topDoc.source_url,
    };
  }

  return {
    exam: {
      id: examMaster.id,
      code: examMaster.exam_code,
      name: examMaster.name,
      short_name: examMaster.short_name,
      category: examMaster.category,
      organization: {
        id: org?.id,
        code: org?.code || "GOV",
        name: org?.name || "Government Agency",
        short_name: org?.short_name,
        official_website: org?.official_website,
      },
    },
    cycle: {
      id: cycleData.id,
      code: cycleData.cycle_code,
      label: cycleData.cycle_label,
      year: cycleData.cycle_year,
      reference_number: cycleData.primary_reference_no,
      status: cycleData.status,
      current_stage: cycleData.current_stage,
      total_vacancies: cycleData.total_vacancies_current,
      verification_status: cycleData.verification_status,
      start_date: cycleData.start_date,
      end_date: cycleData.end_date,
    },
    latest_update: latestUpdate,
    important_dates: importantDates,
    events: activeEvents,
    documents: documents,
    recruitments: recruitments,
  };
}
