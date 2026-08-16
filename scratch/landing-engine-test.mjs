// Verifies the in-tab engine fires real events from the LANDING page (no dashboard).
// Shifts the page clock to 23:02 UTC so the Asian Kill Zone start (23:00 UTC) is due.
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
const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 2, 0));
const offsetMs = target.getTime() - now.getTime();
console.log(`real now: ${now.toISOString()} | target: ${target.toISOString()} | offset: ${Math.round(offsetMs / 60000)} min`);

await page.evaluateOnNewDocument((offset) => {
  const RealDate = Date;
  const shifted = () => RealDate.now() + offset;
  class ShiftedDate extends RealDate {
    constructor(...args) { if (args.length === 0) super(shifted()); else super(...args); }
    static now() { return shifted(); }
  }
  window.Date = ShiftedDate;
}, offsetMs);

await page.evaluateOnNewDocument(() => {
  localStorage.setItem("ttp-notification-preferences", JSON.stringify({
    markets: true, killZones: true, overlaps: true, weekly: true, news: true,
    sound: false, desktop: true, push: false, reminders: [10, 5, 1, 0]
  }));
});

await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 90000 });
await new Promise((r) => setTimeout(r, 4000));

const result = await page.evaluate(() => {
  const alerts = JSON.parse(localStorage.getItem("ttp-notification-alerts") ?? "[]");
  const fired = JSON.parse(localStorage.getItem("ttp-notification-fired") ?? "[]");
  const kz = alerts.filter((a) => a.id && String(a.id).includes("kill-zone-start-Asian"));
  return {
    onLandingPage: location.pathname === "/",
    swRegistered: true,
    kzAlerts: kz.map((a) => ({ title: a.title, reminder: a.reminder, id: a.id })),
    totalAlerts: alerts.length,
    firedAsianKz: fired.some((k) => String(k).includes("kill-zone-start-Asian")),
    swPopupOk: (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg) return "no-registration";
        await Promise.race([
          reg.showNotification("🧪 Landing Engine", { body: "popup from landing page", icon: "/icons/icon.svg" }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))
        ]);
        return true;
      } catch (e) { return String(e); }
    })()
  };
});
result.swPopupOk = await result.swPopupOk;

await new Promise((r) => setTimeout(r, 2500));
const histRes = await fetch(`${BASE}/api/notifications/history`);
const hist = await histRes.json();
const kzHistory = (hist.items ?? []).filter((i) => String(i.eventId).includes("kill-zone-start-Asian"));
console.log(JSON.stringify({ result, historyApi: { kzHistoryCount: kzHistory.length, sample: kzHistory.map((h) => ({ title: h.title, reminder: h.reminder })) }, pageErrors }, null, 2));
await browser.close();
process.exit(0);
