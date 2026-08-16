const fs = require('fs');
const path = require('path');
const { cert, initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

// 1. Load .env manually
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, 'utf8');
  for (const line of envConfig.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.substring(0, eqIdx).trim();
      let val = trimmed.substring(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

function normalizePrivateKey(value) {
  if (!value) return undefined;
  let key = value.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  return key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\\/g, "").trim();
}

async function runPipelineTest() {
  console.log("=== STEP 1: INITIALIZING FIREBASE ADMIN ===");
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing Firebase Admin environment variables!");
    console.error({ projectId: !!projectId, clientEmail: !!clientEmail, privateKey: !!privateKey });
    return;
  }

  const app = getApps().length ? getApps()[0] : initializeApp({
    credential: cert({ projectId, clientEmail, privateKey })
  });

  const db = getFirestore(app);
  const messaging = getMessaging(app);

  console.log("=== STEP 2: READING TOKENS FROM pushTokens COLLECTION ===");
  const snapshot = await db.collection("pushTokens").get();
  console.log(`Found ${snapshot.docs.length} document(s) in 'pushTokens' collection.`);

  const tokens = [];
  snapshot.docs.forEach((doc) => {
    const data = doc.data();
    console.log(`Doc ID: ${doc.id}`);
    console.log(`Data:`, JSON.stringify(data, null, 2));
    if (data.token) {
      tokens.push(data.token);
    }
  });

  if (tokens.length === 0) {
    console.error("NO TOKENS FOUND IN pushTokens COLLECTION!");
    return;
  }

  console.log(`\nCollected ${tokens.length} token(s) to send test notification.`);

  console.log("=== STEP 3 & 4: SENDING TEST NOTIFICATION VIA FIREBASE ADMIN MESSAGING ===");
  const notificationPayload = {
    title: "Trading Time Pro",
    body: "🎉 Congratulations! Push notifications are working correctly."
  };

  console.log("Payload:", notificationPayload);

  let successCount = 0;
  let failureCount = 0;
  const errors = [];

  if (tokens.length === 1) {
    // Send single message via send() or sendEachForMulticast()
    console.log("Sending using sendEachForMulticast() with 1 token...");
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: tokens,
        notification: notificationPayload,
        webpush: {
          notification: {
            title: notificationPayload.title,
            body: notificationPayload.body,
            icon: "/icon-192x192.png",
          }
        }
      });
      successCount = response.successCount;
      failureCount = response.failureCount;
      console.log("\n=== STEP 5: FIREBASE MULTICAST RESPONSE ===");
      console.log(`successCount: ${response.successCount}`);
      console.log(`failureCount: ${response.failureCount}`);
      response.responses.forEach((res, index) => {
        if (!res.success) {
          console.error(`Token [${index}] failed:`, res.error);
          errors.push({ tokenIndex: index, error: res.error });
        } else {
          console.log(`Token [${index}] message ID:`, res.messageId);
        }
      });
    } catch (err) {
      console.error("Error calling sendEachForMulticast:", err);
      failureCount = tokens.length;
      errors.push({ error: err.message || err });
    }
  } else {
    try {
      const response = await messaging.sendEachForMulticast({
        tokens: tokens,
        notification: notificationPayload,
        webpush: {
          notification: {
            title: notificationPayload.title,
            body: notificationPayload.body,
            icon: "/icon-192x192.png",
          }
        }
      });
      successCount = response.successCount;
      failureCount = response.failureCount;
      console.log("\n=== STEP 5: FIREBASE MULTICAST RESPONSE ===");
      console.log(`successCount: ${response.successCount}`);
      console.log(`failureCount: ${response.failureCount}`);
      response.responses.forEach((res, index) => {
        if (!res.success) {
          console.error(`Token [${index}] failed:`, res.error);
          errors.push({ tokenIndex: index, error: res.error });
        } else {
          console.log(`Token [${index}] message ID:`, res.messageId);
        }
      });
    } catch (err) {
      console.error("Error calling sendEachForMulticast:", err);
      failureCount = tokens.length;
      errors.push({ error: err.message || err });
    }
  }

  console.log("\n=== SUMMARY ===");
  console.log({
    successCount,
    failureCount,
    errors
  });
}

runPipelineTest().catch(console.error);
