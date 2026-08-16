"use client";

import { motion } from "framer-motion";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Flame,
  Globe,
  Info,
  Layers,
  ShieldAlert,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Zap
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type OverlapDefinition = {
  id: string;
  name: string;
  code: string;
  baseZone: string;
  startHour: number;
  endHour: number;
  liquidity: number; // 1-5
  volatility: number; // 1-5
  spreadQuality: string;
  institutionalActivity: string;
  whyItMatters: string;
  bestFor: {
    forex: string[];
    commodities: string[];
    indices: string[];
  };
  characteristics: {
    avoidWhen: string;
    behaviour: string;
  };
  tradingTips: string[];
};

const overlapDefs: OverlapDefinition[] = [
  {
    id: "london-ny",
    name: "London + New York",
    code: "UK · US",
    baseZone: "Europe/London",
    startHour: 13,
    endHour: 17,
    liquidity: 5,
    volatility: 5,
    spreadQuality: "Ultra-Tight Spreads",
    institutionalActivity: "Peak Institutional Collision",
    whyItMatters:
      "This overlap represents the absolute highest trading volume and liquidity window of the 24-hour daily cycle. European and American institutional capital collides, offering ultra-tight spreads, aggressive displacement, maximum order fill speed, and high-probability momentum trends.",
    bestFor: {
      forex: ["EUR/USD", "GBP/USD", "USD/CAD", "EUR/GBP"],
      commodities: ["Gold (XAU/USD)", "WTI Crude Oil"],
      indices: ["US30", "NAS100", "S&P 500", "FTSE 100"]
    },
    characteristics: {
      avoidWhen: "High-impact FOMC / NFP release seconds without confirmation",
      behaviour: "Aggressive displacement, strong trend continuation, maximum liquidity sweeps"
    },
    tradingTips: [
      "Optimal window for ICT Silver Bullet and trend continuation models",
      "Watch for NY open (09:30 EDT) liquidity sweeps colliding with London momentum",
      "Peak volume provides the tightest spreads on major FX pairs & Gold",
      "Avoid entering new positions in the last 30 minutes before London close"
    ]
  },
  {
    id: "tokyo-london",
    name: "Tokyo + London",
    code: "JP · UK",
    baseZone: "Europe/London",
    startHour: 8,
    endHour: 9,
    liquidity: 4,
    volatility: 4,
    spreadQuality: "Tight Spreads",
    institutionalActivity: "European Entry & Fix Flow",
    whyItMatters:
      "Marks the critical transition from Asian consolidation into European expansion. Asian market participants fix their morning benchmark positions as London institutions enter, creating early European directional swings and liquidity sweeps across JPY and EUR pairs.",
    bestFor: {
      forex: ["EUR/JPY", "GBP/JPY", "USD/JPY", "EUR/GBP"],
      commodities: ["Gold (XAU/USD)"],
      indices: ["Nikkei 225", "FTSE 100"]
    },
    characteristics: {
      avoidWhen: "Low-volume Asian range consolidation without clear liquidity targets",
      behaviour: "Judas Swing liquidity sweeps of Asian High/Low before European expansion"
    },
    tradingTips: [
      "Watch for Judas Swings capturing Asian session High or Low liquidity",
      "High-probability momentum window for EUR/JPY and GBP/JPY pairs",
      "European banks fix morning benchmark positions as Tokyo traders close out",
      "Look for Market Structure Shifts (MSS) following the 08:00 London open"
    ]
  },
  {
    id: "sydney-tokyo",
    name: "Sydney + Tokyo",
    code: "AU · JP",
    baseZone: "Asia/Tokyo",
    startHour: 9,
    endHour: 16,
    liquidity: 3,
    volatility: 2,
    spreadQuality: "Moderate Spreads",
    institutionalActivity: "Asia-Pacific Commercial Flow",
    whyItMatters:
      "The primary opening window for the Asia-Pacific economic region. Ideal for range-bound strategies, accumulation phase observation, and initial daily liquidity setup on AUD, NZD, and JPY pairs before the European session opens.",
    bestFor: {
      forex: ["AUD/JPY", "NZD/JPY", "AUD/USD", "NZD/USD"],
      commodities: ["Silver (XAG/USD)"],
      indices: ["ASX 200", "Nikkei 225"]
    },
    characteristics: {
      avoidWhen: "Chasing breakout trades (markets tend to be range-bound)",
      behaviour: "Order accumulation, mean-reversion ranges, initial daily benchmark formation"
    },
    tradingTips: [
      "Ideal for range trading strategies and support/resistance bounces",
      "Monitor AUD/USD and NZD/USD for Asian session benchmark range formation",
      "Institutional order accumulation window prior to London and NY expansion",
      "Pay attention to AUD and JPY central bank news released at Tokyo open"
    ]
  }
];

function parts(date: Date, timezone: string) {
  const values = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const get = (type: string) => Number(values.find((part) => part.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

function zonedInstant(year: number, month: number, day: number, hour: number, minute: number, zone: string) {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  for (let i = 0; i < 2; i++) {
    const current = parts(new Date(instant), zone);
    instant += target - Date.UTC(current.year, current.month - 1, current.day, current.hour, current.minute);
  }
  return new Date(instant);
}

function addLocalDays(now: Date, zone: string, days: number) {
  const local = parts(now, zone);
  const date = new Date(Date.UTC(local.year, local.month - 1, local.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function isTradingDay(date: Date, timezone: string) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(date);
  return !["Sat", "Sun"].includes(weekday);
}

function getInstances(def: OverlapDefinition, now: Date) {
  const offsets = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7];
  const list = [];

  for (const offset of offsets) {
    const day = addLocalDays(now, def.baseZone, offset);
    const startAt = zonedInstant(day.year, day.month, day.day, def.startHour, 0, def.baseZone);
    const endDay = def.endHour <= def.startHour ? addLocalDays(now, def.baseZone, offset + 1) : day;
    const endAt = zonedInstant(endDay.year, endDay.month, endDay.day, def.endHour, 0, def.baseZone);

    if (isTradingDay(startAt, def.baseZone)) {
      list.push({ ...def, startAt, endAt });
    }
  }
  return list;
}

function formatTime(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

function formatDateLabel(date: Date, timezone: string, now: Date) {
  const targetDateStr = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "numeric", day: "numeric" }).format(date);
  const nowDateStr = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "numeric", day: "numeric" }).format(now);

  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowDateStr = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "numeric", day: "numeric" }).format(tomorrow);

  if (targetDateStr === nowDateStr) return "Today";
  if (targetDateStr === tomorrowDateStr) return "Tomorrow";

  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", month: "short", day: "numeric" }).format(date);
}

function formatRangeWithDate(start: Date, end: Date, timezone: string, now: Date) {
  const dateLabel = formatDateLabel(start, timezone, now);
  return `${dateLabel} • ${formatTime(start, timezone)} – ${formatTime(end, timezone)}`;
}

function countdown(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}

function StarRating({ count, label }: { count: number; label: string }) {
  return (
    <div className="space-y-1">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">{label}</span>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-4 w-4 ${
                i < count ? "fill-[#FF9F1C] text-[#FF9F1C]" : "fill-zinc-800 text-zinc-700 opacity-40"
              }`}
            />
          ))}
        </div>
        <span className="text-xs font-bold text-[#FF9F1C] ml-1">{count}/5</span>
      </div>
    </div>
  );
}

export function SessionOverlapsPage({ now }: { now: Date }) {
  const [localZone, setLocalZone] = useState("Asia/Karachi");

  useEffect(() => {
    try {
      setLocalZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Karachi");
    } catch {
      setLocalZone("Asia/Karachi");
    }
  }, []);

  const overlapInfos = useMemo(() => {
    return overlapDefs.map((def) => {
      const instances = getInstances(def, now);
      const active = instances.find((item) => item.startAt <= now && item.endAt > now);
      const next = instances.filter((item) => item.startAt > now).sort((a, b) => a.startAt.getTime() - b.startAt.getTime())[0];
      const previous = instances.filter((item) => item.endAt <= now).sort((a, b) => b.endAt.getTime() - a.endAt.getTime())[0];
      return {
        def,
        active,
        next: next ?? instances[instances.length - 1],
        previous
      };
    });
  }, [now]);

  // Determine currently active overlap (if any)
  const activeOverlapInfo = overlapInfos.find((item) => item.active);
  const activeItem = activeOverlapInfo?.active;

  // Find the next upcoming overlap across all 3
  const nextUpcoming = useMemo(() => {
    const upcomingList = overlapInfos
      .map((item) => item.next)
      .filter(Boolean)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    return upcomingList[0];
  }, [overlapInfos]);

  const zoneAbbrev = (zone: string) => {
    if (zone === "Asia/Karachi") return "PKT";
    if (zone === "America/New_York") return "NY";
    if (zone === "Europe/London") return "UK";
    return zone.split("/")[1] || zone;
  };

  const activeCount = overlapInfos.filter((item) => item.active).length;

  return (
    <section className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-10 py-8 sm:py-10 md:py-12 space-y-8">
      {/* Title & Control Header */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FF8A00]/30 bg-[#FF8A00]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-[#FF9F1C] shadow-sm">
            <Sparkles className="h-4 w-4 text-[#FF8A00]" />
            <span>High Liquidity Windows</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-medium text-zinc-300">
              <Globe className="h-3.5 w-3.5 text-[#FF8A00]" />
              <span>Timezone: {zoneAbbrev(localZone)} ({localZone.replace(/_/g, " ")})</span>
            </span>
            <span className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold uppercase tracking-wider ${
              activeCount > 0
                ? "border-[#FF8A00]/40 bg-[#FF8A00]/15 text-[#FF9F1C] shadow-[0_0_12px_rgba(255,138,0,0.25)]"
                : "border-white/15 bg-white/[0.06] text-zinc-400"
            }`}>
              <span className={`h-2 w-2 rounded-full ${activeCount > 0 ? "bg-[#FF8A00] animate-pulse" : "bg-zinc-500"}`} />
              {activeCount > 0 ? `${activeCount} Overlap Active` : "Single Session Mode"}
            </span>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            Session Overlaps
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-400 sm:text-base">
            Live market overlap timing, institutional liquidity analytics, spread quality ratings, and ICT momentum window tracking.
          </p>
        </div>
      </div>

      {/* Educational Explanation Card */}
      <motion.article
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass relative overflow-hidden rounded-3xl border border-[#FF8A00]/20 bg-gradient-to-r from-[#FF8A00]/10 via-[#FF9F1C]/[0.04] to-[#FF8A00]/5 p-6 sm:p-7 md:p-8 shadow-glow"
      >
        <div className="flex flex-col sm:flex-row items-start gap-5">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#FF8A00]/30 bg-[#FF8A00]/15 text-[#FF9F1C] shadow-sm">
            <Info className="h-6 w-6" />
          </div>
          <div className="space-y-2 min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-bold text-white">What Are Session Overlaps?</h2>
            <p className="text-sm leading-relaxed text-zinc-300 break-words">
              Session overlaps occur when two major international financial centers operate simultaneously. Institutional capital flow from both regions merges into a single order book, driving peak trading volume, ultra-tight spreads, and strong directional displacement ideal for technical setups.
            </p>
          </div>
        </div>
      </motion.article>

      {/* HERO SECTION: Current Overlap OR No Active Overlap Banner */}
      <div>
        {activeItem ? (
          <motion.article
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass relative overflow-hidden rounded-3xl border border-[#FF8A00]/40 bg-gradient-to-br from-[#111111] via-[#0A0A0A] to-[#050505] p-6 sm:p-8 md:p-10 shadow-[0_0_50px_rgba(255,138,0,0.18)] space-y-8"
          >
            <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#FF8A00]/15 blur-3xl pointer-events-none" />
            <div className="relative space-y-6">
              {/* Header Badges */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 rounded-full border border-[#FF8A00]/30 bg-[#FF8A00]/10 px-4 py-1.5">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF9F1C] opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#FF8A00]"></span>
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#FF9F1C]">
                    CURRENT OVERLAP IS ACTIVE
                  </span>
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-[#FF8A00]/40 bg-[#FF8A00]/20 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#FFB45A] shadow-[0_0_15px_rgba(255,138,0,0.3)]">
                  <Flame className="h-4 w-4 text-[#FF8A00]" />
                  ACTIVE NOW
                </span>
              </div>

              {/* Title & Location Tag */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-3xl font-bold text-white sm:text-4xl md:text-5xl tracking-tight">
                    {activeItem.name}
                  </h2>
                  <span className="rounded-lg border border-[#FF8A00]/30 bg-[#FF8A00]/15 px-3.5 py-1 text-xs font-bold text-[#FF9F1C] tracking-wider">
                    {activeItem.code}
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-zinc-300 break-words">
                  {formatRangeWithDate(activeItem.startAt, activeItem.endAt, localZone, now)} ({zoneAbbrev(localZone)}) &bull; {formatRangeWithDate(activeItem.startAt, activeItem.endAt, "America/New_York", now)} (NY EDT)
                </p>
              </div>

              {/* Countdown & Thick Progress Bar Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-[#FF8A00]/25 bg-[#FF8A00]/[0.08] p-6 flex flex-col justify-between space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF9F1C]/90">
                    Time Remaining
                  </span>
                  <p className="digital text-3xl sm:text-4xl md:text-5xl font-bold tracking-wider text-[#FF9F1C] break-words">
                    {countdown(activeItem.endAt.getTime() - now.getTime())}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/40 p-6 flex flex-col justify-center space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span className="font-semibold uppercase tracking-wider text-zinc-300">
                      Overlap Duration Progress
                    </span>
                    <span className="digital text-[#FF8A00] font-bold text-base">
                      {Math.round(
                        ((now.getTime() - activeItem.startAt.getTime()) /
                          (activeItem.endAt.getTime() - activeItem.startAt.getTime())) *
                          100
                      )}%
                    </span>
                  </div>
                  <div className="h-4 w-full overflow-hidden rounded-full bg-white/10 p-0.5 border border-[#FF8A00]/25">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#FF9F1C] via-[#FF8A00] to-[#FF9F1C] shadow-[0_0_15px_rgba(255,138,0,0.8)] transition-all duration-1000"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            ((now.getTime() - activeItem.startAt.getTime()) /
                              (activeItem.endAt.getTime() - activeItem.startAt.getTime())) *
                              100
                          )
                        )}%`
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Statistics Row */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <StarRating count={activeItem.liquidity} label="Liquidity Rating" />
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <StarRating count={activeItem.volatility} label="Volatility Rating" />
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">Spread Quality</span>
                  <span className="text-xs font-bold text-[#FF9F1C] block">{activeItem.spreadQuality}</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 space-y-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">Institutional Flow</span>
                  <span className="text-xs font-bold text-[#FF9F1C] block">{activeItem.institutionalActivity}</span>
                </div>
              </div>

              {/* Why It Matters & Trading Tips */}
              <div className="grid gap-4 lg:grid-cols-2 pt-2">
                <div className="rounded-2xl border border-[#FF8A00]/20 bg-black/30 p-6 space-y-3">
                  <div className="flex items-center gap-2 text-[#FF9F1C]">
                    <Target className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em]">Why It Matters</span>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-300 break-words">
                    {activeItem.whyItMatters}
                  </p>
                </div>
                <div className="rounded-2xl border border-[#FF8A00]/20 bg-black/30 p-6 space-y-3">
                  <div className="flex items-center gap-2 text-[#FF9F1C]">
                    <Zap className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-[0.18em]">Institutional Trading Tips</span>
                  </div>
                  <ul className="space-y-2 text-xs text-zinc-300">
                    {activeItem.tradingTips.map((tip, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#FF8A00] shrink-0 mt-0.5" />
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.article>
        ) : (
          <motion.article
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0c0d10] via-[#08090b] to-[#040507] p-6 sm:p-8 md:p-10 shadow-glow"
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-zinc-700/50 bg-zinc-900/60 text-zinc-400 shadow-sm">
                <Clock3 className="h-7 w-7 text-[#FF8A00]" />
              </div>
              <h2 className="text-2xl sm:text-3xl font-bold text-white">
                No Active Session Overlap
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-zinc-400">
                Global forex markets are currently operating in single-session mode. Liquidity and volatility will surge again during the next overlap window.
              </p>

              {nextUpcoming ? (
                <div className="mt-4 w-full max-w-2xl rounded-2xl border border-[#FF8A00]/20 bg-[#111111] p-6 sm:p-7 text-left space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#FF9F1C]">
                      Next Upcoming Overlap
                    </span>
                    <span className="rounded-full border border-[#FF8A00]/25 bg-[#FF8A00]/10 px-3.5 py-1 text-xs font-semibold text-[#FF9F1C] uppercase tracking-wider">
                      Upcoming &bull; {formatDateLabel(nextUpcoming.startAt, localZone, now)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl sm:text-2xl font-bold text-white">{nextUpcoming.name}</h3>
                      <span className="rounded-lg border border-[#FF8A00]/25 bg-[#FF8A00]/10 px-2.5 py-0.5 text-xs font-bold text-[#FF9F1C]">
                        {nextUpcoming.code}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed text-zinc-400 break-words">
                      {formatRangeWithDate(nextUpcoming.startAt, nextUpcoming.endAt, localZone, now)} ({zoneAbbrev(localZone)}) &bull; {formatRangeWithDate(nextUpcoming.startAt, nextUpcoming.endAt, "America/New_York", now)} (NY EDT)
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end justify-between gap-3 border-t border-[#222222] pt-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#FF9F1C]/80">
                      Starts In
                    </span>
                    <span className="digital text-2xl sm:text-3xl font-bold text-white tracking-wider">
                      {countdown(nextUpcoming.startAt.getTime() - now.getTime())}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </motion.article>
        )}
      </div>

      {/* ALL SESSION OVERLAPS CARDS GRID */}
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            All Session Overlaps
          </h2>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1 text-xs font-medium text-zinc-400">
            Calculated in real-time
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-stretch">
          {overlapInfos.map(({ def, active, next }, index) => {
            const isCurrentlyActive = Boolean(active);
            const displayItem = active ?? next;
            const remainingOrStarts = (isCurrentlyActive ? active!.endAt : next.startAt).getTime() - now.getTime();
            const progress = isCurrentlyActive
              ? Math.min(
                  100,
                  Math.max(
                    0,
                    ((now.getTime() - active!.startAt.getTime()) / (active!.endAt.getTime() - active!.startAt.getTime())) * 100
                  )
                )
              : 0;

            const isEndingSoon = isCurrentlyActive && (active!.endAt.getTime() - now.getTime() <= 30 * 60 * 1000);
            const dateBadge = formatDateLabel(displayItem.startAt, localZone, now);

            // Color themes per status
            const themeClass = isEndingSoon
              ? "border-[#FF9F1C]/40 bg-[#FF9F1C]/[0.04] shadow-[0_0_35px_rgba(255,159,28,0.12)]"
              : isCurrentlyActive
              ? "border-[#FF8A00]/40 bg-[#FF8A00]/[0.04] shadow-[0_0_35px_rgba(255,138,0,0.12)]"
              : "border-[#222222] bg-[#0A0A0A] hover:border-[#FF8A00]/30 hover:shadow-glow";

            const badgeClass = isEndingSoon
              ? "border-[#FF9F1C]/40 bg-[#FF9F1C]/15 text-[#FF9F1C] shadow-[0_0_12px_rgba(255,159,28,0.3)]"
              : isCurrentlyActive
              ? "border-[#FF8A00]/40 bg-[#FF8A00]/15 text-[#FF9F1C] shadow-[0_0_12px_rgba(255,138,0,0.3)]"
              : "border-[#2A2A2A] bg-[#111111] text-[#8A8A8A]";

            const countdownClass = isEndingSoon
              ? "text-[#FF9F1C]"
              : isCurrentlyActive
              ? "text-[#FF9F1C]"
              : "text-[#8A8A8A]";

            return (
              <motion.article
                key={def.id}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className={`glass relative flex flex-col justify-between overflow-hidden rounded-3xl p-6 sm:p-7 shadow-glow transition-all duration-300 min-w-0 h-full hover:-translate-y-0.5 ${themeClass}`}
              >
                <div className="space-y-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-5">
                    {/* Top Status & Badge */}
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
                        Liquidity Window
                      </span>
                      <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider shrink-0 ${badgeClass}`}>
                        <span className={`h-2 w-2 rounded-full ${isCurrentlyActive ? (isEndingSoon ? "bg-[#FF9F1C] animate-pulse" : "bg-[#FF8A00] animate-pulse") : "bg-[#8A8A8A]"}`} />
                        {isEndingSoon ? "Ending Soon" : isCurrentlyActive ? "Active Now" : `Upcoming • ${dateBadge}`}
                      </span>
                    </div>

                    {/* Name & Code */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">
                        {def.name}
                      </h3>
                      <span className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-bold text-white shrink-0">
                        {def.code}
                      </span>
                    </div>

                    {/* Timing Ranges */}
                    <div className="space-y-2.5 rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-zinc-300">
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <span className="text-zinc-400 font-medium">Your Time ({zoneAbbrev(localZone)})</span>
                        <span className="font-semibold text-white tracking-wide">{formatRangeWithDate(displayItem.startAt, displayItem.endAt, localZone, now)}</span>
                      </div>
                      <div className="flex flex-wrap justify-between items-center gap-2 border-t border-white/5 pt-2">
                        <span className="text-zinc-400 font-medium">New York (EDT)</span>
                        <span className="font-medium text-zinc-200 tracking-wide">{formatRangeWithDate(displayItem.startAt, displayItem.endAt, "America/New_York", now)}</span>
                      </div>
                    </div>

                    {/* Countdown Box */}
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 p-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                          {isCurrentlyActive ? "Ends In" : "Starts In"}
                        </p>
                        <p className={`digital mt-1.5 text-xl sm:text-2xl font-bold tracking-wider ${countdownClass}`}>
                          {countdown(remainingOrStarts)}
                        </p>
                      </div>
                      {isCurrentlyActive ? (
                        <Flame className="h-6 w-6 text-[#FF8A00] shrink-0" />
                      ) : (
                        <Clock3 className="h-5 w-5 text-[#8A8A8A] shrink-0" />
                      )}
                    </div>

                    {/* Active Progress Bar */}
                    {isCurrentlyActive ? (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-medium text-zinc-400">
                          <span>Window Progress</span>
                          <span className="digital text-[#FF8A00] font-semibold">{Math.round(progress)}%</span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-white/10 p-0.5 border border-[#FF8A00]/20">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#FF9F1C] to-[#FF9F1C] shadow-[0_0_10px_rgba(255,138,0,0.8)] transition-all duration-1000"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : null}

                    {/* Market Activity Ratings */}
                    <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs">
                      <div className="rounded-2xl border border-white/8 bg-black/30 p-3">
                        <StarRating count={def.liquidity} label="Liquidity" />
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-black/30 p-3">
                        <StarRating count={def.volatility} label="Volatility" />
                      </div>
                    </div>

                    {/* Quality & Activity Labels */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl border border-white/5 bg-black/20 p-2.5">
                        <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Spreads</span>
                        <span className="text-xs font-semibold text-zinc-200">{def.spreadQuality}</span>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-black/20 p-2.5">
                        <span className="text-[10px] uppercase font-semibold text-zinc-400 block">Flow</span>
                        <span className="text-xs font-semibold text-zinc-200">{def.institutionalActivity}</span>
                      </div>
                    </div>

                    {/* Categorized Best Instruments */}
                    <div className="space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 block">
                        Best Instruments
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {def.bestFor.forex.map((item) => (
                          <span
                            key={item}
                            className="rounded-lg border border-[#FF8A00]/25 bg-[#FF8A00]/[0.08] px-2.5 py-1 text-xs font-medium text-[#FF9F1C] shadow-sm"
                          >
                            {item}
                          </span>
                        ))}
                        {def.bestFor.commodities.map((item) => (
                          <span
                            key={item}
                            className="rounded-lg border border-[#FF9F1C]/25 bg-[#FF9F1C]/[0.08] px-2.5 py-1 text-xs font-medium text-[#FF9F1C] shadow-sm"
                          >
                            {item}
                          </span>
                        ))}
                        {def.bestFor.indices.map((item) => (
                          <span
                            key={item}
                            className="rounded-lg border border-[#222222] bg-[#111111] px-2.5 py-1 text-xs font-medium text-[#8A8A8A] shadow-sm"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Characteristics */}
                    <div className="space-y-2 rounded-2xl border border-white/5 bg-black/20 p-3 text-xs">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 block">Behaviour</span>
                        <span className="text-zinc-300">{def.characteristics.behaviour}</span>
                      </div>
                      <div className="border-t border-white/5 pt-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#FF9F1C] block">Avoid When</span>
                        <span className="text-zinc-300">{def.characteristics.avoidWhen}</span>
                      </div>
                    </div>

                    {/* Trading Tips */}
                    <div className="space-y-1.5 border-t border-white/10 pt-4">
                      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#FF9F1C]/90 block">
                        Key Trading Tips
                      </span>
                      <ul className="space-y-1.5 text-xs text-zinc-300">
                        {def.tradingTips.slice(0, 2).map((tip, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#FF8A00] shrink-0 mt-0.5" />
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Why It Matters Paragraph */}
                  <div className="border-t border-white/10 pt-4 space-y-1.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[#FF9F1C]/90 block">
                      Why It Matters
                    </span>
                    <p className="text-xs leading-relaxed text-zinc-300 break-words">{def.whyItMatters}</p>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
