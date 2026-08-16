import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, getAdminMessaging } from "@/lib/firebaseAdmin";
import {
  claimDelivery,
  claimNotificationHistory,
  listPushTokens,
  removePushToken
} from "@/lib/pushStore";
import { getTradingEvents, TradingEvent } from "@/lib/tradingSchedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A real multi-token run performs many sequential FCM sends + Firestore writes;
// Vercel Hobby functions default to a 10s cap, which kills the route mid-loop and
// prevents writeLastCheckedAt from ever running. Raise the limit so a full delivery
// cycle completes (max allowed: 60s on Hobby, up to 300s on Pro).
export const maxDuration = 60;

const CRON_STATE_DOC = "notifications";
const MAX_LOOKBACK_MS = 24 * 60 * 60_000;
/** Only attempt FCM for triggers that occurred recently (avoid catch-up spam). */
const PUSH_FRESHNESS_MS = 30 * 60_000;

const pageFor = (kind: string) =>
  kind.startsWith("market")
    ? "market-status"
    : kind.startsWith("kill")
      ? "kill-zones"
      : kind === "overlap-start"
        ? "overlaps"
        : kind === "weekly-open"
          ? "weekly-candle"
          : "calendar";

function log(step: string, details?: Record<string, unknown>) {
  // Log run boundaries in production too, so Vercel function logs prove the cron is
  // being invoked every minute even when nothing is due.
  if (process.env.NODE_ENV === "development" || step.includes("failed") || step === "run start" || step === "run complete" || step === "unauthorized") {
    console.log(`[cron/notifications] ${step}`, details ? JSON.stringify(details) : "");
  }
}

async function readLastCheckedAt(nowMs: number): Promise<number> {
  const db = getAdminDb();
  if (!db) return nowMs - 15 * 60_000;
  try {
    const snap = await db.collection("cronState").doc(CRON_STATE_DOC).get();
    const value = snap.exists ? Number(snap.data()?.lastCheckedAt) : NaN;
    if (Number.isFinite(value) && value > 0) return value;
  } catch (error) {
    log("readLastCheckedAt failed", { error: error instanceof Error ? error.message : String(error) });
  }
  return nowMs - 15 * 60_000;
}

async function writeLastCheckedAt(nowMs: number) {
  const db = getAdminDb();
  if (!db) return;
  try {
    await db.collection("cronState").doc(CRON_STATE_DOC).set(
      { lastCheckedAt: nowMs, updatedAt: nowMs },
      { merge: true }
    );
  } catch (error) {
    log("writeLastCheckedAt failed", { error: error instanceof Error ? error.message : String(error) });
  }
}

function buildTestEvent(now: Date): TradingEvent {
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  return {
    id: `test-cron-${stamp}`,
    kind: "economic-news",
    at: now,
    title: "Cron Pipeline Test",
    description: "Controlled test event from /api/cron/notifications?test=1",
    emoji: "🧪",
    category: "news"
  };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  const isVercelCron = request.headers.get("x-vercel-cron") === "1";
  const forceTest = request.nextUrl.searchParams.get("test") === "1";

  if (process.env.CRON_SECRET) {
    if (secret !== process.env.CRON_SECRET && !isVercelCron) {
      log("unauthorized", { hasSecret: Boolean(secret), isVercelCron });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const db = getAdminDb();
  const messaging = getAdminMessaging();
  if (!db) {
    log("firebase admin db missing");
    return NextResponse.json({ error: "Firebase Admin is not configured." }, { status: 503 });
  }

  const now = new Date();
  const nowMs = now.getTime();
  const lastCheckedAt = await readLastCheckedAt(nowMs);
  const sinceMs = Math.max(lastCheckedAt, nowMs - MAX_LOOKBACK_MS);

  log("run start", {
    now: now.toISOString(),
    lastCheckedAt: new Date(lastCheckedAt).toISOString(),
    since: new Date(sinceMs).toISOString(),
    forceTest,
    messagingConfigured: Boolean(messaging),
    isVercelCron
  });

  const subscriptions = await listPushTokens();
  log("subscriptions loaded", {
    count: subscriptions.length,
    pushEnabled: subscriptions.filter((item) => item.preferences.push).length
  });

  let sent = 0;
  let matched = 0;
  let historySaved = 0;
  let historyErrors = 0;
  let pushAttempts = 0;
  let pushSkippedStale = 0;
  let pushSkippedPrefs = 0;
  const matchedSummaries: Array<Record<string, unknown>> = [];

  const scheduled = forceTest ? [buildTestEvent(now)] : getTradingEvents(now);
  log("events evaluated", {
    count: scheduled.length,
    sample: scheduled.slice(0, 5).map((event) => ({
      id: event.id,
      at: event.at.toISOString(),
      title: event.title
    }))
  });

  for (const event of scheduled) {
    for (const reminder of [10, 5, 1, 0]) {
      const trigger = event.at.getTime() - reminder * 60_000;

      // Catch any trigger that became due since the last successful cron run.
      // forceTest: always process reminder 0 for the synthetic event.
      const due = forceTest
        ? reminder === 0
        : trigger > sinceMs && trigger <= nowMs;

      if (!due) continue;

      matched++;
      const ageMs = nowMs - trigger;
      const isEnding = event.kind === "market-close" || event.kind === "kill-zone-end";
      const title = reminder ? `${event.title} in ${reminder} minute${reminder === 1 ? "" : "s"}` : event.title;
      const body = reminder
        ? `${event.title} ${isEnding ? "ends" : "starts"} in ${reminder} minute${reminder === 1 ? "" : "s"}.`
        : event.description;
      const displayTitle = `${event.emoji} ${title}`;
      const historyId = `${event.id}-${reminder}`;

      matchedSummaries.push({
        id: event.id,
        reminder,
        trigger: new Date(trigger).toISOString(),
        ageMs,
        title: displayTitle
      });
      log("event matched", {
        id: event.id,
        kind: event.kind,
        category: event.category,
        reminder,
        eventAt: event.at.toISOString(),
        trigger: new Date(trigger).toISOString(),
        ageMs
      });

      // Persist once per eventId+reminder (deterministic id). Skip if already claimed.
      let historyCreated = false;
      try {
        historyCreated = await claimNotificationHistory({
          id: historyId,
          title: displayTitle,
          body,
          eventType: event.kind,
          eventId: event.id,
          timestamp: nowMs,
          category: event.category,
          sentSuccessfully: true,
          read: false,
          reminder
        });
        if (historyCreated) {
          historySaved++;
          log("firestore history write ok", { historyId });
        } else {
          log("firestore history already exists", { historyId });
        }
      } catch (error) {
        historyErrors++;
        log("firestore history write failed", {
          historyId,
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Still attempt FCM for fresh triggers even if history already existed
      // (delivery is separately claimed per token).
      const freshEnoughForPush = forceTest || ageMs <= PUSH_FRESHNESS_MS;
      if (!freshEnoughForPush) {
        pushSkippedStale++;
        continue;
      }

      if (!messaging) {
        continue;
      }

      let eligibleTokens = 0;
      let sentForThis = 0;
      for (const subscription of subscriptions) {
        const prefs = subscription.preferences;
        // Explicitly disabled push must stay off even if a stale token remains in
        // Firestore (undefined = legacy token, still deliverable).
        const pushEnabled = forceTest ? true : prefs.push !== false;
        const categoryEnabled = forceTest ? true : Boolean(prefs[event.category]);
        const reminderEnabled = forceTest ? true : prefs.reminders.includes(reminder);

        if (!pushEnabled || !categoryEnabled || !reminderEnabled) {
          pushSkippedPrefs++;
          continue;
        }
        eligibleTokens++;

        if (!(await claimDelivery(subscription.token, event.id, reminder))) {
          continue;
        }

        pushAttempts++;
        try {
          await messaging.send({
            token: subscription.token,
            notification: {
              title: displayTitle,
              body
            },
            webpush: {
              fcmOptions: { link: `/dashboard#notifications` },
              notification: {
                title: displayTitle,
                body,
                icon: "/icons/icon.svg",
                badge: "/icons/badge.svg"
              }
            },
            data: {
              eventId: event.id,
              kind: event.kind,
              category: event.category,
              title: displayTitle,
              body,
              reminder: String(reminder),
              page: pageFor(event.kind),
              createdAt: String(nowMs)
            }
          });
          sent++;
          sentForThis++;
        } catch (error: unknown) {
          const code = (error as { code?: string }).code;
          log("fcm send failed", {
            eventId: event.id,
            reminder,
            code,
            error: error instanceof Error ? error.message : String(error)
          });
          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            await removePushToken(subscription.token);
          }
        }
      }

      // The history entry is claimed before the send (atomic dedup), so if every
      // eligible FCM send failed, correct the record instead of claiming success.
      if (historyCreated && eligibleTokens > 0 && sentForThis === 0) {
        try {
          await db.collection("notificationHistory").doc(historyId).update({ sentSuccessfully: false });
          log("history marked as undelivered", { historyId, eligibleTokens });
        } catch (error) {
          log("history undelivered update failed", { historyId, error: error instanceof Error ? error.message : String(error) });
        }
      }
    }
  }

  await writeLastCheckedAt(nowMs);

  const result = {
    ok: true,
    sent,
    matched,
    historySaved,
    historyErrors,
    pushAttempts,
    pushSkippedStale,
    pushSkippedPrefs,
    subscriptionCount: subscriptions.length,
    checkedAt: now.toISOString(),
    lastCheckedAt: new Date(lastCheckedAt).toISOString(),
    since: new Date(sinceMs).toISOString(),
    forceTest,
    matchedSummaries: matchedSummaries.slice(0, 30)
  };
  log("run complete", result);
  return NextResponse.json(result);
}
