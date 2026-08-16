const fs = require("fs");
const path = require("path");
const { cert, initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// Load .env manually
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

(async () => {
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
  const snap = await db.collection("pushTokens").get();
  let removed = 0;
  for (const doc of snap.docs) {
    const d = doc.data();
    if (d.token && String(d.token).startsWith("persisted-token")) {
      await doc.ref.delete();
      removed++;
      console.log("removed junk token doc", doc.id.slice(0, 12));
    }
  }
  console.log("done, removed:", removed);
  process.exit(0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
