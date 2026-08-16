import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { getMessaging, Messaging } from "firebase/messaging";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const requiredPublicVariables = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
  "NEXT_PUBLIC_FIREBASE_VAPID_KEY"
] as const;

export function getFirebaseConfigurationStatus() {
  const values: Record<(typeof requiredPublicVariables)[number], string | undefined> = {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_VAPID_KEY: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  };
  const missing = requiredPublicVariables.filter((name) => !values[name]);
  return { configured: missing.length === 0, missing };
}

export function isFirebaseConfigured() {
  return getFirebaseConfigurationStatus().configured;
}

export function getFirebaseMessagingServiceWorkerUrl() {
  const params = new URLSearchParams({
    apiKey: config.apiKey ?? "",
    projectId: config.projectId ?? "",
    messagingSenderId: config.messagingSenderId ?? "",
    appId: config.appId ?? ""
  });
  return `/firebase-messaging-sw.js?${params.toString()}`;
}

export function getFirebaseApp(): FirebaseApp {
  if (!isFirebaseConfigured()) throw new Error(`Firebase client configuration is unavailable. Missing: ${getFirebaseConfigurationStatus().missing.join(", ")}.`);
  return getApps().length ? getApp() : initializeApp(config);
}

export function getFirebaseMessaging(): Messaging {
  if (typeof window === "undefined") throw new Error("Firebase Messaging is only available in the browser.");
  return getMessaging(getFirebaseApp());
}
