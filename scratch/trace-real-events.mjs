// Traces the three real events (Sydney Open, NY Close, Weekly Candle — 21:00 UTC Aug 16)
// through Firestore: who wrote history, whether delivery claims exist (cron ran), and
// whether cronState advanced at the trigger times.
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

const now = Date.now();
console.log("NOW:", new Date(now).toISOString(), "UTC");
console.log("Expected r=10 trigger for the 21:00 UTC Aug 16 events: 2026-08-16T20:50:00.000Z UTC (Aug 17 01:50 PKT)");
console.log("Expected event times: 2026-08-16T21:00:00.000Z UTC (Aug 17 02:00 PKT)\n");

const state = await db.collection("cronState").doc("notifications").get();
if (state.exists) {
  const lc = Number(state.data().lastCheckedAt);
  console.log(`cronState.lastCheckedAt: ${new Date(lc).toISOString()} UTC (age ${Math.round((now - lc) / 1000)}s)`);
} else {
  console.log("cronState: MISSING");
}

console.log("\n=== notificationHistory (last 15, newest first) ===");
const histSnap = await db.collection("notificationHistory").orderBy("timestamp", "desc").limit(15).get();
if (histSnap.empty) console.log("(empty)");
for (const doc of histSnap.docs) {
  const d = doc.data();
  const marker = ["Sydney", "New York", "Weekly", "market-open", "market-close", "weekly-open"].some((s) => String(d.eventId).includes(s)) ? "  <<< REAL EVENT" : "";
  console.log(`- ${new Date(d.timestamp).toISOString()} | ${d.title} | id=${d.id} | ev=${d.eventId} | ok=${d.sentSuccessfully}${marker}`);
}

console.log("\n=== pushDeliveries (last 15, newest first) — proves whether the CRON ran the FCM path ===");
const delSnap = await db.collection("pushDeliveries").orderBy("createdAt", "desc").limit(15).get();
if (delSnap.empty) console.log("(empty) — the cron route has NOT claimed deliveries recently");
for (const doc of delSnap.docs) {
  const d = doc.data();
  console.log(`- ${new Date(d.createdAt).toISOString()} | ${d.eventId} | r=${d.reminder} | token=${String(d.tokenId).slice(0, 10)}`);
}

console.log("\n=== pushTokens (registered devices) ===");
const tokSnap = await db.collection("pushTokens").get();
for (const doc of tokSnap.docs) {
  const d = doc.data();
  console.log(`- ${doc.id.slice(0, 12)}… push=${d.preferences?.push} markets=${d.preferences?.markets} weekly=${d.preferences?.weekly} reminders=[${(d.preferences?.reminders || []).join(",")}] updated=${d.updatedAt ? new Date(d.updatedAt).toISOString() : "n/a"}`);
}
process.exit(0);
