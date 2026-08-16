// Verifies (a) atomic dedup of history + delivery claims against real Firestore,
// (b) the cron route's delayed-execution tolerance decision logic.
import { createHash } from "crypto";
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

// --- 1. Atomic history dedup ---
const eventId = `dedup-test-${Date.now()}`;
const historyId = `${eventId}-10`;
const item = {
  id: historyId, title: "Dedup Test", body: "body", eventType: "market-open",
  eventId, timestamp: Date.now(), category: "markets", sentSuccessfully: true, read: false, reminder: 10
};
const first = await db.collection("notificationHistory").doc(historyId).create({ ...item }).then(() => true).catch(() => false);
const second = await db.collection("notificationHistory").doc(historyId).create({ ...item }).then(() => true).catch(() => false);
console.log(`history dedup: first=${first} second=${second} ${first === true && second === false ? "PASS" : "FAIL"}`);

// --- 2. Atomic delivery dedup (same token+event+reminder) ---
const token = "dedup-test-token";  const hash = (s) => createHash("sha256").update(s).digest("hex");
const deliveryId = hash(`${token}:${eventId}:10`);
const d1 = await db.collection("pushDeliveries").doc(deliveryId).create({ createdAt: Date.now(), eventId, reminder: 10 }).then(() => true).catch(() => false);
const d2 = await db.collection("pushDeliveries").doc(deliveryId).create({ createdAt: Date.now(), eventId, reminder: 10 }).then(() => true).catch(() => false);
console.log(`delivery dedup: first=${d1} second=${d2} ${d1 === true && d2 === false ? "PASS" : "FAIL"}`);

// cleanup
await db.collection("notificationHistory").doc(historyId).delete();
await db.collection("pushDeliveries").doc(deliveryId).delete();

// --- 3. Delayed-execution tolerance (exact logic from /api/cron/notifications/route.ts) ---
const PUSH_FRESHNESS_MS = 30 * 60_000;
const MAX_LOOKBACK_MS = 24 * 60 * 60_000;
const nowMs = Date.now();
function evaluate({ lastCheckedAt, trigger }) {
  const sinceMs = Math.max(lastCheckedAt, nowMs - MAX_LOOKBACK_MS);
  const due = trigger > sinceMs && trigger <= nowMs;
  const ageMs = nowMs - trigger;
  return { due, pushFresh: ageMs <= PUSH_FRESHNESS_MS, ageMs };
}
const cases = [
  { name: "on time (0s delay)", lastCheckedAt: nowMs - 60_000, trigger: nowMs - 5000, expectDue: true, expectPush: true },
  { name: "5 min delayed", lastCheckedAt: nowMs - 7 * 60_000, trigger: nowMs - 5 * 60_000, expectDue: true, expectPush: true },
  { name: "29 min delayed (within 30 min tolerance)", lastCheckedAt: nowMs - 31 * 60_000, trigger: nowMs - 29 * 60_000, expectDue: true, expectPush: true },
  { name: "45 min delayed (outside push tolerance)", lastCheckedAt: nowMs - 47 * 60_000, trigger: nowMs - 45 * 60_000, expectDue: true, expectPush: false },
  { name: "trigger before lastCheckedAt (already handled)", lastCheckedAt: nowMs - 60_000, trigger: nowMs - 90_000, expectDue: false, expectPush: false },
  { name: "trigger in future (not yet due)", lastCheckedAt: nowMs - 60_000, trigger: nowMs + 60_000, expectDue: false, expectPush: false },
  { name: "trigger older than 24h lookback", lastCheckedAt: nowMs - 25 * 60 * 60_000, trigger: nowMs - 25 * 60 * 60_000 + 1000, expectDue: false, expectPush: false }
];
let pass = true;
for (const c of cases) {
  const r = evaluate(c);
  // The route computes freshness only when due (it `continue`s otherwise), so assert freshness only for due cases.
  const ok = r.due === c.expectDue && (!r.due || r.pushFresh === c.expectPush);
  if (!ok) pass = false;
  console.log(`${ok ? "PASS" : "FAIL"} ${c.name}: due=${r.due} (exp ${c.expectDue}) pushFresh=${r.due ? r.pushFresh : "n/a"} (exp ${c.expectDue ? c.expectPush : "n/a"}) ageMs=${r.ageMs}`);
}
console.log(pass ? "TOLERANCE LOGIC: PASS" : "TOLERANCE LOGIC: FAIL");
process.exit(pass ? 0 : 1);
