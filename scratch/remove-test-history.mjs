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

// Entries created by the controlled test with SHIFTED (future) timestamps.
const ids = ["market-open-Sydney-2026-08-17-0", "market-close-New York-2026-08-17-0"];
for (const id of ids) {
  const ref = db.collection("notificationHistory").doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    const t = Number(snap.data().timestamp);
    // Only delete if the timestamp is in the future (shifted-clock artifact) — this
    // guards against deleting a legitimately-future real entry the user created.
    if (t > Date.now()) {
      await ref.delete();
      console.log("removed future-dated history entry:", id, new Date(t).toISOString());
    } else {
      console.log("kept (timestamp not in future):", id, new Date(t).toISOString());
    }
  } else {
    console.log("not found:", id);
  }
}
process.exit(0);
