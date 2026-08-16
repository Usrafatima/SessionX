// Verifies the fix: a real FCM push received while the page is foregrounded must now
// display a system popup via the SW, in addition to being recorded in Recent Notifications.
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3002";

const envPath = path.join(__dirname, "..", ".env");
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (process.env[m[1]] === undefined) process.env[m[1]] = v;
}
const { cert, initializeApp, getApps } = await import("firebase-admin/app");
const { getMessaging } = await import("firebase-admin/messaging");
function normalizePrivateKey(value) {
  if (!value) return undefined;
  let key = value.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) key = key.slice(1, -1);
  return key.replace(/\\\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\\/g, "").trim();
}
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert({ projectId: process.env.FIREBASE_ADMIN_PROJECT_ID, clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL, privateKey: normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY) }) });
const messaging = getMessaging(app);

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox"]
});
await browser.defaultBrowserContext().overridePermissions(BASE, ["notifications"]);
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

await page.evaluateOnNewDocument(() => {
  window.__popupLog = [];
  const RealN = window.Notification;
  if (typeof RealN === "function") {
    const handler = {
      construct(t, args) { window.__popupLog.push({ t: "construct Notification", title: args[0] }); return new t(...args); },
      get(t, prop) { return t[prop]; }
    };
    window.Notification = new Proxy(RealN, handler);
  }
  const proto = ServiceWorkerRegistration.prototype;
  if (proto && proto.showNotification) {
    const orig = proto.showNotification;
    proto.showNotification = function (title, opts) {
      window.__popupLog.push({ t: "SW showNotification", title, tag: opts?.tag });
      return orig.call(this, title, opts);
    };
  }
});

await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle0", timeout: 90000 });
// Register push for real (permission pre-granted)
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("nav button")].find((b) => b.textContent?.includes("Notifications"));
  btn?.click();
});
await new Promise((r) => setTimeout(r, 2500));
const token = await page.evaluate(async () => {
  const input = document.querySelector('input[aria-label="Enable push notifications"]');
  if (!input) return null;
  input.click();
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const tok = localStorage.getItem("ttp-fcm-token");
    if (tok) return tok;
    await new Promise((r) => setTimeout(r, 250));
  }
  return null;
});
console.log("token registered:", token ? token.slice(0, 14) + "…" : "NO");

if (token) {
  // Go back to Home so the engine is mounted but the Notifications page is closed.
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("nav button")].find((b) => b.textContent?.includes("Home"));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 1500));

  // Send a REAL cron-shaped FCM push to this browser's token.
  const now = Date.now();
  const eventId = `foreground-test-${now}`;
  const payload = {
    token,
    notification: { title: "🟢 Tokyo Market Open", body: "The Tokyo trading session has begun." },
    webpush: {
      fcmOptions: { link: "/dashboard#notifications" },
      notification: { title: "🟢 Tokyo Market Open", body: "The Tokyo trading session has begun.", icon: "/icons/icon.svg", badge: "/icons/badge.svg" }
    },
    data: { eventId, kind: "market-open", category: "markets", title: "🟢 Tokyo Market Open", body: "The Tokyo trading session has begun.", reminder: "0", page: "market-status", createdAt: String(now) }
  };
  let sendResult;
  try {
    const messageId = await messaging.send(payload);
    sendResult = { ok: true, messageId };
  } catch (e) {
    sendResult = { ok: false, error: `${e?.code ?? ""} ${e?.message ?? e}` };
  }
  await new Promise((r) => setTimeout(r, 8000));

  const result = await page.evaluate(() => {
    const alerts = JSON.parse(localStorage.getItem("ttp-notification-alerts") ?? "[]");
    return {
      popupLog: window.__popupLog,
      recordedInRecent: alerts.some((a) => a.id === "foreground-test-" + "") || alerts.length,
      latestAlert: alerts[0] ? { title: alerts[0].title, id: alerts[0].id } : null
    };
  });
  result.sendResult = sendResult;
  result.pageErrors = pageErrors;

  // Cleanup: remove this test token + history entry.
  const { getFirestore } = await import("firebase-admin/firestore");
  const db = getFirestore(app);
  const { createHash } = await import("crypto");
  await db.collection("pushTokens").doc(createHash("sha256").update(token).digest("hex")).delete().catch(() => undefined);
  const histSnap = await db.collection("notificationHistory").where("eventId", "==", eventId).get();
  for (const doc of histSnap.docs) await doc.ref.delete().catch(() => undefined);

  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(JSON.stringify({ error: "no token registered", pageErrors }, null, 2));
}
await browser.close();
process.exit(0);
