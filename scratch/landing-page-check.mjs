import puppeteer from "puppeteer-core";
const BASE = "http://localhost:3002";
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox"]
});
const page = await browser.newPage();
await page.goto(`${BASE}/`, { waitUntil: "networkidle0", timeout: 90000 });
await new Promise((r) => setTimeout(r, 2500));
const result = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.getRegistration();
  return {
    path: location.pathname,
    isLandingPage: document.body.innerText.includes("Sessions") && !document.body.innerText.includes("Command Center"),
    serviceWorkerRegistered: Boolean(reg),
    swUrl: reg?.active?.scriptURL ?? null,
    hasNotificationRuntimeHooks: "Notification" in window,
    bodySample: document.body.innerText.slice(0, 120)
  };
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
process.exit(0);
