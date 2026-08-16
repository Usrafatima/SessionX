import { NextResponse } from "next/server";
import { fetchWeeklyCandles } from "@/lib/twelveData";

export async function GET() {
  try {
    const candles = await fetchWeeklyCandles();
    return NextResponse.json({ candles });
  } catch {
    return NextResponse.json(
      { message: "Unable to load market data. Please try again later." },
      { status: 502 }
    );
  }
}
