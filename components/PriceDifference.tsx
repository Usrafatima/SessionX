"use client";

import { motion } from "framer-motion";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { WeeklyCandle } from "@/lib/twelveData";

function signed(value: number, decimals: number) {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(decimals)}`;
}

export function PriceDifference({ candle }: { candle: WeeklyCandle }) {
  const above = candle.difference >= 0;
  const Icon = above ? ArrowUp : ArrowDown;
  const tone = above ? "text-emerald-300 bg-emerald-300/10 border-emerald-300/20" : "text-red-300 bg-red-300/10 border-red-300/20";
  const unit = candle.pipDifference === null ? "Points" : "Pips";
  const unitValue = candle.pipDifference === null ? candle.difference : candle.pipDifference;

  return (
    <motion.div
      key={`${candle.symbol}-${candle.currentClose}`}
      initial={{ opacity: 0.6, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border p-4 ${tone}`}
    >
      <div className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4" />
        {above ? "Above Weekly Open" : "Below Weekly Open"}
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
        <p className="digital text-2xl font-semibold">{signed(candle.difference, candle.decimals)}</p>
        <p className="digital text-sm font-medium">{signed(unitValue, candle.pipDifference === null ? 2 : 1)} {unit}</p>
      </div>
    </motion.div>
  );
}
