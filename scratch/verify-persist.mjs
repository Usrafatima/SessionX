import puppeteer from "puppeteer-core";

const BASE = "http://localhost:3001";

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox"]
});
await browser.defaultBrowserContext().overridePermissions(BASE, ["notifications"]);
const page = await browser.newPage();
const errors = [];
const fcmCalls = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("request", (req) => {
  const url = req.url();
  if (url.includes("fcmregistrations") || url.includes("/api/push/tokens")) {
    fcmCalls.push({ method: req.method(), url: url.slice(0, 100) });
  }
});

await page.evaluateOnNewDocument(() => {
  localStorage.setItem("ttp-active-tab", "notifications");
  localStorage.setItem(
    "ttp-notification-preferences",
    JSON.stringify({
      markets: true, killZones: true, overlaps: true, weekly: true, news: false,
      sound: true, desktop: true, push: true, reminders: [10, 5, 1, 0]
    })
  );
  localStorage.setItem("ttp-fcm-token", "persisted-token-abcdefghijklmnop-reuse-me");
});

const t0 = Date.now();
await page.goto(`${BASE}/dashboard#notifications`, { waitUntil: "domcontentloaded", timeout: 60000 });

let ready = null;
for (let i = 0; i < 30; i++) {
  const snap = await page.evaluate(() => {
    const input = document.querySelector('input[aria-label="Enable push notifications"]');
    return {
      textLen: (document.body?.innerText || "").length,
      checked: input?.checked ?? null,
      status: input?.closest(".glass")?.innerText?.slice(0, 200) ?? null,
      nav: [...document.querySelectorAll("nav button")].find((b) => b.className.includes("teal"))?.textContent ?? null
    };
  });
  if (snap.checked === true) {
    ready = { ms: Date.now() - t0, ...snap };
    break;
  }
  await new Promise((r) => setTimeout(r, 100));
}

const navOk = await page.evaluate(async () => {
  const homeBtn = [...document.querySelectorAll("nav button")].find((b) => b.textContent?.includes("Home"));
  homeBtn?.click();
  await new Promise((r) => setTimeout(r, 400));
  const homeSelected = [...document.querySelectorAll("nav button")].find((b) => b.className.includes("teal"))?.textContent;
  const notifBtn = [...document.querySelectorAll("nav button")].find((b) => b.textContent?.includes("Notifications"));
  notifBtn?.click();
  await new Promise((r) => setTimeout(r, 400));
  const input = document.querySelector('input[aria-label="Enable push notifications"]');
  return { homeSelected, checkedAgain: input?.checked ?? null };
});

await page.reload({ waitUntil: "domcontentloaded" });
await new Promise((r) => setTimeout(r, 1200));
const afterReload = await page.evaluate(() => {
  const input = document.querySelector('input[aria-label="Enable push notifications"]');
  // ensure notifications view
  if (!input) {
    const notifBtn = [...document.querySelectorAll("nav button")].find((b) => b.textContent?.includes("Notifications"));
    notifBtn?.click();
  }
  return null;
});
await new Promise((r) => setTimeout(r, 800));
const persisted = await page.evaluate(() => {
  const input = document.querySelector('input[aria-label="Enable push notifications"]');
  return {
    checked: input?.checked ?? null,
    prefs: localStorage.getItem("ttp-notification-preferences"),
    token: localStorage.getItem("ttp-fcm-token")
  };
});

console.log(JSON.stringify({
  ready,
  navOk,
  persisted,
  errors,
  fcmCalls,
  skippedGetToken: !fcmCalls.some((c) => c.url.includes("fcmregistrations")),
  syncedFirestore: fcmCalls.some((c) => c.url.includes("/api/push/tokens"))
}, null, 2));

await browser.close();
