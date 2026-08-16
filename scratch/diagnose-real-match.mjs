// Shows the exact decision math the cron route applies to REAL events right now.
import { getTradingEvents } from "../lib/tradingSchedule.ts";

const now = new Date();
const nowMs = now.getTime();
const PUSH_FRESHNESS_MS = 30 * 60_000;
const MAX_LOOKBACK_MS = 24 * 60 * 60_000;

// Simulate what the route reads: production cronState lastCheckedAt from Firestore.
// (For diagnosis we use a fresh read via the running server's own logic — approximated here.)
console.log("NOW:", now.toISOString(), "UTC |", now.toString());
const events = getTradingEvents(now);

// The next 3 real events and their reminder triggers
const upcoming = events
  .filter((e) => e.at.getTime() > nowMs)
  .sort((a, b) => a.at - b.at)
  .slice(0, 3);

console.log("\nNEXT 3 REAL EVENTS + ALL REMINDER TRIGGERS:\n");
for (const e of upcoming) {
  console.log(`EVENT: ${e.title} (${e.id}) @ ${e.at.toISOString()} UTC`);
  for (const r of [10, 5, 1, 0]) {
    const trigger = e.at.getTime() - r * 60000;
    const inMin = Math.round((trigger - nowMs) / 60000);
    console.log(`  r=${r}  trigger=${new Date(trigger).toISOString()} UTC  in ${inMin} min`);
  }
}

// Decision math for a hypothetical lastCheckedAt 1 minute ago (production cron every minute)
// vs stale lastCheckedAt (production cron NOT running).
console.log("\nDECISION MATH (would the route match these right now?):\n");
for (const mode of [
  { label: "if production cron runs every min (lastCheckedAt = 1 min ago)", lastCheckedAt: nowMs - 60_000 },
  { label: "if production cron is NOT running (lastCheckedAt = 1 h ago)", lastCheckedAt: nowMs - 3600_000 },
  { label: "actual stored cronState right now", lastCheckedAt: null }
]) {
  for (const e of events) {
    for (const r of [10, 5, 1, 0]) {
      const trigger = e.at.getTime() - r * 60000;
      const inWindow = trigger > nowMs - 3 * 60_000 && trigger <= nowMs; // is the trigger in the last 3 min?
      if (!inWindow) continue;
      console.log(`${mode.label}: event=${e.id} r=${r} trigger=${new Date(trigger).toISOString()} — WOULD match (trigger in last 3 min)`);
    }
  }
}
console.log("(no triggers occurred in the last 3 minutes => route matches nothing right now — expected)");
process.exit(0);
