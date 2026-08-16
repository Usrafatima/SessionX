export type MarketInstrumentKind = "forex" | "metal" | "index" | "crypto";

export type WeeklyCandle = {
  symbol: string;
  sourceSymbol: string;
  label: string;
  kind: MarketInstrumentKind;
  weeklyOpen: number;
  weeklyHigh: number;
  weeklyLow: number;
  currentClose: number;
  weekStartDate: string;
  decimals: number;
  pipSize: number | null;
  difference: number;
  pipDifference: number | null;
  rangePosition: number;
  weekProgress: number;
};

type TwelveDataBar = {
  datetime: string;
  open: string;
  high: string;
  low: string;
  close: string;
};

type TwelveDataSeries = {
  status?: string;
  message?: string;
  values?: TwelveDataBar[];
};

type Instrument = {
  symbol: string;
  sourceSymbol: string;
  label: string;
  kind: MarketInstrumentKind;
  decimals: number;
  pipSize: number | null;
};

let cachedCandles: WeeklyCandle[] | null = null;
let cachedAt = 0;
let inFlight: Promise<WeeklyCandle[]> | null = null;

function getInstruments(): Instrument[] {
  return [
    { symbol: "EUR/USD", sourceSymbol: "EUR/USD", label: "EUR/USD", kind: "forex", decimals: 5, pipSize: 0.0001 },
    { symbol: "GBP/USD", sourceSymbol: "GBP/USD", label: "GBP/USD", kind: "forex", decimals: 5, pipSize: 0.0001 },
    { symbol: "USD/JPY", sourceSymbol: "USD/JPY", label: "USD/JPY", kind: "forex", decimals: 3, pipSize: 0.01 },
    { symbol: "XAU/USD", sourceSymbol: "XAU/USD", label: "XAU/USD (Gold)", kind: "metal", decimals: 2, pipSize: null },
    {
      symbol: "NAS100",
      sourceSymbol: process.env.TWELVE_DATA_NAS100_SYMBOL || "QQQ",
      label: "NAS100",
      kind: "index",
      decimals: 2,
      pipSize: null
    },
    {
      symbol: "US30",
      sourceSymbol: process.env.TWELVE_DATA_US30_SYMBOL || "DIA",
      label: "US30",
      kind: "index",
      decimals: 2,
      pipSize: null
    },
    { symbol: "BTC/USD", sourceSymbol: "BTC/USD", label: "BTC/USD", kind: "crypto", decimals: 2, pipSize: null }
  ];
}

function toNumber(value: string | undefined, symbol: string, field: string) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Invalid ${field} value for ${symbol}`);
  }
  return numeric;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getWeekProgress() {
  const now = new Date();
  const day = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - day + 1));
  const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  return clamp(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100, 0, 100);
}

function normalizeBatchResponse(payload: unknown): Record<string, TwelveDataSeries> {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid Twelve Data response");
  }

  const maybeError = payload as { status?: string; message?: string };
  if (maybeError.status === "error") {
    throw new Error(maybeError.message ?? "Twelve Data returned an error");
  }

  const record = payload as Record<string, TwelveDataSeries>;
  return record;
}

async function requestWeeklyCandles(): Promise<WeeklyCandle[]> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    throw new Error("Missing TWELVE_DATA_API_KEY");
  }

  const instruments = getInstruments();
  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", instruments.map((item) => item.sourceSymbol).join(","));
  url.searchParams.set("interval", "1week");
  url.searchParams.set("outputsize", "1");
  url.searchParams.set("apikey", apiKey);

  const response = await fetch(url, {
    next: { revalidate: 30 }
  });

  if (!response.ok) {
    throw new Error(`Twelve Data request failed with ${response.status}`);
  }

  const payload = normalizeBatchResponse(await response.json());
  const weekProgress = getWeekProgress();

  return instruments.map((instrument) => {
    const series = payload[instrument.sourceSymbol];
    const latest = series?.values?.[0];

    if (!latest || series?.status === "error") {
      throw new Error(series?.message ?? `Missing weekly candle for ${instrument.sourceSymbol}`);
    }

    const weeklyOpen = toNumber(latest.open, instrument.symbol, "open");
    const weeklyHigh = toNumber(latest.high, instrument.symbol, "high");
    const weeklyLow = toNumber(latest.low, instrument.symbol, "low");
    const currentClose = toNumber(latest.close, instrument.symbol, "close");
    const difference = currentClose - weeklyOpen;
    const range = weeklyHigh - weeklyLow;

    return {
      symbol: instrument.symbol,
      sourceSymbol: instrument.sourceSymbol,
      label: instrument.label,
      kind: instrument.kind,
      weeklyOpen,
      weeklyHigh,
      weeklyLow,
      currentClose,
      weekStartDate: latest.datetime,
      decimals: instrument.decimals,
      pipSize: instrument.pipSize,
      difference,
      pipDifference: instrument.pipSize ? difference / instrument.pipSize : null,
      rangePosition: range > 0 ? clamp(((currentClose - weeklyLow) / range) * 100, 0, 100) : 50,
      weekProgress
    };
  });
}

export async function fetchWeeklyCandles(): Promise<WeeklyCandle[]> {
  const now = Date.now();
  if (cachedCandles && now - cachedAt < 30000) {
    return cachedCandles;
  }

  if (!inFlight) {
    inFlight = requestWeeklyCandles()
      .then((candles) => {
        cachedCandles = candles;
        cachedAt = Date.now();
        return candles;
      })
      .finally(() => {
        inFlight = null;
      });
  }

  return inFlight;
}
