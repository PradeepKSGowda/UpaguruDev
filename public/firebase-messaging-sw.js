/**
 * @file public/firebase-messaging-sw.js
 * @description Web Push Service Worker for UPA-GURU.
 * Handles background push notifications, custom notification layouts, badge rendering,
 * and deep-link click routing via Firebase Cloud Messaging (FCM).
 * 
 * Task ID: TASK-05020101 (Subtask: SUB-0502010102)
 * Architecture Reference: ADR-007 (Omnichannel Push Alert Engine), ADR-013 (Security)
 * 
 * Scope: Served at root URL (/firebase-messaging-sw.js) covering the entire application origin.
 */

/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

// 1. Resolve Firebase Configuration from Query Params or Defaults
const urlParams = new URLSearchParams(location.search);

const firebaseConfig = {
  apiKey: urlParams.get("apiKey") || "PLACEHOLDER_FIREBASE_API_KEY",
  authDomain: urlParams.get("authDomain") || "upaguru-prod.firebaseapp.com",
  projectId: urlParams.get("projectId") || "upaguru-prod",
  storageBucket: urlParams.get("storageBucket") || "upaguru-prod.appspot.com",
  messagingSenderId: urlParams.get("messagingSenderId") || "123456789012",
  appId: urlParams.get("appId") || "1:123456789012:web:abcdef123456",
};

// Initialize Firebase in Service Worker
try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
} catch (initErr) {
  console.warn("[FCM Service Worker] Firebase initialization deferred:", initErr);
}

// 2. Initialize Messaging and Background Message Handler
try {
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.info("[FCM Service Worker] Received background push message:", payload);

    const notificationData = payload.data || {};
    const notificationTitle =
      payload.notification?.title ||
      notificationData.title ||
      "New Exam Alert | UPA-GURU";

    const notificationBody =
      payload.notification?.body ||
      notificationData.body ||
      "A new official government recruitment notification has been published.";

    const targetUrl =
      notificationData.targetUrl ||
      notificationData.clickAction ||
      (notificationData.slug ? `/notification/${notificationData.slug}` : "/");

    const notificationOptions = {
      body: notificationBody,
      icon: payload.notification?.icon || notificationData.icon || "/favicon.ico",
      badge: payload.notification?.badge || "/favicon.ico",
      image: payload.notification?.image || notificationData.image,
      tag: payload.notification?.tag || notificationData.notificationId || "upaguru-exam-alert",
      renotify: true,
      vibrate: [200, 100, 200],
      data: {
        targetUrl: targetUrl,
        notificationId: notificationData.notificationId,
        slug: notificationData.slug,
        category: notificationData.category,
        timestamp: Date.now(),
      },
      actions: [
        {
          action: "view_exam",
          title: "View Exam Details",
        },
        {
          action: "dismiss",
          title: "Dismiss",
        },
      ],
    };

    return self.registration.showNotification(notificationTitle, notificationOptions);
  });
} catch (messagingErr) {
  console.warn("[FCM Service Worker] Messaging listener initialization note:", messagingErr);
}

// 3. Fallback Raw Push Event Listener
self.addEventListener("push", (event) => {
  if (!event.data) return;

  try {
    const rawPayload = event.data.json();
    // If handled by Firebase SDK, skip duplicate notification
    if (rawPayload.fcmMessageId) return;

    const title = rawPayload.title || "UPA-GURU Exam Alert";
    const options = {
      body: rawPayload.body || "New notification available.",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: {
        targetUrl: rawPayload.targetUrl || "/",
      },
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    // Plain text push payload fallback
    const textBody = event.data.text();
    event.waitUntil(
      self.registration.showNotification("UPA-GURU Alert", {
        body: textBody,
        icon: "/favicon.ico",
      })
    );
  }
});

// 4. Notification Click & Deep-Link Navigation Router
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // If user clicked the "Dismiss" action button
  if (event.action === "dismiss") {
    return;
  }

  const notificationData = event.notification.data || {};
  const destinationUrl = notificationData.targetUrl || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there is already an open tab belonging to UPA-GURU
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && "focus" in client) {
            client.focus();
            if ("navigate" in client) {
              return client.navigate(destinationUrl);
            }
            return client;
          }
        }
        // If no matching client window is open, open a new one
        if (self.clients.openWindow) {
          return self.clients.openWindow(destinationUrl);
        }
      })
  );
});

// 5. Service Worker Lifecycle Management (Immediate Activation)
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
