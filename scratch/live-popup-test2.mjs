// Decisive: (a) instrument popup calls precisely, (b) after load, manually invoke the
// EXACT showDesktopAlert code path to prove the APIs work, (c) capture engine behavior.
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
      window.__popupLog.push({ t: "SW showNotification", title, opts: { body: opts?.body, tag: opts?.tag } });
      return orig.call(this, title, opts);
    };
  }
  // Track engine writes to localStorage to timestamp when alerts were fired.
  const origSet = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (k === "ttp-notification-fired" || k === "ttp-notification-alerts") {
      window.__popupLog.push({ t: "storage write", key: k, time: Date.now() });
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

console.log("opening at", new Date().toISOString());
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle0", timeout: 90000 });
await new Promise((r) => setTimeout(r, 20_000));

// Manual verification of the EXACT popup code paths used by showDesktopAlert:
const manual = await page.evaluate(async () => {
  const out = {};
  out.readyState = navigator.serviceWorker ? "sw-api-present" : "no-sw-api";
  try {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error("ready-timeout")), 5000))
    ]);
    out.readyResolved = true;
    out.regUrl = reg.active?.scriptURL ?? null;
    await reg.showNotification("Manual SW popup", { body: "test", tag: "manual-sw" });
    out.manualSw = "called-ok";
  } catch (e) {
    out.readyResolved = false;
    out.manualSw = String(e);
  }
  try {
    const n = new Notification("Manual plain popup", { body: "test" });
    out.manualPlain = "constructed-ok";
  } catch (e) { out.manualPlain = String(e); }
  return out;
});

const result = await page.evaluate(() => {
  const alerts = JSON.parse(localStorage.getItem("ttp-notification-alerts") ?? "[]");
  const fired = JSON.parse(localStorage.getItem("ttp-notification-fired") ?? "[]");
  return {
    now: new Date().toISOString(),
    permission: Notification.permission,
    realAlerts: alerts.filter((a) => String(a.id).includes("market-open-Sydney-") || String(a.id).includes("market-close-New York-") || String(a.id).includes("weekly-open-")).map((a) => ({ title: a.title, id: a.id, reminder: a.reminder })),
    firedReal: fired.filter((k) => String(k).includes("Sydney") || String(k).includes("New York") || String(k).includes("weekly")),
    popupLog: window.__popupLog
  };
});
console.log(JSON.stringify({ manual, result, pageErrors }, null, 2));
await browser.close();
process.exit(0);
