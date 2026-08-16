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

const tokens = new Map();
const tSnap = await db.collection("pushTokens").get();
for (const doc of tSnap.docs) {
  const d = doc.data();
  tokens.set(doc.id, (d.token || "").slice(0, 16));
}

const del = await db.collection("pushDeliveries")
  .where("eventId", "==", "market-open-Sydney-2026-08-16")
  .get();
const byToken = new Map();
for (const doc of del.docs) {
  const d = doc.data();
  byToken.set(d.tokenId, (byToken.get(d.tokenId) || 0) + 1);
}
console.log("Deliveries for market-open-Sydney-2026-08-16 by tokenId:");
for (const [tid, n] of byToken) {
  console.log("-", tid.slice(0, 16), "count:", n, "| token:", tokens.get(tid) || "(removed)");
}
console.log("\nToken count:", tokens.size);
process.exit(0);
