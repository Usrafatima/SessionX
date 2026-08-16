import { NextRequest, NextResponse } from "next/server";
import { clearNotificationHistory, listNotificationHistory, saveNotificationHistory, NotificationHistoryItem } from "@/lib/pushStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await listNotificationHistory();
    return NextResponse.json({ ok: true, items });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load history" }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const deleted = await clearNotificationHistory();
    return NextResponse.json({ ok: true, deleted });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to clear history" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as NotificationHistoryItem;
    if (!body || !body.id || !body.title) {
      return NextResponse.json({ error: "Invalid history item payload" }, { status: 400 });
    }
    await saveNotificationHistory(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save history" }, { status: 500 });
  }
}
