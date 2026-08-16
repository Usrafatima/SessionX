import { NextRequest, NextResponse } from "next/server";
import { removePushToken, upsertPushToken } from "@/lib/pushStore";

export const runtime = "nodejs";

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  return Boolean(origin && host && new URL(origin).host === host);
}

export async function POST(request: NextRequest) {
  try {
    if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin subscriptions are not allowed." }, { status: 403 });
    const { token, preferences } = await request.json();
    if (typeof token !== "string" || token.length < 20 || !preferences) return NextResponse.json({ error: "Invalid push subscription." }, { status: 400 });
    await upsertPushToken({ token, preferences });
    return NextResponse.json({ ok: true });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save push subscription." }, { status: 503 }); }
}

export async function DELETE(request: NextRequest) {
  try { if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-origin subscriptions are not allowed." }, { status: 403 }); const { token } = await request.json(); if (typeof token === "string") await removePushToken(token); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Unable to remove push subscription." }, { status: 503 }); }
}
