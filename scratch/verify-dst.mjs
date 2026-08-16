import { getTradingEvents, sessions, killZoneSchedules } from "../lib/tradingSchedule.ts";

function fmtUTC(d) { return d.toISOString(); }
function fmt(d, zone) {
  return new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "2-digit", minute: "2-digit", hourCycle: "h23", weekday: "short" }).format(d);
}

const checks = [
  { label: "London summer (Aug 15 2026) — expect open 07:00 UTC (08:00 BST)", date: new Date("2026-08-15T12:00:00Z") },
  { label: "London winter (Jan 15 2026) — expect open 08:00 UTC (08:00 GMT)", date: new Date("2026-01-15T12:00:00Z") },
  { label: "New York summer (Aug 15 2026) — expect open 12:00 UTC (08:00 EDT)", date: new Date("2026-08-15T12:00:00Z") },
  { label: "New York winter (Jan 15 2026) — expect open 13:00 UTC (08:00 EST)", date: new Date("2026-01-15T12:00:00Z") },
  { label: "Tokyo (no DST) — expect open 00:00 UTC (09:00 JST)", date: new Date("2026-08-15T12:00:00Z") },
  { label: "Sydney winter (Aug) — expect open 21:00 UTC (07:00 AEST)", date: new Date("2026-08-15T12:00:00Z") },
  { label: "Sydney summer DST (Jan) — expect open 20:00 UTC (07:00 AEDT)", date: new Date("2026-01-15T12:00:00Z") }
];

for (const c of checks) {
  const events = getTradingEvents(c.date);
  const open = events.find((e) => e.kind === "market-open");
  const zone = open ? null : null;
  console.log(`${c.label}`);
  // find the London/NY/Tokyo/Sydney open specifically
  const name = c.label.includes("London") ? "London" : c.label.includes("New York") ? "New York" : c.label.includes("Tokyo") ? "Tokyo" : "Sydney";
  const e = events.find((ev) => ev.id.startsWith(`market-open-${name}-`));
  console.log(`   => ${e ? fmtUTC(e.at) + " UTC | " + fmt(e.at, sessions.find((s) => s.name === name).timezone) + " local" : "MISSING"}`);
}

// Kill zone zones (from the schedule) — confirm they use IANA zones, not fixed offsets
console.log("\nKILL ZONE CONFIGURATION (from tradingSchedule.ts):");
for (const z of killZoneSchedules) console.log(`   ${z.name}: timezone=${z.timezone}, startHour=${z.startHour}, endHour=${z.endHour}`);

// User's concrete example: "London opens at 12:00 UTC, 5-min reminder -> trigger 11:55 UTC"
// The schedule uses 08:00 local, which in August BST = 07:00 UTC, so r=5 trigger = 06:55 UTC.
const august = new Date("2026-08-15T10:00:00Z");
const londonOpen = getTradingEvents(august).find((e) => e.id.startsWith("market-open-London-"));
console.log("\nUSER'S EXAMPLE — London Open, 5-min reminder:");
console.log(`   event at: ${fmtUTC(londonOpen.at)} UTC`);
console.log(`   r=5 trigger: ${fmtUTC(new Date(londonOpen.at.getTime() - 5 * 60000))} UTC`);
console.log(`   r=0 trigger: ${fmtUTC(new Date(londonOpen.at.getTime()))} UTC`);
process.exit(0);
