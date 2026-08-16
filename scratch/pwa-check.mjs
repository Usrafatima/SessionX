import puppeteer from "puppeteer-core";
const BASE = "http://localhost:3002";
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox"]
});
const page = await browser.newPage();
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle0", timeout: 60000 });

// PWA installability errors via CDP
const cdp = await page.createCDPSession();
await cdp.send("Page.enable");
let installability = null;
try {
  const res = await cdp.send("Page.getInstallabilityErrors");
  installability = res.installabilityErrors ?? [];
} catch (e) { installability = `CDP error: ${e.message}`; }
const manifest = await cdp.send("Page.getAppManifest");
const manifestData = manifest.data ? JSON.parse(manifest.data) : null;

const firebaseConfig = await fetch(`${BASE}/api/firebase-config`).then((r) => r.json());

console.log(JSON.stringify({
  manifest: manifestData ? { name: manifestData.name, display: manifestData.display, start_url: manifestData.start_url, icons: manifestData.icons } : manifest,
  installabilityErrors: installability,
  firebaseConfig: { ...firebaseConfig, apiKeyPresent: Boolean(firebaseConfig.apiKey), projectId: firebaseConfig.projectId }
}, null, 2));
await browser.close();
process.exit(0);
