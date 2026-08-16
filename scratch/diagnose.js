const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

// Load .env manually
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        let val = trimmed.slice(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
    }
  }
}

function normalizePrivateKey(value) {
  if (!value) return undefined;
  let key = value.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  return key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\\/g, "").trim();
}

function initAdmin() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing Firebase Admin config!");
    return null;
  }
  const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return { db: getFirestore(app), messaging: getMessaging(app) };
}

async function runDiagnostics() {
  const admin = initAdmin();
  if (!admin) return;

  console.log("\n================ FIRESTORE STORED PUSH TOKENS ================");
  const tokensSnapshot = await admin.db.collection("pushTokens").get();
  console.log(`Total pushTokens documents in Firestore: ${tokensSnapshot.docs.length}`);
  const tokens = [];
  tokensSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    tokens.push(data);
    console.log(`Doc ID: ${doc.id}`);
    console.log(`  Token: ${data.token ? data.token.slice(0, 20) + "..." : "MISSING"}`);
    console.log(`  Preferences:`, data.preferences);
    console.log(`  Updated At:`, data.updatedAt ? new Date(data.updatedAt).toISOString() : "N/A");
  });

  console.log("\n================ FIRESTORE PUSH DELIVERIES ================");
  const deliveriesSnapshot = await admin.db.collection("pushDeliveries").get();
  console.log(`Total pushDeliveries records: ${deliveriesSnapshot.docs.length}`);
  deliveriesSnapshot.docs.forEach((doc) => {
    const data = doc.data();
    console.log(`Delivery ID: ${doc.id}`);
    console.log(`  Event ID:   ${data.eventId}`);
    console.log(`  Reminder:   ${data.reminder}`);
    console.log(`  Created At: ${data.createdAt ? new Date(data.createdAt).toISOString() : "N/A"}`);
  });
}

runDiagnostics().catch(console.error);
