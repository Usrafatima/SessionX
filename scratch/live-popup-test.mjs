// LIVE reproduction of the user's symptom: real events (r=10 for Sydney Open / NY Close /
// Weekly Candle at 20:50 UTC) recorded in Recent Notifications but NO popup.
// Opens the dashboard NOW (within the engine's 5-min fire window), instruments
// Notification + showNotification to see exactly which popup code path runs.
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

// Instrument the popup paths BEFORE app scripts run.
await page.evaluateOnNewDocument(() => {
  window.__popupLog = [];
  const RealNotification = window.Notification;
  if (typeof RealNotification === "function") {
    window.Notification = new Proxy(RealNotification, {
      construct(target, args) {
        window.__popupLog.push({ type: "new Notification", title: args[0], opts: args[1] });
        const n = new target(...args);
        return n;
      },
      apply(target, thisArg, args) {
        window.__popupLog.push({ type: "Notification() call", args });
        return target.apply(thisArg, args);
      }
    });
    // static properties
    for (const k of ["permission", "requestPermission", "maxActions"]) {
      try { window.Notification[k] = RealNotification[k]; } catch {}
    }
    // instance show
    if (RealNotification.prototype && !RealNotification.prototype.show) {
      try {
        Object.defineProperty(RealNotification.prototype, "show", {
          value() { window.__popupLog.push({ type: "notification.show()" }); return RealNotification.prototype.show ? RealNotification.prototype.show.call(this) : undefined; }
        });
      } catch {}
    }
  }
  if (navigator.serviceWorker) {
    const proto = ServiceWorkerRegistration.prototype;
    const orig = proto.showNotification;
    proto.showNotification = function (title, opts) {
      window.__popupLog.push({ type: "SW showNotification", title, opts });
      return orig.call(this, title, opts);
    };
  }
});

// Prefs: push ON (as the user would have from the toggle), desktop ON, all categories on.
await page.evaluateOnNewDocument(() => {
  localStorage.setItem("ttp-notification-preferences", JSON.stringify({
    markets: true, killZones: true, overlaps: true, weekly: true, news: false,
    sound: false, desktop: true, push: true, reminders: [10, 5, 1, 0]
  }));
});

console.log("opening dashboard at", new Date().toISOString());
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle0", timeout: 90000 });
// Wait for the engine's mount run() + one interval tick (30s) so we catch the window.
await new Promise((r) => setTimeout(r, 45_000));

const result = await page.evaluate(() => {
  const alerts = JSON.parse(localStorage.getItem("ttp-notification-alerts") ?? "[]");
  const fired = JSON.parse(localStorage.getItem("ttp-notification-fired") ?? "[]");
  const popupLog = window.__popupLog || [];
  const real = alerts.filter((a) =>
    String(a.id).includes("market-open-Sydney-") ||
    String(a.id).includes("market-close-New York-") ||
    String(a.id).includes("weekly-open-"));
  return {
    now: new Date().toISOString(),
    permission: Notification.permission,
    prefs: localStorage.getItem("ttp-notification-preferences"),
    realAlertsFired: real.map((a) => ({ title: a.title, id: a.id, reminder: a.reminder })),
    realAlertCount: real.length,
    totalAlerts: alerts.length,
    firedKeys: fired.filter((k) => String(k).includes("Sydney") || String(k).includes("New York") || String(k).includes("weekly-open")),
    popupLog
  };
});
console.log(JSON.stringify(result, null, 2));
console.log("PAGE ERRORS:", JSON.stringify(pageErrors));
await browser.close();
process.exit(0);
