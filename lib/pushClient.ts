"use client";

import { deleteToken, getToken, onMessage } from "firebase/messaging";
import { getFirebaseConfigurationStatus, getFirebaseMessaging, getFirebaseMessagingServiceWorkerUrl, isFirebaseConfigured } from "@/lib/firebase";
import { AlertPreferences } from "@/lib/notificationPreferences";

export const fcmTokenKey = "ttp-fcm-token";

export type BrowserNotificationPermission = NotificationPermission | "unsupported";

export type PushRestoreResult = {
  enabled: boolean;
  token: string | null;
  message?: string;
  restoring?: boolean;
};

const RESTORE_TIMEOUT_MS = 12_000;

let registrationInFlight: Promise<string> | null = null;

export function getStoredFcmToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(fcmTokenKey);
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = window.setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms.`)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(id);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(id);
        reject(error);
      }
    );
  });
}

async function ensureServiceWorker() {
  const registration = await navigator.serviceWorker.register(getFirebaseMessagingServiceWorkerUrl(), { scope: "/" });
  await withTimeout(navigator.serviceWorker.ready, RESTORE_TIMEOUT_MS, "Service worker ready");
  return registration;
}

async function registerOrReuseToken(preferences: AlertPreferences) {
  if (registrationInFlight) return registrationInFlight;

  registrationInFlight = (async () => {
    const registration = await ensureServiceWorker();
    const token = await withTimeout(
      getToken(getFirebaseMessaging(), {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration
      }),
      RESTORE_TIMEOUT_MS,
      "FCM getToken"
    );
    if (!token) throw new Error("Unable to create a push subscription.");
    await fetch("/api/push/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, preferences: { ...preferences, push: true } })
    }).then(async (response) => {
      if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || "Unable to save your push subscription.");
    });
    localStorage.setItem(fcmTokenKey, token);
    return token;
  })();

  try {
    return await registrationInFlight;
  } finally {
    registrationInFlight = null;
  }
}

/**
 * Enable push for an explicit user action.
 * Only prompts the browser when permission is still "default".
 */
export async function enablePush(preferences: AlertPreferences) {
  if (!isFirebaseConfigured()) {
    throw new Error(`Firebase public configuration was not loaded by Next.js. Missing: ${getFirebaseConfigurationStatus().missing.join(", ")}.`);
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    throw new Error("This browser does not support web push notifications.");
  }

  let permission = Notification.permission;
  if (permission === "denied") {
    throw new Error("Notifications are blocked in your browser settings. Allow notifications for this site, then try again.");
  }
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  return registerOrReuseToken(preferences);
}

/**
 * Restore an already-enabled push preference without prompting.
 * Reuses a stored FCM token when present — does not call getToken unless the token is missing.
 */
export async function restorePushRegistration(preferences: AlertPreferences): Promise<PushRestoreResult> {
  if (!isFirebaseConfigured()) return { enabled: false, token: null, message: "Firebase is not configured." };
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    return { enabled: false, token: null, message: "This browser does not support web push notifications." };
  }

  const permission = Notification.permission;
  if (permission === "denied") {
    return {
      enabled: false,
      token: getStoredFcmToken(),
      message: "Browser notification permission is blocked. Open your browser site settings and allow notifications for SessionX — checking the box alone cannot override a denied permission."
    };
  }
  if (permission !== "granted") {
    return { enabled: false, token: getStoredFcmToken(), message: "Browser notification permission is required before push can be restored." };
  }

  const existing = getStoredFcmToken();
  if (existing) {
    // Fast path: reuse stored token and refresh Firestore prefs in the background.
    void syncPushPreferences({ ...preferences, push: true }).catch(() => undefined);
    void ensureServiceWorker().catch(() => undefined);
    return { enabled: true, token: existing };
  }

  try {
    const token = await registerOrReuseToken(preferences);
    return { enabled: true, token };
  } catch (error) {
    return {
      enabled: false,
      token: null,
      message: error instanceof Error ? error.message : "Unable to restore push notifications."
    };
  }
}

export async function syncPushPreferences(preferences: AlertPreferences) {
  const token = getStoredFcmToken();
  if (!token) return;
  await fetch("/api/push/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, preferences })
  });
}

export async function disablePush() {
  const token = getStoredFcmToken();
  if (token) {
    await fetch("/api/push/tokens", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token })
    });
  }
  try {
    await deleteToken(getFirebaseMessaging());
  } catch {
    /* local cleanup is still useful */
  }
  localStorage.removeItem(fcmTokenKey);
}

export function listenForForegroundPush(callback: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void) {
  if (!isFirebaseConfigured() || typeof window === "undefined") return () => undefined;
  try {
    return onMessage(getFirebaseMessaging(), (payload) =>
      callback({ title: payload.notification?.title, body: payload.notification?.body, data: payload.data })
    );
  } catch {
    // Unsupported browser / missing SW APIs must not crash the dashboard render path.
    return () => undefined;
  }
}
