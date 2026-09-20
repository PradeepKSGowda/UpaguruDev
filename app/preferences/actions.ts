/**
 * @file app/preferences/actions.ts
 * @module SubscriptionServerActions
 * @description Next.js 15 Server Action for validating and upserting candidate alert preferences
 * across exam categories, Indian states, and notification channels in public.user_subscriptions.
 * 
 * Task ID: TASK-05010101 (Subtask: SUB-0501010102)
 * Architecture Reference: ADR-001 (Server Actions), ADR-002 (Database), ADR-007 (Push Engine), ADR-013 (Security)
 * 
 * Complies with:
 * - Next.js 15 Server Actions with "use server" directive
 * - Zod validation via subscriptionPreferencesSchema
 * - Strict User ID binding from authenticated session (Prevents IDOR)
 * - Atomic upsert pattern respecting Row Level Security (RLS)
 * - Cache revalidation for /preferences
 */

"use server";

import { revalidateCandidatePreferences } from "@/lib/cache";
import { createServerClient } from "@/lib/supabase/server";
import { subscriptionPreferencesSchema } from "@/lib/schemas/subscriptions";
import type { SubscriptionActionResponse, SubscriptionFormData } from "@/types/subscriptions";
import { mapRowToUserSubscription } from "@/lib/data/subscriptions";

/**
 * Server action to validate and persist candidate subscription alert preferences.
 * 
 * @param {SubscriptionFormData} formData Form values submitted by candidate
 * @returns {Promise<SubscriptionActionResponse>} Result status, feedback message, and updated record
 */
export async function updateSubscriptionPreferences(
  formData: SubscriptionFormData
): Promise<SubscriptionActionResponse> {
  try {
    // 1. Authenticate user from session
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        success: false,
        message: "You must be signed in to manage alert preferences.",
      };
    }

    // 2. Validate form input using Zod
    const validation = subscriptionPreferencesSchema.safeParse(formData);
    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      validation.error.errors.forEach((err) => {
        const field = err.path.join(".") || "form";
        if (!fieldErrors[field]) {
          fieldErrors[field] = [];
        }
        fieldErrors[field].push(err.message);
      });

      return {
        success: false,
        message: "Please correct the highlighted errors before saving.",
        errors: fieldErrors,
      };
    }

    const {
      subscribedCategories,
      subscribedStates,
      preferredChannels,
      telegramChatId,
      whatsappPhoneNumber,
    } = validation.data;

    // Cleaned payload for database insertion/update
    const dbPayload = {
      user_id: user.id,
      subscribed_categories: subscribedCategories,
      subscribed_states: subscribedStates,
      preferred_channels: preferredChannels,
      telegram_chat_id: preferredChannels.includes("telegram") ? (telegramChatId || null) : null,
      whatsapp_phone_number: preferredChannels.includes("whatsapp") ? (whatsappPhoneNumber || null) : null,
      updated_at: new Date().toISOString(),
    };

    // 3. Query existing subscription record for this candidate
    const { data: existingRows, error: checkError } = await supabase
      .table("user_subscriptions")
      .select("id")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (checkError) {
      console.error("[SubscriptionActions] Error checking existing subscription:", checkError.message);
      return {
        success: false,
        message: "An error occurred while verifying your subscription record.",
      };
    }

    let persistedRecord;

    if (existingRows && existingRows.length > 0) {
      // Update existing record
      const existingId = existingRows[0].id;
      const { data: updated, error: updateError } = await supabase
        .table("user_subscriptions")
        .update(dbPayload)
        .eq("id", existingId)
        .select()
        .single();

      if (updateError) {
        console.error("[SubscriptionActions] Error updating user_subscriptions:", updateError.message);
        return {
          success: false,
          message: "Failed to update your subscription preferences. Please try again.",
        };
      }
      persistedRecord = updated;
    } else {
      // Insert new record
      const { data: inserted, error: insertError } = await supabase
        .table("user_subscriptions")
        .insert({
          ...dbPayload,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        console.error("[SubscriptionActions] Error inserting user_subscriptions:", insertError.message);
        return {
          success: false,
          message: "Failed to initialize your subscription preferences. Please try again.",
        };
      }
      persistedRecord = inserted;
    }

    // 4. Revalidate preferences route cache and tags
    revalidateCandidatePreferences(user.id);

    return {
      success: true,
      message: "Your alert preferences have been successfully saved!",
      subscription: persistedRecord ? mapRowToUserSubscription(persistedRecord) : undefined,
    };
  } catch (error) {
    console.error("[SubscriptionActions] Unexpected fatal error:", error);
    return {
      success: false,
      message: "An unexpected server error occurred. Please try again later.",
    };
  }
}
