import { getTradingEvents } from "../lib/tradingSchedule.ts";
const now = new Date();
const nowMs = now.getTime();
const events = getTradingEvents(now);
const triggers = [];
for (const event of events) {
  for (const reminder of [10, 5, 1, 0]) {
    const trigger = event.at.getTime() - reminder * 60000;
    const min = (trigger - nowMs) / 60000;
    if (min >= -6 && min <= 15) triggers.push({ in: Math.round(min), id: event.id, kind: event.kind, reminder, title: event.title, at: new Date(event.at).toISOString() });
  }
}
triggers.sort((a, b) => a.in - b.in);
console.log("NOW:", now.toString(), "|", now.toISOString());
console.log("Triggers in ±6..15 min:", triggers.length);
for (const t of triggers) console.log(`  in ${t.in} min | r=${t.reminder} | ${t.title} | ${t.id}`);
process.exit(0);
