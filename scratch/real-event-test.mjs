// REAL-EVENT diagnostic: takes the next real scheduled trading event and runs the
// exact production cron route (/api/cron/notifications WITHOUT ?test=1) against it.
// Prints the full decision chain and verifies Firestore history afterwards.
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3002";

// Load CRON_SECRET from .env
const envPath = path.join(__dirname, "..", ".env");
let CRON_SECRET = "";
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^CRON_SECRET\s*=\s*"?([^\r\n"]+)"?$/);
    if (m) CRON_SECRET = m[1].trim();
  }
}

const { getTradingEvents } = await import("../lib/tradingSchedule.ts");

const now = new Date();
const nowMs = now.getTime();
const events = getTradingEvents(now);

// Next real (non-test) event with all reminder triggers
const upcoming = events
  .filter((e) => e.at.getTime() > nowMs)
  .map((e) => ({
    ...e,
    triggers: [10, 5, 1, 0].map((r) => ({ reminder: r, at: new Date(e.at.getTime() - r * 60000) }))
  }))
  .sort((a, b) => a.at - b.at);

const next = upcoming[0];
if (!next) { console.log("no upcoming event found"); process.exit(1); }

const fmt = (d, zone) =>
  new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }).format(d);

console.log("=== NEXT REAL EVENT ===");
console.log(`name:        ${next.title} (${next.id})`);
console.log(`kind:        ${next.kind} / category: ${next.category}`);
console.log(`event time:  ${next.at.toISOString()} UTC`);
console.log(`  Pakistan:  ${fmt(next.at, "Asia/Karachi")}`);
console.log(`  New York:  ${fmt(next.at, "America/New_York")}`);
console.log(`  London:    ${fmt(next.at, "Europe/London")}`);
console.log(`  Tokyo:     ${fmt(next.at, "Asia/Tokyo")}`);
console.log(`  Sydney:    ${fmt(next.at, "Australia/Sydney")}`);

console.log("\n=== CURRENT TIME ===");
console.log(`server now:  ${now.toISOString()} UTC`);
console.log(`  Pakistan:  ${fmt(now, "Asia/Karachi")}`);
console.log(`  New York:  ${fmt(now, "America/New_York")}`);
console.log(`  London:    ${fmt(now, "Europe/London")}`);
console.log(`  Tokyo:     ${fmt(now, "Asia/Tokyo")}`);
console.log(`  Sydney:    ${fmt(now, "Australia/Sydney")}`);

console.log("\n=== REMINDER TRIGGERS (what the cron matches) ===");
for (const t of next.triggers) {
  const diffMin = Math.round((t.at.getTime() - nowMs) / 60000);
  console.log(`  r=${t.reminder}: trigger ${t.at.toISOString()} UTC (${fmt(t.at, "Asia/Karachi")} PKT) — in ${diffMin} min`);
}

console.log("\n=== WAITING for the real event time (r=0 + 40s) to run the production route... ===");
while (Date.now() < next.at.getTime() + 40_000) {
  await new Promise((r) => setTimeout(r, 60_000));
}
const runNow = new Date();
console.log(`run at ${runNow.toISOString()} UTC (${fmt(runNow, "Asia/Karachi")} PKT)`);

// Run the REAL production route (no ?test=1) — exact code the Vercel Cron executes.
const res = await fetch(`${BASE}/api/cron/notifications`, {
  headers: CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {}
});
const body = await res.json();
console.log("\n=== PRODUCTION ROUTE RESULT ===");
console.log(JSON.stringify(body, null, 2));

// Verify Firestore history for this real event
const histRes = await fetch(`${BASE}/api/notifications/history`);
const hist = await histRes.json();
const mine = (hist.items ?? []).filter((i) => String(i.eventId).includes("Sydney"));
console.log("\n=== RECENT NOTIFICATIONS (Firestore) — Sydney entries ===");
console.log(mine.length ? JSON.stringify(mine.map((m) => ({ title: m.title, reminder: m.reminder, sentSuccessfully: m.sentSuccessfully, eventId: m.eventId })), null, 2) : "NONE — event was not recorded");
process.exit(0);
