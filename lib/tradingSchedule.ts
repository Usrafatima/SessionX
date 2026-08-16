export type TradingEventKind = "market-open" | "market-close" | "kill-zone-start" | "kill-zone-end" | "overlap-start" | "weekly-open" | "economic-news";

export type TradingEvent = {
  id: string;
  kind: TradingEventKind;
  at: Date;
  title: string;
  description: string;
  emoji: string;
  category: "markets" | "killZones" | "overlaps" | "weekly" | "news";
};

type TimedSchedule = { name: string; timezone: string; startHour: number; endHour: number };

export const sessions: TimedSchedule[] = [
  { name: "Sydney", timezone: "Australia/Sydney", startHour: 7, endHour: 16 },
  { name: "Tokyo", timezone: "Asia/Tokyo", startHour: 9, endHour: 18 },
  { name: "London", timezone: "Europe/London", startHour: 8, endHour: 17 },
  { name: "New York", timezone: "America/New_York", startHour: 8, endHour: 17 }
];

export const killZoneSchedules: TimedSchedule[] = [
  { name: "London", timezone: "Europe/London", startHour: 7, endHour: 10 },
  { name: "New York", timezone: "America/New_York", startHour: 7, endHour: 10 },
  { name: "Asian", timezone: "Asia/Tokyo", startHour: 8, endHour: 10 }
];

const overlaps: TimedSchedule[] = [
  { name: "London + New York", timezone: "Europe/London", startHour: 13, endHour: 17 },
  { name: "Tokyo + London", timezone: "Europe/London", startHour: 8, endHour: 9 },
  { name: "Sydney + Tokyo", timezone: "Asia/Tokyo", startHour: 9, endHour: 16 }
];

function parts(date: Date, timezone: string) {
  const values = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: string) => Number(values.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute"), second: get("second") };
}

/** Converts a wall-clock time in an IANA zone to an instant; Intl supplies DST offsets. */
function zonedDate(year: number, month: number, day: number, decimalHour: number, timezone: string) {
  const hour = Math.floor(decimalHour);
  const minute = Math.round((decimalHour - hour) * 60);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let result = target;
  for (let i = 0; i < 2; i++) {
    const current = parts(new Date(result), timezone);
    const displayed = Date.UTC(current.year, current.month - 1, current.day, current.hour, current.minute);
    result += target - displayed;
  }
  return new Date(result);
}

function addLocalDays(date: Date, timezone: string, days: number) {
  const value = parts(date, timezone);
  const adjusted = new Date(Date.UTC(value.year, value.month - 1, value.day + days));
  return { year: adjusted.getUTCFullYear(), month: adjusted.getUTCMonth() + 1, day: adjusted.getUTCDate() };
}

function makeDailyEvents(schedule: TimedSchedule, now: Date, category: TradingEvent["category"], kind: "market" | "kill") {
  const output: TradingEvent[] = [];
  for (const day of [-1, 0, 1]) {
    const date = addLocalDays(now, schedule.timezone, day);
    const start = zonedDate(date.year, date.month, date.day, schedule.startHour, schedule.timezone);
    const endDate = schedule.endHour <= schedule.startHour ? addLocalDays(start, schedule.timezone, 1) : date;
    const end = zonedDate(endDate.year, endDate.month, endDate.day, schedule.endHour, schedule.timezone);
    const dayKey = start.toISOString().slice(0, 10);
    if (kind === "market") {
      output.push({ id: `market-open-${schedule.name}-${dayKey}`, kind: "market-open", at: start, title: `${schedule.name} Market Open`, description: `The ${schedule.name} trading session has begun. Liquidity is increasing.`, emoji: "🟢", category });
      output.push({ id: `market-close-${schedule.name}-${dayKey}`, kind: "market-close", at: end, title: `${schedule.name} Market Closed`, description: `The ${schedule.name} trading session has ended.`, emoji: "🔴", category });
    } else {
      output.push({ id: `kill-zone-start-${schedule.name}-${dayKey}`, kind: "kill-zone-start", at: start, title: `${schedule.name} Kill Zone`, description: "ACTIVE NOW — high liquidity expected.", emoji: "⚡", category });
      output.push({ id: `kill-zone-end-${schedule.name}-${dayKey}`, kind: "kill-zone-end", at: end, title: `${schedule.name} Kill Zone`, description: "Ended.", emoji: "◻️", category });
    }
  }
  return output;
}

export function getTradingEvents(now = new Date()) {
  const events = [
    ...sessions.flatMap((session) => makeDailyEvents(session, now, "markets", "market")),
    ...killZoneSchedules.flatMap((zone) => makeDailyEvents(zone, now, "killZones", "kill")),
    ...overlaps.flatMap((overlap) => makeDailyEvents(overlap, now, "overlaps", "kill").filter((event) => event.kind === "kill-zone-start").map((event) => ({ ...event, id: event.id.replace("kill-zone-start", "overlap-start"), kind: "overlap-start" as const, title: "High Liquidity", description: `${overlap.name} overlap is now active.`, emoji: "🔥", category: "overlaps" as const })))
  ];
  // FX weekly candle begins Sunday 17:00 New York time; the local conversion follows DST automatically.
  for (const offset of [-1, 0, 1]) {
    const d = addLocalDays(now, "America/New_York", offset);
    const candidate = zonedDate(d.year, d.month, d.day, 17, "America/New_York");
    if (parts(candidate, "America/New_York").hour === 17 && new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(candidate) === "Sun") {
      events.push({ id: `weekly-open-${candidate.toISOString().slice(0, 10)}`, kind: "weekly-open", at: candidate, title: "New Weekly Candle", description: "A new trading week has started. Weekly Open has been established.", emoji: "🕯️", category: "weekly" });
    }
  }
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function nextTradingEvents(now = new Date()) {
  return getTradingEvents(now).filter((event) => event.at.getTime() > now.getTime()).slice(0, 4);
}
