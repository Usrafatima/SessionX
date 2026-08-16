"use client";

import { motion } from "framer-motion";
import type { WeeklyCandle } from "@/lib/twelveData";
import { PriceDifference } from "@/components/PriceDifference";
import { WeekProgress } from "@/components/WeekProgress";
import { WeeklyRangeBar } from "@/components/WeeklyRangeBar";

function formatPrice(value: number, decimals: number) {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">{label}</p>
      <p className={`digital mt-2 text-xl font-semibold ${tone ?? "text-white"}`}>{value}</p>
    </div>
  );
}

export function WeeklyCandleCard({ candle, index }: { candle: WeeklyCandle; index: number }) {
  const above = candle.difference >= 0;

  return (
    <motion.article
      className={`glass rounded-3xl p-6 ${above ? "shadow-[0_24px_80px_rgba(255,138,0,0.08)]" : "shadow-[0_24px_80px_rgba(248,113,113,0.08)]"}`}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.045, ease: "easeOut" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">{candle.kind}</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">{candle.label}</h3>
          {candle.sourceSymbol !== candle.symbol ? (
            <p className="mt-1 text-xs text-zinc-500">Twelve Data: {candle.sourceSymbol}</p>
          ) : null}
        </div>
        <span className="rounded-full border border-[#FF8A00]/25 bg-[#FF8A00]/10 px-3 py-1 text-xs font-semibold uppercase text-[#FF9F1C]">
          Live
        </span>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-3">
        <Metric label="Weekly Open" value={formatPrice(candle.weeklyOpen, candle.decimals)} tone="text-[#FF9F1C]" />
        <Metric label="Weekly High" value={formatPrice(candle.weeklyHigh, candle.decimals)} />
        <Metric label="Weekly Low" value={formatPrice(candle.weeklyLow, candle.decimals)} />
        <Metric label="Current" value={formatPrice(candle.currentClose, candle.decimals)} tone="text-[#FF8A00]" />
      </div>

      <div className="mt-5">
        <PriceDifference candle={candle} />
      </div>

      <div className="mt-6">
        <WeeklyRangeBar position={candle.rangePosition} />
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Metric label="Week Started" value={formatDate(candle.weekStartDate)} />
        <WeekProgress progress={candle.weekProgress} started={candle.weekStartDate} />
      </div>
    </motion.article>
  );
}
