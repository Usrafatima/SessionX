import { getTradingEvents } from "../lib/tradingSchedule";

const now = new Date();
const nowMs = now.getTime();
console.log("SERVER NOW:", now.toISOString(), "| local:", now.toString());
const events = getTradingEvents(now);
console.log("Total events:", events.length);

const upcoming = events.filter((e) => e.at.getTime() > nowMs).slice(0, 10);
console.log("Next 10 upcoming:");
for (const e of upcoming) {
  console.log(" ", e.id, "| at:", e.at.toISOString(), "| in", Math.round((e.at.getTime() - nowMs) / 60000), "min |", e.title);
}

const triggers = events
  .map((e) => [10, 5, 1, 0].map((r) => ({ id: e.id, r, trigger: e.at.getTime() - r * 60000 })))
  .flat()
  .filter((t) => t.trigger > nowMs && t.trigger <= nowMs + 60 * 60000);
console.log("Triggers due in next 60 min:", triggers.length);
for (const t of triggers.slice(0, 12)) console.log("  due at", new Date(t.trigger).toISOString(), "(", Math.round((t.trigger - nowMs) / 60000), "min )", t.id, "r=", t.r);
