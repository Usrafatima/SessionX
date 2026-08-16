// Tests the client-side in-tab notification engine (NOT the FCM path).
// The dashboard's NotificationRuntime scans getTradingEvents() every 30s and fires
// alerts whose trigger is within the last 5 minutes. We advance the page's clock to
// land ~2 minutes after the next "Tokyo Market Close" trigger so the engine's mount
// run() fires it: popup (SW showNotification) + Recent Notifications + history API.
import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3002";
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox"]
});
await browser.defaultBrowserContext().overridePermissions(BASE, ["notifications"]);
const page = await browser.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));
page.on("dialog", async (d) => d.dismiss());

// Compute the offset to reach the next Tokyo Market Close (00:00 UTC) + 2 minutes.
const now = new Date();
const tokyoClose = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + (now.getUTCHours() >= 0 ? 1 : 0), 0, 0, 0));
// If we are already past 00:00 UTC today, Tokyo close is tomorrow 00:00 UTC.
let target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 2, 0));
const offsetMs = target.getTime() - now.getTime();
console.log(`real now: ${now.toISOString()} | target: ${target.toISOString()} | offset: ${Math.round(offsetMs / 60000)} min`);

await page.evaluateOnNewDocument((offset) => {
  const RealDate = Date;
  const shifted = () => RealDate.now() + offset;
  class ShiftedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) super(shifted());
      else super(...args);
    }
    static now() { return shifted(); }
  }
  window.Date = ShiftedDate;
}, offsetMs);

// Fresh profile: no fired keys, no prior alerts; enable all categories + desktop.
await page.evaluateOnNewDocument(() => {
  localStorage.setItem("ttp-notification-preferences", JSON.stringify({
    markets: true, killZones: true, overlaps: true, weekly: true, news: true,
    sound: false, desktop: true, push: false, reminders: [10, 5, 1, 0]
  }));
});

await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle0", timeout: 90000 });
// Give the engine's mount run() + the 30s interval a chance (first run is immediate).
await new Promise((r) => setTimeout(r, 4000));

const result = await page.evaluate(async () => {
  const alerts = JSON.parse(localStorage.getItem("ttp-notification-alerts") ?? "[]");
  const fired = JSON.parse(localStorage.getItem("ttp-notification-fired") ?? "[]");
  const tokyoCloseAlerts = alerts.filter((a) => a.title && a.title.includes("Tokyo"));
  let swNotificationOk = null;
  try {
    // The exact path showDesktopAlert() uses (SW showNotification with 3s timeout fallback).
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      await Promise.race([
        reg.showNotification("🧪 SW Popup Path", { body: "Service-worker popup works", icon: "/icons/icon.svg" }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))
      ]);
      swNotificationOk = true;
    }
  } catch (e) { swNotificationOk = String(e); }
  const plainNotificationOk = (() => {
    try { const n = new Notification("🧪 Plain Popup Path", { body: "Plain popup works" }); n.close(); return true; }
    catch (e) { return String(e); }
  })();
  return {
    engineProducedTokyo: tokyoCloseAlerts.length,
    tokyoAlerts: tokyoCloseAlerts.map((a) => ({ title: a.title, reminder: a.reminder, id: a.id, createdAt: a.createdAt })),
    allAlerts: alerts.map((a) => ({ title: a.title, id: a.id, reminder: a.reminder })),
    totalAlerts: alerts.length,
    firedKeys: fired.filter((k) => String(k).includes("Tokyo")),
    swNotificationOk,
    plainNotificationOk
  };
});

// Wait for the async history POST to land, then check the API.
await new Promise((r) => setTimeout(r, 2500));
const histRes = await fetch(`${BASE}/api/notifications/history`);
const hist = await histRes.json();
const tokyoHistory = (hist.items ?? []).filter((i) => String(i.eventId).includes("Tokyo"));
console.log(JSON.stringify({ result, historyApi: { tokyoHistoryCount: tokyoHistory.length, sample: tokyoHistory.map((h) => ({ title: h.title, eventType: h.eventType, reminder: h.reminder })) }, pageErrors }, null, 2));

await browser.close();
process.exit(0);
