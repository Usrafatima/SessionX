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

const app = getApps().length
  ? getApps()[0]
  : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY)
      })
    });
const db = getFirestore(app);
const now = Date.now();
console.log("NOW:", new Date(now).toISOString());

const state = await db.collection("cronState").doc("notifications").get();
console.log("cronState exists:", state.exists, JSON.stringify(state.data() || null));
if (state.exists) {
  const lc = Number(state.data().lastCheckedAt);
  console.log("lastCheckedAt:", new Date(lc).toISOString(), "| age:", Math.round((now - lc) / 1000), "s");
}

// Are there history/deliveries for REAL (non-test) events at all?
const histSnap = await db.collection("notificationHistory").orderBy("timestamp", "desc").limit(30).get();
const real = [];
const test = [];
for (const d of histSnap.docs) {
  const data = d.data();
  if (String(data.eventId || data.id).includes("test")) test.push({ t: new Date(data.timestamp).toISOString(), id: data.eventId || data.id });
  else real.push({ t: new Date(data.timestamp).toISOString(), id: data.eventId || data.id, title: data.title });
}
console.log("\nHistory: real events:", real.length, "| test events:", test.length);
console.log("Real history entries:");
for (const r of real.slice(0, 10)) console.log("  ", r.t, r.id, r.title);

const delSnap = await db.collection("pushDeliveries").orderBy("createdAt", "desc").limit(30).get();
const dReal = [];
const dTest = [];
for (const d of delSnap.docs) {
  const data = d.data();
  if (String(data.eventId).includes("test")) dTest.push(new Date(data.createdAt).toISOString());
  else dReal.push({ t: new Date(data.createdAt).toISOString(), id: data.eventId });
}
console.log("\nDeliveries: real:", dReal.length, "| test:", dTest.length);
for (const r of dReal.slice(0, 10)) console.log("  ", r.t, r.id);
console.log("Latest test delivery:", dTest[0] || "none");
process.exit(0);
