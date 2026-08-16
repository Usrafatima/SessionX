"use client";

import { motion } from "framer-motion";

export function WeeklyRangeBar({ position }: { position: number }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-zinc-500">
        <span>Low</span>
        <span>Weekly Range</span>
        <span>High</span>
      </div>
      <div className="relative h-3 overflow-hidden rounded-full bg-white/8">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-red-400 via-[#FF8A00] to-[#FF9F1C]"
          initial={{ width: 0 }}
          animate={{ width: `${position}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
        <motion.div
          className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-[#FFB45A] bg-[#FF8A00] shadow-[0_0_22px_rgba(255,138,0,0.55)]"
          initial={{ left: 0 }}
          animate={{ left: `calc(${position}% - 10px)` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
