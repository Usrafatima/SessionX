function loadEnv(path: string) {
  const fs = require("fs");
  const text = fs.readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}

async function main() {
  loadEnv(require("path").join(__dirname, "..", ".env"));
  console.log("project", process.env.FIREBASE_ADMIN_PROJECT_ID);
  console.log("keyLen", (process.env.FIREBASE_ADMIN_PRIVATE_KEY || "").length);
  console.log("cron", Boolean(process.env.CRON_SECRET));

  const { getTradingEvents } = await import("../lib/tradingSchedule");
  const { getFirebaseAdmin, getAdminDb, getAdminMessaging } = await import("../lib/firebaseAdmin");
  const { listNotificationHistory, listPushTokens } = await import("../lib/pushStore");

  const now = new Date();
  console.log("NOW", now.toISOString(), now.toString());
  const events = getTradingEvents(now);
  const windowMs = 5 * 60_000;
  const near: any[] = [];
  for (const event of events) {
    for (const reminder of [10, 5, 1, 0]) {
      const trigger = event.at.getTime() - reminder * 60_000;
      const diffMs = now.getTime() - trigger;
      if (Math.abs(diffMs) <= windowMs) {
        near.push({
          id: event.id,
          kind: event.kind,
          at: event.at.toISOString(),
          reminder,
          diffMs,
          title: event.title
        });
      }
    }
  }
  console.log("Total events", events.length);
  console.log("In ±5min window now", near.length, JSON.stringify(near.slice(0, 10), null, 2));
  console.log("Next 8 upcoming:");
  events
    .filter((e) => e.at > now)
    .slice(0, 8)
    .forEach((e) => console.log(" ", e.at.toISOString(), e.title, e.id));
  console.log("Last 8 past:");
  events
    .filter((e) => e.at <= now)
    .slice(-8)
    .forEach((e) => console.log(" ", e.at.toISOString(), e.title, e.id));

  try {
    const app = getFirebaseAdmin();
    console.log("Firebase Admin app", app ? "OK" : "NULL");
    const db = getAdminDb();
    console.log("Firestore", db ? "OK" : "NULL");
    const msg = getAdminMessaging();
    console.log("Messaging", msg ? "OK" : "NULL");
    if (db) {
      const tokens = await listPushTokens();
      console.log(
        "Push tokens",
        tokens.length,
        JSON.stringify(
          tokens.map((t) => ({ prefs: t.preferences, tokenPrefix: t.token?.slice(0, 12) })),
          null,
          2
        )
      );
      const history = await listNotificationHistory(20);
      console.log("History count", history.length);
      console.log("History sample", JSON.stringify(history.slice(0, 5), null, 2));
    }
  } catch (error) {
    console.error("Firebase error", error);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
