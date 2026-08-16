// CONTROLLED REAL-EVENT TEST (user protocol):
// - The NEXT REAL trading event group (Aug 17 21:00 UTC: Sydney Open / NY Close /
//   Weekly Candle) is made due ~10-20s after page load by shifting the page clock to
//   Aug 17 20:59:50 UTC. The SCHEDULE and the NotificationRuntime code are untouched —
//   only the page's Date is advanced, so the engine's normal 30s scan detects the
//   events exactly as it would at real time.
// - Dashboard Home is opened. The Notifications page is NEVER opened.
// - No CLI/manual notification command is run.
// - Expect: r=1 popups at mount (~20:59:50), r=0 popups on the next tick (~21:00:20).
//   All three categories (market-open, market-close, weekly-open) pop up automatically.
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

const now = new Date();
const target = new Date("2026-08-23T20:59:50.000Z");
const offsetMs = target.getTime() - now.getTime();
console.log(`real now: ${now.toISOString()} | shifted target: ${target.toISOString()} | offset: ${Math.round(offsetMs / 1000)}s`);

await page.evaluateOnNewDocument((offset) => {
  const RealDate = Date;
  const shifted = () => RealDate.now() + offset;
  class ShiftedDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(shifted()); else super(...args); }
    static now() { return shifted(); }
  }
  window.Date = ShiftedDate;

  window.__popupLog = [];
  const RealN = window.Notification;
  if (typeof RealN === "function") {
    window.Notification = new Proxy(RealN, {
      construct(t, args) { window.__popupLog.push({ t: "construct Notification", title: String(args?.[0] ?? "").slice(0, 80), at: new Date().toISOString() }); return new t(...args); },
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
}, offsetMs);

await page.evaluateOnNewDocument(() => {
  localStorage.setItem("ttp-notification-preferences", JSON.stringify({
    markets: true, killZones: true, overlaps: true, weekly: true, news: true,
    sound: false, desktop: true, push: true, reminders: [10, 5, 1, 0]
  }));
});

console.log("MOUNT at", new Date().toISOString());
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
// Mount run() at ~20:59:50 shifted (r=1 due), then the 30s tick at ~21:00:20 (r=0 due).
await new Promise((r) => setTimeout(r, 80_000));

const result = await page.evaluate(() => {
  const alerts = JSON.parse(localStorage.getItem("ttp-notification-alerts") ?? "[]");
  const fired = JSON.parse(localStorage.getItem("ttp-notification-fired") ?? "[]");
  const real = alerts.filter((a) => /market-open-Sydney-|market-close-New York-|weekly-open-/.test(String(a.id)));
  return {
    now: new Date().toISOString(),
    permission: Notification.permission,
    realAlerts: real.map((a) => ({ title: a.title, id: a.id, reminder: a.reminder })),
    realAlertCount: real.length,
    firedReal: fired.filter((k) => /Sydney|New York|weekly-open/.test(k)),
    popupLog: window.__popupLog || [],
    duplicateTags: (() => {
      const tags = (window.__popupLog || []).filter((e) => e.tag).map((e) => e.tag);
      return tags.filter((t, i) => tags.indexOf(t) !== i);
    })()
  };
});
console.log("BROWSER RESULT:", JSON.stringify(result, null, 2));

const histRes = await fetch(`${BASE}/api/notifications/history`, { cache: "no-store" });
const hist = await histRes.json();
const realHist = (hist.items || []).filter((i) => /market-open-Sydney-|market-close-New York-|weekly-open-/.test(String(i.eventId)));
console.log("HISTORY API:", JSON.stringify(realHist.map((i) => ({ id: i.id, eventType: i.eventType, reminder: i.reminder, ok: i.sentSuccessfully })), null, 2));
console.log("PAGE ERRORS:", JSON.stringify(pageErrors));
await browser.close();
process.exit(0);
