// Definitive: REAL events (21:00 UTC Aug 16: Sydney Open / NY Close / Weekly Candle)
// delivered by the REAL cron route over FCM to a FOREGROUND browser.
//  - The browser registers a real FCM token and stays foreground.
//  - The cron route is invoked (no ?test=1) after 21:01:30 UTC.
//  - The r=10/r=5 reminders are past the engine's 5-min window, so any popup for
//    them can ONLY come from the foreground FCM handler (savePushAlert -> showDesktopAlert).
//  - r=1/r=0 were already fired by the engine -> the push must NOT produce a second popup.
import puppeteer from "puppeteer-core";
import fs from "fs";

const BASE = "http://localhost:3002";
const secret = (() => {
  const env = fs.readFileSync(".env", "utf8");
  const m = env.match(/^CRON_SECRET=(.*)$/m);
  return m ? m[1].trim() : null;
})();
if (!secret) { console.error("no CRON_SECRET"); process.exit(1); }

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
    window.Notification = new Proxy(RealN, {
      construct(t, args) { window.__popupLog.push({ t: "construct Notification", title: String(args?.[0] ?? "").slice(0, 80) }); return new t(...args); },
      get(t, prop) { return t[prop]; }
    });
  }
  const proto = ServiceWorkerRegistration.prototype;
  if (proto && proto.showNotification) {
    const orig = proto.showNotification;
    proto.showNotification = function (title, opts) {
      window.__popupLog.push({ t: "SW showNotification", title: String(title).slice(0, 80), tag: opts?.tag, at: new Date().toISOString() });
      return orig.call(this, title, opts);
    };
  }
});

await page.evaluateOnNewDocument(() => {
  localStorage.setItem("ttp-notification-preferences", JSON.stringify({
    markets: true, killZones: true, overlaps: true, weekly: true, news: false,
    sound: false, desktop: true, push: true, reminders: [10, 5, 1, 0]
  }));
});

console.log("MOUNT at", new Date().toISOString());
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
await new Promise((r) => setTimeout(r, 4000));

// Enable push in the browser (registers a real FCM token).
const pushResult = await page.evaluate(async () => {
  try {
    const { enablePush } = await import("/_next/static/chunks/pushClient.js").catch(() => null);
    // Simpler: drive the UI toggle. Find the "Enable push notifications" checkbox.
    const input = [...document.querySelectorAll('input[aria-label="Enable push notifications"]')][0];
    if (!input) return { ok: false, reason: "checkbox not found" };
    input.click();
    return { ok: true };
  } catch (e) { return { ok: false, reason: String(e) }; }
});
await new Promise((r) => setTimeout(r, 9000));
const tokenState = await page.evaluate(() => ({
  hasToken: Boolean(localStorage.getItem("ttp-fcm-token")),
  tokenPrefix: (localStorage.getItem("ttp-fcm-token") || "").slice(0, 12),
  permission: Notification.permission,
  pushMsg: document.body.innerText.includes("Background push notifications are enabled.") || document.body.innerText.includes("Finishing FCM") ? "toggle-ok" : "toggle-?"
}));
console.log("PUSH:", JSON.stringify(pushResult), JSON.stringify(tokenState));

// Wait until the r=0 trigger has fired and the engine has consumed it (so the FCM
// push for r=1/r=0 demonstrates dedup, and r=10/r=5 demonstrate the foreground popup).
const nowMs = Date.now();
const target = new Date("2026-08-16T21:01:35.000Z").getTime();
const waitMs = Math.max(0, target - nowMs);
console.log(`waiting ${Math.round(waitMs / 1000)}s until cron trigger at 21:01:35 UTC (now ${new Date().toISOString()})`);
await new Promise((r) => setTimeout(r, waitMs + 1000));

// Invoke the REAL cron route (no ?test=1) - matches tonight's real events.
const cronRes = await fetch(`${BASE}/api/cron/notifications`, { headers: { authorization: `Bearer ${secret}` } });
const cronJson = await cronRes.json();
console.log("CRON RESULT:", JSON.stringify({ status: cronRes.status, ...cronJson }, null, 2));

// Wait for FCM delivery to the foreground page.
await new Promise((r) => setTimeout(r, 50_000));

const result = await page.evaluate(() => {
  const alerts = JSON.parse(localStorage.getItem("ttp-notification-alerts") ?? "[]");
  const fired = JSON.parse(localStorage.getItem("ttp-notification-fired") ?? "[]");
  return {
    now: new Date().toISOString(),
    permission: Notification.permission,
    realAlerts: alerts.filter((a) => /market-open-Sydney-|market-close-New York-|weekly-open-/.test(String(a.id)))
      .map((a) => ({ title: a.title, id: a.id, reminder: a.reminder })),
    firedReal: fired.filter((k) => /Sydney|New York|weekly-open/.test(k)),
    popupLog: (window.__popupLog || [])
  };
});
console.log("BROWSER RESULT:", JSON.stringify(result, null, 2));
console.log("PAGE ERRORS:", JSON.stringify(pageErrors));
await browser.close();
process.exit(0);
