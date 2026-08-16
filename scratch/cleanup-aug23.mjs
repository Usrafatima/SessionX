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

// 1. Remove FCM tokens registered by this session's headless tests (21:20-21:35 UTC window).
const winStart = Date.UTC(2026, 7, 16, 21, 20, 0);
const winEnd = Date.UTC(2026, 7, 16, 21, 35, 0);
const tSnap = await db.collection("pushTokens").get();
let removedTokens = 0;
for (const doc of tSnap.docs) {
  const d = doc.data();
  const updated = Number(d.updatedAt) || new Date(d.updatedAt).getTime() || 0;
  if (updated >= winStart && updated <= winEnd) {
    await db.collection("pushTokens").doc(doc.id).delete();
    removedTokens++;
    console.log("removed test token:", (d.token || "").slice(0, 16), new Date(updated).toISOString());
  }
}

// 2. Remove future-dated (shifted-clock) Aug 23 history entries created by the test.
const hSnap = await db.collection("notificationHistory").get();
let removedHistory = 0;
for (const doc of hSnap.docs) {
  const d = doc.data();
  const id = String(d.id || "");
  const ts = Number(d.timestamp) || 0;
  if (id.includes("2026-08-23") && ts > Date.now()) {
    await db.collection("notificationHistory").doc(doc.id).delete();
    removedHistory++;
    console.log("removed future-dated history entry:", id, new Date(ts).toISOString());
  }
}
console.log("tokens removed:", removedTokens, "| history removed:", removedHistory, "| tokens remaining:", tSnap.size - removedTokens);
process.exit(0);
