"use client";

import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import type { WeeklyCandle } from "@/lib/twelveData";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { WeeklyCandleCard } from "@/components/WeeklyCandleCard";

type WeeklyCandleResponse = {
  candles: WeeklyCandle[];
};

export function WeeklyCandlePage() {
  const [candles, setCandles] = useState<WeeklyCandle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function loadCandles(background = false) {
    try {
      setError(false);
      if (background) setRefreshing(true);
      const response = await fetch("/api/weekly-candle", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load market data");
      const payload = (await response.json()) as WeeklyCandleResponse;
      setCandles(payload.candles);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadCandles();
    const id = window.setInterval(() => loadCandles(true), 30000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <section className="mx-auto flex min-h-[calc(100vh-40px)] w-full max-w-7xl flex-col justify-center px-5 py-8 lg:px-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.24em] text-[#FF8A00]/80">SessionX</p>
          <h1 className="mt-3 text-3xl font-semibold text-white md:text-5xl">Weekly Candle</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400 md:text-base">
            Live weekly open, high, low, and current close from Twelve Data.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin text-[#FF9F1C]" : "text-zinc-500"}`} />
          Refreshes every 30s
        </div>
      </div>

      {loading ? <LoadingSkeleton /> : null}

      {!loading && error ? (
        <div className="glass rounded-3xl p-8 text-center">
          <p className="text-xl font-semibold text-white">Unable to load market data.</p>
          <p className="mt-2 text-zinc-400">Please try again later.</p>
          <button
            onClick={() => {
              setLoading(true);
              loadCandles();
            }}
            className="mt-6 rounded-2xl border border-[#FF8A00]/20 bg-[#FF8A00]/10 px-5 py-3 text-sm font-semibold text-[#FFB45A]"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!loading && !error ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {candles.map((candle, index) => (
            <WeeklyCandleCard key={candle.symbol} candle={candle} index={index} />
          ))}
        </div>
      ) : null}
    </section>
  );
}
