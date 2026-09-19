/**
 * @file lib/push/firebase-config.ts
 * @module FirebaseConfiguration
 * @description Strongly-typed Firebase Cloud Messaging (FCM) configuration and credentials manager.
 * Safely resolves client and server configuration parameters from environment variables.
 * 
 * Task ID: TASK-05020101 (Subtask: SUB-0502010101)
 * Architecture Reference: ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security - Zero Hardcoded Secrets)
 * 
 * Complies with:
 * - TypeScript strict mode (Zero `any`)
 * - Environment variable isolation (Client `NEXT_PUBLIC_` vs Server-only credentials)
 * - Safe fallback mechanisms when push notifications are unconfigured
 */

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface FcmPushData {
  notificationId?: string;
  slug?: string;
  category?: string;
  targetUrl?: string;
  clickAction?: string;
  publishedAt?: string;
  [key: string]: string | undefined;
}

export interface FcmNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  tag?: string;
  data?: FcmPushData;
}

/**
 * Checks whether Firebase client configuration is available in environment variables.
 * 
 * @returns {boolean} True if all essential client parameters exist
 */
export function isFirebaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  );
}

/**
 * Retrieves the Firebase client configuration object for browser SDK initialization.
 * 
 * @returns {FirebaseClientConfig} Firebase web client credentials
 * @throws {Error} If required public Firebase environment variables are missing
 */
export function getFirebaseClientConfig(): FirebaseClientConfig {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseapp.com`;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`;
  const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;

  if (!apiKey || !projectId || !messagingSenderId || !appId) {
    throw new Error(
      "[FirebaseConfig] Missing required Firebase client configuration in environment. " +
      "Ensure NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID, " +
      "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, and NEXT_PUBLIC_FIREBASE_APP_ID are set in .env.local."
    );
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket,
    messagingSenderId,
    appId,
  };
}

/**
 * Retrieves the public Web Push VAPID key for browser registration.
 * 
 * @returns {string | null} Public VAPID key or null if unconfigured
 */
export function getFirebaseVapidKey(): string | null {
  return process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || null;
}

/**
 * Server-only helper to obtain Firebase Server credentials for push dispatching.
 * Never invoke from client components or browser bundles.
 * 
 * @returns {string | null} Firebase server key or service account string
 */
export function getFirebaseServerKey(): string | null {
  if (typeof window !== "undefined") {
    throw new Error("[FirebaseConfig] Security Violation: Server key requested in browser environment.");
  }
  return process.env.FIREBASE_SERVER_KEY || null;
}
