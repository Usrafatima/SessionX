"use client";

import { motion } from "framer-motion";

export function WeekProgress({ progress, started }: { progress: number; started: string }) {
  const date = new Date(started);
  const weekday = Number.isNaN(date.getTime())
    ? started
    : new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Week Started</p>
          <p className="mt-1 font-medium text-white">{weekday}</p>
        </div>
        <p className="digital text-xl font-semibold text-[#FF9F1C]">{Math.round(progress)}%</p>
      </div>
      <div className="mt-4 h-2 rounded-full bg-white/8">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#FF8A00] to-[#FF9F1C]"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
