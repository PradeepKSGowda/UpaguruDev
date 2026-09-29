"use server";

/**
 * @file app/admin/review-queue/actions.ts
 * @description Next.js 15 Server Actions for Human-in-the-Loop (HITL) review queue governance.
 * Supports:
 * - Fetching prioritized review queue items (DOCUMENT_CYCLE_LINK, EVENT_CONFLICT, etc.)
 * - Approving, rejecting, reassigning, and merging cycles
 * - Mandatory audit logging in public.audit_logs
 * - RBAC enforcement (admin / super_admin)
 * 
 * Complies with: AGENTS.md (Rule 1: TypeScript strict mode, Zod validation; Rule 3: RBAC & Audit Trail)
 */

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import {
  reviewQueueActionInputSchema,
  mergeCyclesInputSchema,
  type ReviewQueueActionInput,
  type MergeCyclesInput,
} from "@/lib/schemas/lifecycle";
import type { Json } from "@/types/database.types";

export interface ActionResponse<T = unknown> {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
}

/**
 * Enforces admin authentication and returns authenticated user and Supabase client.
 */
async function requireAdminSession() {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("Unauthorized: Please log in to perform this action");
  }

  const role = user.app_metadata?.role;
  if (role !== "admin" && role !== "super_admin") {
    throw new Error("Forbidden: Administrator privileges required");
  }

  return { supabase, user };
}

/**
 * Fetch review queue items with optional filters.
 */
export async function getReviewQueueItemsAction(options?: {
  status?: string;
  itemType?: string;
  priority?: string;
  limit?: number;
  offset?: number;
}) {
  try {
    const { supabase } = await requireAdminSession();

    let query = supabase
      .from("review_queue_item")
      .select(`
        id,
        item_type,
        priority,
        organization_id,
        document_id,
        proposed_exam_master_id,
        proposed_exam_cycle_id,
        candidate_matches_json,
        extracted_payload_json,
        confidence,
        reasons_json,
        status,
        resolution_action,
        resolution_notes,
        resolved_by,
        resolved_at,
        created_at,
        updated_at,
        organization:organization_id (id, code, name),
        document:document_id (id, title, document_type, source_url, publication_date, reference_number),
        proposed_exam_master:proposed_exam_master_id (id, exam_code, name),
        proposed_exam_cycle:proposed_exam_cycle_id (id, cycle_code, cycle_label, cycle_year)
      `)
      .order("created_at", { ascending: false });

    if (options?.status) {
      query = query.eq("status", options.status as "PENDING" | "APPROVED" | "REJECTED" | "MODIFIED" | "ESCALATED");
    } else {
      query = query.eq("status", "PENDING");
    }

    if (options?.itemType) {
      query = query.eq("item_type", options.itemType);
    }

    if (options?.priority) {
      query = query.eq("priority", options.priority as "HIGH" | "MEDIUM" | "LOW");
    }

    const limit = options?.limit ?? 25;
    const offset = options?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;

    if (error) {
      console.error("[getReviewQueueItemsAction] Query error:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return { success: false, error: message };
  }
}

/**
 * Resolve a review queue item (Approve, Reject, Reassign, etc.).
 */
export async function resolveReviewQueueItemAction(
  rawInput: ReviewQueueActionInput
): Promise<ActionResponse<{ id: string }>> {
  try {
    const { supabase, user } = await requireAdminSession();

    // 1. Zod runtime validation
    const parsed = reviewQueueActionInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed: Please check the provided resolution fields",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { itemId, action, resolutionNotes, targetExamCycleId, targetExamMasterId } = parsed.data;

    // 2. Fetch existing item
    const { data: item, error: fetchErr } = await supabase
      .from("review_queue_item")
      .select("*")
      .eq("id", itemId)
      .single();

    if (fetchErr || !item) {
      return { success: false, error: "Review queue item not found" };
    }

    const now = new Date().toISOString();

    if (action === "APPROVE") {
      // Approve proposed cycle link & entities
      const cycleIdToLink = item.proposed_exam_cycle_id;
      const masterIdToLink = item.proposed_exam_master_id;

      if (item.document_id) {
        await supabase
          .from("exam_document")
          .update({
            exam_cycle_id: cycleIdToLink,
            exam_master_id: masterIdToLink,
            verification_status: "HUMAN_VERIFIED",
            updated_at: now,
          })
          .eq("id", item.document_id);

        if (cycleIdToLink) {
          // Upsert join link
          await supabase.from("document_exam_cycle").upsert(
            {
              document_id: item.document_id,
              exam_cycle_id: cycleIdToLink,
              exam_master_id: masterIdToLink,
              relationship_role: "PRIMARY_NOTIFICATION",
              confidence: 100.0,
              link_reasons_json: ["human_verified_approval"] as unknown as Json,
              decision: "MANUAL_LINK",
              verified: true,
              verified_by: user.id,
              verified_at: now,
            },
            { onConflict: "document_id,exam_cycle_id" }
          );
        }
      }

      await supabase
        .from("review_queue_item")
        .update({
          status: "APPROVED",
          resolution_action: action,
          resolution_notes: resolutionNotes || "Approved by administrator",
          resolved_by: user.id,
          resolved_at: now,
          updated_at: now,
        })
        .eq("id", itemId);
    } else if (action === "REJECT") {
      if (item.document_id) {
        await supabase
          .from("exam_document")
          .update({
            verification_status: "REJECTED",
            updated_at: now,
          })
          .eq("id", item.document_id);
      }

      await supabase
        .from("review_queue_item")
        .update({
          status: "REJECTED",
          resolution_action: action,
          resolution_notes: resolutionNotes || "Rejected by administrator",
          resolved_by: user.id,
          resolved_at: now,
          updated_at: now,
        })
        .eq("id", itemId);
    } else if (action === "REASSIGN_CYCLE") {
      if (!targetExamCycleId) {
        return { success: false, error: "Target exam cycle ID is required for reassigning cycle" };
      }

      if (item.document_id) {
        await supabase
          .from("exam_document")
          .update({
            exam_cycle_id: targetExamCycleId,
            verification_status: "HUMAN_VERIFIED",
            updated_at: now,
          })
          .eq("id", item.document_id);

        await supabase.from("document_exam_cycle").upsert(
          {
            document_id: item.document_id,
            exam_cycle_id: targetExamCycleId,
            exam_master_id: targetExamMasterId || null,
            relationship_role: "PRIMARY_NOTIFICATION",
            confidence: 100.0,
            link_reasons_json: ["reassigned_by_admin"] as unknown as Json,
            decision: "MANUAL_LINK",
            verified: true,
            verified_by: user.id,
            verified_at: now,
          },
          { onConflict: "document_id,exam_cycle_id" }
        );
      }

      await supabase
        .from("review_queue_item")
        .update({
          status: "MODIFIED",
          resolution_action: action,
          resolution_notes: resolutionNotes || `Reassigned to cycle ${targetExamCycleId}`,
          proposed_exam_cycle_id: targetExamCycleId,
          resolved_by: user.id,
          resolved_at: now,
          updated_at: now,
        })
        .eq("id", itemId);
    }

    // 3. Log to audit_logs
    await supabase.from("audit_logs").insert({
      admin_id: user.id,
      action: `review_queue_${action.toLowerCase()}`,
      target_entity: "review_queue_item",
      target_id: itemId,
      metadata: {
        action,
        item_type: item.item_type,
        document_id: item.document_id,
        resolutionNotes,
        targetExamCycleId,
      } as unknown as Json,
    });

    revalidatePath("/admin/review-queue");
    revalidatePath("/admin");

    return { success: true, data: { id: itemId } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return { success: false, error: message };
  }
}

/**
 * Merge two Exam Cycles into a single target cycle.
 */
export async function mergeCyclesAction(
  rawInput: MergeCyclesInput
): Promise<ActionResponse<{ targetCycleId: string }>> {
  try {
    const { supabase, user } = await requireAdminSession();

    const parsed = mergeCyclesInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        success: false,
        error: "Validation failed: Check source and target cycle IDs",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { sourceCycleId, targetCycleId, reason } = parsed.data;

    if (sourceCycleId === targetCycleId) {
      return { success: false, error: "Cannot merge an exam cycle into itself" };
    }

    const now = new Date().toISOString();

    // 1. Move all documents from source to target
    await supabase
      .from("exam_document")
      .update({ exam_cycle_id: targetCycleId, updated_at: now })
      .eq("exam_cycle_id", sourceCycleId);

    // 2. Move all events from source to target
    await supabase
      .from("exam_event")
      .update({ exam_cycle_id: targetCycleId, updated_at: now })
      .eq("exam_cycle_id", sourceCycleId);

    // 3. Move recruitments from source to target
    await supabase
      .from("recruitment")
      .update({ exam_cycle_id: targetCycleId, updated_at: now })
      .eq("exam_cycle_id", sourceCycleId);

    // 4. Archive source cycle
    await supabase
      .from("exam_cycle")
      .update({
        status: "ARCHIVED",
        latest_update_summary: `Merged into ${targetCycleId}: ${reason}`,
        updated_at: now,
      })
      .eq("id", sourceCycleId);

    // 5. Record forensic audit log
    await supabase.from("audit_logs").insert({
      admin_id: user.id,
      action: "merge_exam_cycles",
      target_entity: "exam_cycle",
      target_id: targetCycleId,
      metadata: {
        source_cycle_id: sourceCycleId,
        target_cycle_id: targetCycleId,
        reason,
      } as unknown as Json,
    });

    revalidatePath("/admin/review-queue");
    revalidatePath("/admin/exams");

    return { success: true, data: { targetCycleId } };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return { success: false, error: message };
  }
}
