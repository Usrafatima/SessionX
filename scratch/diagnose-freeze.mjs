import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox"]
});
await browser.defaultBrowserContext().overridePermissions("http://localhost:3000", ["notifications"]);
const page = await browser.newPage();
const errors = [];
const logs = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => logs.push({ type: m.type(), text: m.text().slice(0, 400) }));

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

await page.goto("http://localhost:3000/dashboard#notifications", { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));

const snap = await page.evaluate(() => ({
  href: location.href,
  text: (document.body?.innerText || "").slice(0, 800),
  inputCount: document.querySelectorAll("input").length,
  pushInput: !!document.querySelector('input[aria-label="Enable push notifications"]'),
  navSelected: [...document.querySelectorAll("nav button")].find((b) => b.className.includes("teal"))?.textContent ?? null,
  storage: {
    tab: localStorage.getItem("ttp-active-tab"),
    prefs: localStorage.getItem("ttp-notification-preferences"),
    token: localStorage.getItem("ttp-fcm-token")
  }
}));

console.log(JSON.stringify({ snap, errors, errorLogs: logs.filter((l) => l.type === "error").slice(0, 30) }, null, 2));
await browser.close();
