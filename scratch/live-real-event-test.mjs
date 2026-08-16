// LIVE test: tonight's REAL events (Sydney Open + NY Close + Weekly Candle at 21:00 UTC =
// 02:00 PKT Aug 17) with the real r=5 (20:55), r=1 (20:59), r=0 (21:00) reminders.
// Opens the dashboard in a real Chrome, permission granted, push prefs on, and records
// exactly which popup code paths run for real events.
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
      window.__popupLog.push({ t: "SW showNotification", title: String(title).slice(0, 80), tag: opts?.tag });
      return orig.call(this, title, opts);
    };
  }
  // Timestamp engine localStorage writes so we can correlate with trigger times.
  const origSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (k === "ttp-notification-fired" || k === "ttp-notification-alerts") {
      window.__popupLog.push({ t: "storage write", key: k, at: new Date().toISOString() });
    }
    return origSet.call(this, k, v);
  };
});

await page.evaluateOnNewDocument(() => {
  localStorage.setItem("ttp-notification-preferences", JSON.stringify({
    markets: true, killZones: true, overlaps: true, weekly: true, news: false,
    sound: false, desktop: true, push: true, reminders: [10, 5, 1, 0]
  }));
});

console.log("MOUNTING dashboard at", new Date().toISOString());
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
// Engine runs at mount + every 30s. Watch through the r=5, r=1 and r=0 triggers (20:55-21:05).
await new Promise((r) => setTimeout(r, 150_000));

const result = await page.evaluate(() => {
  const alerts = JSON.parse(localStorage.getItem("ttp-notification-alerts") ?? "[]");
  const fired = JSON.parse(localStorage.getItem("ttp-notification-fired") ?? "[]");
  const real = alerts.filter((a) =>
    String(a.id).includes("market-open-Sydney-") ||
    String(a.id).includes("market-close-New York-") ||
    String(a.id).includes("weekly-open-"));
  return {
    now: new Date().toISOString(),
    permission: Notification.permission,
    realAlerts: real.map((a) => ({ title: a.title, id: a.id, reminder: a.reminder })),
    realAlertCount: real.length,
    firedReal: fired.filter((k) => /Sydney|New York|weekly-open/.test(k)),
    popupLog: (window.__popupLog || []).slice(-40)
  };
});
console.log(JSON.stringify(result, null, 2));
console.log("PAGE ERRORS:", JSON.stringify(pageErrors));

// Verify Recent Notifications via the history API (server side) for the three types.
const histRes = await fetch(`${BASE}/api/notifications/history`, { cache: "no-store" });
const hist = await histRes.json();
const realHist = (hist.items || []).filter((i) =>
  String(i.eventId).includes("market-open-Sydney-") ||
  String(i.eventId).includes("market-close-New York-") ||
  String(i.eventId).includes("weekly-open-"));
console.log("HISTORY API real entries:", JSON.stringify(realHist.map((i) => ({ id: i.id, eventId: i.eventId, sentSuccessfully: i.sentSuccessfully })), null, 2));

await browser.close();
process.exit(0);
