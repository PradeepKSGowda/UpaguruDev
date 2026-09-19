/**
 * @file lib/push/client-token.ts
 * @module ClientPushManager
 * @description Client-side utility for registering the Firebase messaging Service Worker,
 * requesting browser push permissions, and acquiring FCM device tokens.
 * 
 * Task ID: TASK-05020101 (Subtasks: SUB-0502010101, SUB-0502010102)
 * Architecture Reference: ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
 * 
 * Complies with:
 * - Browser compatibility guards (safe SSR execution, feature detection)
 * - Dynamic query param propagation to Service Worker
 * - VAPID public key authentication
 */

import { getFirebaseClientConfig, getFirebaseVapidKey, isFirebaseConfigured } from "./firebase-config";
import { saveDeviceTokenAction } from "./actions";

export interface PushPermissionResult {
  supported: boolean;
  permission: NotificationPermission | "unsupported";
  token?: string;
  error?: string;
}

/**
 * Checks if the current browser environment supports Service Workers and Web Push notifications.
 */
export function isWebPushSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/**
 * Registers the /firebase-messaging-sw.js service worker with environment config query parameters.
 */
export async function registerPushServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isWebPushSupported()) {
    console.warn("[PushManager] Web Push is not supported in this browser environment.");
    return null;
  }

  try {
    let swUrl = "/firebase-messaging-sw.js";

    if (isFirebaseConfigured()) {
      const config = getFirebaseClientConfig();
      const params = new URLSearchParams({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      });
      swUrl = `${swUrl}?${params.toString()}`;
    }

    const registration = await navigator.serviceWorker.register(swUrl, {
      scope: "/",
    });

    return registration;
  } catch (err) {
    console.error("[PushManager] Service Worker registration failed:", err);
    return null;
  }
}

/**
 * Requests browser push permission and retrieves the registration token.
 */
export async function subscribeToWebPush(): Promise<PushPermissionResult> {
  if (!isWebPushSupported()) {
    return { supported: false, permission: "unsupported" };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return {
        supported: true,
        permission,
        error: "Notification permission was not granted by user.",
      };
    }

    const swRegistration = await registerPushServiceWorker();
    if (!swRegistration) {
      return {
        supported: true,
        permission,
        error: "Could not register service worker.",
      };
    }

    // Wait for the service worker to become active
    await navigator.serviceWorker.ready;

    // Check if Firebase client library is available or retrieve subscription via pushManager
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: getFirebaseVapidKey() || undefined,
    });

    const token = JSON.stringify(subscription);

    // Persist token to candidate's user_subscriptions profile
    if (token) {
      try {
        await saveDeviceTokenAction(token);
      } catch (saveErr) {
        console.warn("[PushManager] Could not sync device token to server:", saveErr);
      }
    }

    return {
      supported: true,
      permission,
      token,
    };
  } catch (err) {
    console.error("[PushManager] Error subscribing to web push:", err);
    return {
      supported: true,
      permission: Notification.permission,
      error: err instanceof Error ? err.message : "Unknown subscription error.",
    };
  }
}
