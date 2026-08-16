const { cert, initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

function normalizePrivateKey(value) {
  if (!value) return undefined;
  let key = value.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  // Replace double-escaped or single-escaped \n with real newline
  key = key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n");
  // Remove any remaining stray backslashes (which were double-escaped \ in .env double-quotes)
  key = key.replace(/\\/g, "");
  return key.trim();
}

const rawKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
const normalizedKey = normalizePrivateKey(rawKey);

console.log("=== COMPREHENSIVE KEY ANALYSIS ===");
console.log("Starts with -----BEGIN PRIVATE KEY-----:", normalizedKey?.startsWith("-----BEGIN PRIVATE KEY-----"));
console.log("Ends with -----END PRIVATE KEY-----:", normalizedKey?.endsWith("-----END PRIVATE KEY-----"));
console.log("First line:", JSON.stringify(normalizedKey?.split("\n")[0]));
console.log("Last line:", JSON.stringify(normalizedKey?.split("\n").slice(-1)[0]));
console.log("Total lines:", normalizedKey?.split("\n").length);

try {
  const credential = cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: normalizedKey
  });
  console.log("\n=== CERT CREDENTIAL SUCCESS ===");
  const app = getApps().length ? getApps()[0] : initializeApp({ credential });
  console.log("Firebase Admin App Initialized successfully! App Name:", app.name);

  const db = getFirestore(app);
  console.log("Firestore Instance Obtained successfully!");
} catch (err) {
  console.log("\n=== CAUGHT ERROR ===");
  console.error(err);
}
