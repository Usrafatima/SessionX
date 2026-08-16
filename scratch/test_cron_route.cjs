const fs = require('fs');
const path = require('path');
const { cert, initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');

// Load .env
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

async function testCronPipeline() {
  console.log("=== VERCEL CRON ROUTE VERIFICATION ===");
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY);
  const cronSecret = process.env.CRON_SECRET;

  console.log("Check Auth Secret:", !!cronSecret ? "VALID (CRON_SECRET set)" : "MISSING");

  const app = getApps().length ? getApps()[0] : initializeApp({
    credential: cert({ projectId, clientEmail, privateKey })
  });

  const db = getFirestore(app);
  const messaging = getMessaging(app);

  // Read push tokens (same as route.ts)
  const snapshot = await db.collection("pushTokens").get();
  const defaultPreferences = {
    markets: true, killZones: true, overlaps: true, weekly: true, news: false, sound: true, desktop: true, reminders: [10, 5, 1, 0]
  };
  const subscriptions = snapshot.docs
    .map(doc => doc.data())
    .filter(item => Boolean(item.token))
    .map(item => ({ ...item, preferences: { ...defaultPreferences, ...item.preferences } }));

  console.log(`Fetched ${subscriptions.length} active subscription(s) for cron dispatch.`);

  // Test actual messaging.send call format used in route.ts
  const pageFor = (kind) => kind.startsWith("market") ? "market-status" : kind.startsWith("kill") ? "kill-zones" : kind === "overlap-start" ? "overlaps" : kind === "weekly-open" ? "weekly-candle" : "calendar";

  const testEvent = {
    id: `cron-test-${Date.now()}`,
    kind: "market-open",
    title: "Cron Test Session",
    description: "Vercel Cron notification pipeline test execution.",
    emoji: "⏰",
    category: "markets"
  };

  const now = new Date();
  let sentCount = 0;
  const errors = [];

  for (const subscription of subscriptions) {
    if (!subscription.preferences[testEvent.category] || !subscription.preferences.reminders.includes(0)) continue;
    
    // Simulate claimDelivery check with a test delivery doc ID
    const testDeliveryId = `test-delivery-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const deliveryRef = db.collection("pushDeliveries").doc(testDeliveryId);
    await deliveryRef.set({ createdAt: Date.now(), test: true });

    try {
      console.log(`Sending notification to token: ${subscription.token.substring(0, 15)}... via messaging.send()`);
      const res = await messaging.send({
        token: subscription.token,
        webpush: { fcmOptions: { link: `/?page=${pageFor(testEvent.kind)}` } },
        data: {
          eventId: testEvent.id,
          kind: testEvent.kind,
          title: `${testEvent.emoji} ${testEvent.title}`,
          body: testEvent.description,
          page: pageFor(testEvent.kind),
          createdAt: String(now.getTime())
        }
      });
      console.log("CRON MSG SUCCESS ID:", res);
      sentCount++;

      // Clean up test delivery doc
      await deliveryRef.delete();
    } catch (err) {
      console.error("CRON MSG ERROR:", err);
      errors.push(err.message || err);
    }
  }

  console.log("\n=== VERCEL CRON NOTIFICATION ROUTE RESULT ===");
  console.log({
    ok: true,
    sentCount,
    checkedAt: now.toISOString(),
    errors
  });
}

testCronPipeline().catch(console.error);
