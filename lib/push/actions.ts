/**
 * @file lib/push/actions.ts
 * @module PushServerActions
 * @description Next.js 15 Server Action to persist browser FCM push registration tokens
 * into public.user_subscriptions for the authenticated candidate.
 * 
 * Task ID: TASK-05020101 (Subtask: SUB-0502010101)
 * Architecture Reference: ADR-001 (Server Actions), ADR-002 (Database), ADR-007 (Push Alerts), ADR-013 (Security)
 * 
 * Complies with:
 * - Next.js 15 Server Actions with "use server" directive
 * - Strict user session identity binding (prevents token poisoning / IDOR)
 * - Row Level Security enforcement
 */

"use server";

import { createServerClient } from "@/lib/supabase/server";

export interface SaveTokenResult {
  success: boolean;
  message: string;
}

/**
 * Saves or updates the FCM Web Push device registration token for the current user.
 * 
 * @param {string} token Browser push registration token or stringified PushSubscription
 * @returns {Promise<SaveTokenResult>} Status of persistence
 */
export async function saveDeviceTokenAction(token: string): Promise<SaveTokenResult> {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return { success: false, message: "Invalid push token provided." };
  }

  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, message: "User must be authenticated to register device token." };
    }

    const { data: existingRows } = await supabase
      .table("user_subscriptions")
      .select("id, preferred_channels")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (existingRows && existingRows.length > 0) {
      const currentChannels = existingRows[0].preferred_channels || [];
      const updatedChannels = Array.from(new Set([...currentChannels, "web_push"]));

      await supabase
        .table("user_subscriptions")
        .update({
          fcm_device_token: token.trim(),
          preferred_channels: updatedChannels,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingRows[0].id);
    } else {
      await supabase.table("user_subscriptions").insert({
        user_id: user.id,
        fcm_device_token: token.trim(),
        preferred_channels: ["web_push"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return { success: true, message: "Device registered successfully for Web Push alerts." };
  } catch (err) {
    console.error("[PushServerActions] Error saving device token:", err);
    return { success: false, message: "Server error occurred while saving device token." };
  }
}
