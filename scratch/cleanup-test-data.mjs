import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
function normalizePrivateKey(value) {
  if (!value) return undefined;
  let key = value.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  return key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\\/g, "").trim();
}
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY) }) });
const db = getFirestore(app);

// History test artifacts
const histSnap = await db.collection("notificationHistory").get();
let deletedHistory = 0;
for (const doc of histSnap.docs) {
  const d = doc.data();
  const id = String(d.id || "");
  const eventId = String(d.eventId || "");
  const isTest =
    eventId.startsWith("test-cron-") ||
    id.startsWith("dedup-test-") ||
    eventId.includes("e2e-browser") ||
    eventId.includes("push-debug") ||
    eventId.includes("dedup-test") ||
    id.includes("market-open-Tokyo-2026-08-16") ||
    id.includes("overlap-start-Sydney + Tokyo-2026-08-16") ||
    id.includes("kill-zone-start-Asian-2026-08-15") ||
    id.startsWith("test-");
  if (isTest) { await doc.ref.delete(); deletedHistory++; }
}
console.log(`deleted ${deletedHistory} test history entries`);

// Delivery artifacts (test events + leftover debug sends)
const delSnap = await db.collection("pushDeliveries").get();
let deletedDeliveries = 0;
for (const doc of delSnap.docs) {
  const d = doc.data();
  const eventId = String(d.eventId || "");
  if (eventId.includes("test") || eventId.includes("Debug") || eventId.includes("dedup")) { await doc.ref.delete(); deletedDeliveries++; }
}
console.log(`deleted ${deletedDeliveries} test delivery claims`);

process.exit(0);
