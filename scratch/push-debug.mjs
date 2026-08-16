import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env
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
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin env vars");
  process.exit(1);
}

const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);
const messaging = getMessaging(app);

console.log("=== PUSH TOKENS ===");
const tokenSnap = await db.collection("pushTokens").get();
const tokens = [];
for (const doc of tokenSnap.docs) {
  const d = doc.data();
  const real = d.token && !String(d.token).startsWith("persisted-token") && d.token.length > 20;
  console.log(`- ${doc.id.slice(0, 10)}… pref.push=${d.preferences?.push} news=${d.preferences?.news} updated=${d.updatedAt ? new Date(d.updatedAt).toISOString() : "n/a"} ${real ? "REAL" : "FAKE/INVALID"}`);
  if (real) tokens.push({ id: doc.id, token: d.token });
}
console.log(`REAL tokens: ${tokens.length}`);

console.log("\n=== NOTIFICATION HISTORY (last 12) ===");
const histSnap = await db.collection("notificationHistory").orderBy("timestamp", "desc").limit(12).get();
for (const doc of histSnap.docs) {
  const d = doc.data();
  console.log(`- ${new Date(d.timestamp).toISOString()} | ${d.title} | ok=${d.sentSuccessfully} | cat=${d.category}`);
}

console.log("\n=== PUSH DELIVERIES (last 8) ===");
const delSnap = await db.collection("pushDeliveries").orderBy("createdAt", "desc").limit(8).get();
for (const doc of delSnap.docs) {
  const d = doc.data();
  console.log(`- ${new Date(d.createdAt).toISOString()} | ${d.eventId} | r=${d.reminder} | tokenId=${String(d.tokenId).slice(0, 10)}`);
}

console.log("\n=== CONTROLLED FCM SEND (cron payload shape) ===");
const displayTitle = "🧪 Push Debug Test";
const body = "Controlled diagnostic message sent at " + new Date().toISOString();
for (const { id, token } of tokens) {
  try {
    const messageId = await messaging.send({
      token,
      notification: { title: displayTitle, body },
      webpush: {
        fcmOptions: { link: "/dashboard#notifications" },
        notification: { title: displayTitle, body, icon: "/icons/icon.svg", badge: "/icons/badge.svg" }
      },
      data: {
        eventId: `push-debug-${Date.now()}`,
        kind: "economic-news",
        category: "news",
        title: displayTitle,
        body,
        reminder: "0",
        page: "calendar",
        createdAt: String(Date.now())
      }
    });
    console.log(`- ${id.slice(0, 10)}… SEND OK messageId=${messageId}`);
  } catch (err) {
    console.log(`- ${id.slice(0, 10)}… SEND FAILED code=${err?.code} msg=${err?.message}`);
  }
}
console.log("\nDone.");
process.exit(0);
