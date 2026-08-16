// Rasterizes /icons/icon.svg into 192x192 and 512x512 PNGs using headless Chrome,
// so the PWA manifest satisfies Chrome's installability criteria (>=144px raster icon).
import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath = path.join(__dirname, "..", "public", "icons", "icon.svg");
const svg = fs.readFileSync(svgPath, "utf8");

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox"]
});
const page = await browser.newPage();
for (const size of [192, 512]) {
  const html = `<!doctype html><html><body style="margin:0">
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">${svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</svg>
  </body></html>`;
  await page.setContent(html, { waitUntil: "load" });
  const png = await page.evaluate(async (s) => {
    const svgEl = document.querySelector("svg");
    const xml = new XMLSerializer().serializeToString(svgEl);
    const svg64 = btoa(unescape(encodeURIComponent(xml)));
    const img = new Image();
    img.src = `data:image/svg+xml;base64,${svg64}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = s; canvas.height = s;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, s, s);
    return canvas.toDataURL("image/png").split(",")[1];
  }, size);
  const out = path.join(__dirname, "..", "public", "icons", `icon-${size}.png`);
  fs.writeFileSync(out, Buffer.from(png, "base64"));
  console.log(`wrote ${out} (${fs.statSync(out).size} bytes)`);
}
await browser.close();
process.exit(0);
