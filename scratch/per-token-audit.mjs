// Simulates the exact cron-route filtering for the next REAL event against each
// registered push token: push gate, category gate, reminder gate, dedup, freshness.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getTradingEvents } from "../lib/tradingSchedule.ts";

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

const tokenSnap = await db.collection("pushTokens").get();
const tokens = tokenSnap.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));

const now = new Date();
const nextReal = getTradingEvents(now).filter((e) => e.at.getTime() > now.getTime()).sort((a, b) => a.at - b.at)[0];
console.log(`NEXT REAL EVENT: ${nextReal.title} (${nextReal.id}) @ ${nextReal.at.toISOString()} UTC, category=${nextReal.category}`);

// delivery claims that already exist for this event (would dedup-skip)
const claimSnap = await db.collection("pushDeliveries").where("eventId", "==", nextReal.id).get();
const existingClaims = new Set(claimSnap.docs.map((d) => d.data().reminder));

console.log(`\nEXISTING DELIVERY CLAIMS for this event: ${existingClaims.size ? [...existingClaims].join(", ") : "none"}\n`);

for (const t of tokens) {
  const prefs = { ...t.preferences };
  const push = prefs.push !== false;
  const category = Boolean(prefs[nextReal.category]);
  for (const r of [10, 5, 1, 0]) {
    const reminder = Array.isArray(prefs.reminders) && prefs.reminders.includes(r);
    const alreadyClaimed = existingClaims.has(r);
    const reasons = [];
    if (!push) reasons.push("prefs.push disabled");
    if (!category) reasons.push(`category '${nextReal.category}' off`);
    if (!reminder) reasons.push(`reminder ${r} not in [${(prefs.reminders || []).join(",")}]`);
    if (alreadyClaimed) reasons.push("delivery already claimed");
    const decision = reasons.length ? "SKIP" : "SEND";
    console.log(`${decision} | token=${t.id.slice(0, 10)}… | event=${nextReal.id} | r=${r} | push=${push} | category=${category} | reminder=${reminder} | claimed=${alreadyClaimed}${reasons.length ? " | reason: " + reasons.join("; ") : ""}`);
  }
}
process.exit(0);
