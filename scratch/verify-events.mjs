// Verifies the trading schedule produces every required notification type.
import { getTradingEvents } from "../lib/tradingSchedule.ts";

const now = new Date();
const events = getTradingEvents(now);
const required = [
  { label: "Sydney Market Open", match: (e) => e.id.startsWith("market-open-Sydney-") },
  { label: "Sydney Market Close", match: (e) => e.id.startsWith("market-close-Sydney-") },
  { label: "Tokyo Market Open", match: (e) => e.id.startsWith("market-open-Tokyo-") },
  { label: "Tokyo Market Close", match: (e) => e.id.startsWith("market-close-Tokyo-") },
  { label: "London Market Open", match: (e) => e.id.startsWith("market-open-London-") },
  { label: "London Market Close", match: (e) => e.id.startsWith("market-close-London-") },
  { label: "New York Market Open", match: (e) => e.id.startsWith("market-open-New York-") },
  { label: "New York Market Close", match: (e) => e.id.startsWith("market-close-New York-") },
  { label: "ICT Asian Kill Zone Start", match: (e) => e.id.startsWith("kill-zone-start-Asian-") },
  { label: "ICT Asian Kill Zone End", match: (e) => e.id.startsWith("kill-zone-end-Asian-") },
  { label: "ICT London Kill Zone Start", match: (e) => e.id.startsWith("kill-zone-start-London-") },
  { label: "ICT London Kill Zone End", match: (e) => e.id.startsWith("kill-zone-end-London-") },
  { label: "ICT New York Kill Zone Start", match: (e) => e.id.startsWith("kill-zone-start-New York-") },
  { label: "ICT New York Kill Zone End", match: (e) => e.id.startsWith("kill-zone-end-New York-") },
  { label: "Session Overlap Start", match: (e) => e.kind === "overlap-start" },
  { label: "Weekly Candle Open", match: (e) => e.kind === "weekly-open" }
];
console.log("NOW:", now.toISOString(), now.toString());
console.log("Total events in window:", events.length);
let pass = true;
for (const { label, match } of required) {
  const found = events.filter(match);
  if (found.length === 0) {
    console.log(`MISSING: ${label}`);
    pass = false;
  } else {
    const sample = found[0];
    console.log(`OK: ${label} -> ${sample.id} at ${sample.at.toISOString()} "${sample.title}"`);
  }
}
const kinds = new Set(events.map((e) => e.kind));
console.log("\nKinds generated:", [...kinds].sort().join(", "));
console.log("overlap-end present?", events.some((e) => e.kind === "overlap-end") ? "YES" : "NO (not generated — overlaps only emit start events)");
console.log("\nRESULT:", pass ? "ALL REQUIRED TYPES PRESENT" : "MISSING TYPES");
process.exit(pass ? 0 : 1);
