// Real-browser end-to-end test of the notification pipeline.
// 1. Opens /dashboard (Home view — NOT the notifications page).
// 2. Verifies NotificationRuntime mounted + service worker registered.
// 3. Enables push from the Notifications page (real FCM token).
// 4. Sends a real FCM message to that token from the server (cron-shaped payload).
// 5. Watches the page receive it (foreground onMessage) and record it in Recent Notifications.
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3002";

// Load .env so the admin SDK can send FCM
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
  args: ["--no-sandbox", "--enable-features=PushMessaging,Notifications"]
});
await browser.defaultBrowserContext().overridePermissions(BASE, ["notifications"]);
const page = await browser.newPage();
const pageErrors = [];
const consoleErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200)); });

const report = {};

// --- Step 1: open dashboard, stay on Home (Notifications page NOT mounted) ---
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle0", timeout: 90000 });
await new Promise((r) => setTimeout(r, 2500));

report.home = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return {
    title: document.title,
    activeView: (document.querySelector("nav button")?.textContent ?? ""),
    serviceWorkerRegistered: Boolean(reg),
    swScope: reg?.scope ?? null,
    swUrl: reg?.active?.scriptURL ?? null,
    hasNotificationRuntime: document.body.innerText.includes("Next market event") || document.body.innerText.includes("Your Trading Command Center"),
    notificationApi: "Notification" in window,
    permission: "Notification" in window ? Notification.permission : "n/a"
  };
});

// --- Step 2: navigate to Notifications page (click nav button), enable push for real ---
await page.evaluate(() => {
  const btn = [...document.querySelectorAll("nav button")].find((b) => b.textContent?.includes("Notifications"));
  btn?.click();
});
await new Promise((r) => setTimeout(r, 2500));
report.notificationsPage = await page.evaluate(() => ({
  mounted: Boolean(document.querySelector('input[aria-label="Enable push notifications"]')),
  permission: Notification.permission,
  view: document.body.innerText.includes("Enable Push Notifications") ? "notifications" : "other"
}));

// Click the push toggle (permission is pre-granted via overridePermissions → "default"→granted on request)
const pushed = await page.evaluate(async () => {
  const input = document.querySelector('input[aria-label="Enable push notifications"]');
  if (!input) return { ok: false, reason: "no toggle" };
  input.click();
  // wait for the enablePush flow to finish
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const token = localStorage.getItem("ttp-fcm-token");
    const prefs = localStorage.getItem("ttp-notification-preferences");
    if (token && prefs && JSON.parse(prefs).push === true) return { ok: true, token, prefs };
    await new Promise((r) => setTimeout(r, 250));
  }
  return { ok: false, reason: "timeout", token: localStorage.getItem("ttp-fcm-token"), prefs: localStorage.getItem("ttp-notification-preferences") };
});
report.enablePush = pushed;

// --- Step 3: send a real FCM push to THIS browser's token ---
let fcmResult = { sent: false };
if (pushed.ok) {
  const token = pushed.token;
  const now = Date.now();
  const payload = {
    token,
    notification: { title: "🧪 E2E FCM Test", body: "Real push delivered to open dashboard tab." },
    webpush: {
      fcmOptions: { link: "/dashboard#notifications" },
      notification: { title: "🧪 E2E FCM Test", body: "Real push delivered to open dashboard tab.", icon: "/icons/icon.svg", badge: "/icons/badge.svg" }
    },
    data: { eventId: `e2e-browser-${now}`, kind: "economic-news", category: "news", title: "🧪 E2E FCM Test", body: "Real push delivered to open dashboard tab.", reminder: "0", page: "notifications", createdAt: String(now) }
  };
  try {
    const messageId = await messaging.send(payload);
    fcmResult = { sent: true, messageId };
  } catch (err) {
    fcmResult = { sent: false, error: `${err?.code ?? ""} ${err?.message ?? err}` };
  }

  // --- Step 4: wait for foreground onMessage to record the alert ---
  await new Promise((r) => setTimeout(r, 6000));
  report.afterPush = await page.evaluate(() => {
    const alerts = JSON.parse(localStorage.getItem("ttp-notification-alerts") ?? "[]");
    const fired = JSON.parse(localStorage.getItem("ttp-notification-fired") ?? "[]");
    const body = document.body.innerText;
    return {
      alertsCount: alerts.length,
      latestTitle: alerts[0]?.title ?? null,
      latestDescription: alerts[0]?.description ?? null,
      hasFiredKey: fired.some((k) => String(k).includes("e2e-browser")),
      recentNotificationsShowsIt: body.includes("E2E FCM Test")
    };
  });

  // --- Step 5: reload and confirm Recent Notifications persists ---
  await page.reload({ waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("nav button")].find((b) => b.textContent?.includes("Notifications"));
    btn?.click();
  });
  await new Promise((r) => setTimeout(r, 3000));
  report.afterReload = await page.evaluate(() => {
    const body = document.body.innerText;
    const alerts = JSON.parse(localStorage.getItem("ttp-notification-alerts") ?? "[]");
    return {
      stillShowsInRecent: body.includes("E2E FCM Test"),
      alertsCount: alerts.length,
      pushToggleStillChecked: document.querySelector('input[aria-label="Enable push notifications"]')?.checked ?? null,
      tokenStillStored: Boolean(localStorage.getItem("ttp-fcm-token")),
      prefsPush: JSON.parse(localStorage.getItem("ttp-notification-preferences") ?? "{}").push ?? null
    };
  });
}

// --- Step 6: verify history API persisted the push ---
const histRes = await fetch(`${BASE}/api/notifications/history`);
const hist = await histRes.json();
report.historyApi = {
  count: hist.items?.length ?? 0,
  hasE2E: (hist.items ?? []).some((i) => String(i.eventId).includes("e2e-browser"))
};

report.pageErrors = pageErrors;
report.consoleErrors = consoleErrors.slice(0, 10);
console.log(JSON.stringify(report, null, 2));

// Cleanup: remove this test token + history entry so real users aren't spammed.
if (pushed.ok) {
  await fetch(`${BASE}/api/push/tokens`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: pushed.token }) }).catch(() => undefined);
  if (hist.items) {
    for (const item of hist.items) {
      if (String(item.eventId).includes("e2e-browser")) {
        const { getFirestore } = await import("firebase-admin/firestore");
        const db = getFirestore(app);
        await db.collection("notificationHistory").doc(item.id).delete().catch(() => undefined);
      }
    }
  }
}
await browser.close();
process.exit(0);
