import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { getFirestore } from "firebase-admin/firestore";

function normalizePrivateKey(value?: string) {
  if (!value) return undefined;
  let key = value.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  // dotenv, Vercel, and copied service-account keys can arrive with either
  // one or two escaped backslashes before the newline marker, leaving residual backslashes.
  return key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\\/g, "").trim();
}

function adminConfig() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

export function getFirebaseAdmin(): App | null {
  const config = adminConfig();
  if (!config) return null;
  return getApps().length ? getApps()[0] : initializeApp({ credential: cert(config) });
}

export function getAdminMessaging() {
  const app = getFirebaseAdmin();
  return app ? getMessaging(app) : null;
}

export function getAdminDb() {
  const app = getFirebaseAdmin();
  return app ? getFirestore(app) : null;
}
