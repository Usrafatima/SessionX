import { createHash } from "crypto";
import { AlertPreferences, defaultPreferences } from "@/lib/notificationPreferences";
import { getAdminDb } from "@/lib/firebaseAdmin";

export type PushSubscription = { token: string; preferences: AlertPreferences; updatedAt?: number };
const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

export async function upsertPushToken(subscription: PushSubscription) {
  const db = getAdminDb();
  if (!db) throw new Error("Push storage is not configured. Add Firebase Admin credentials.");
  await db.collection("pushTokens").doc(tokenId(subscription.token)).set({ ...subscription, updatedAt: Date.now() }, { merge: true });
}

export async function listPushTokens() {
  const db = getAdminDb();
  if (!db) return [] as PushSubscription[];
  const snapshot = await db.collection("pushTokens").get();
  return snapshot.docs
    .map((doc) => doc.data() as PushSubscription)
    .filter((item) => Boolean(item.token))
    .map((item) => {
      const prefs = { ...defaultPreferences, ...item.preferences };
      // Legacy tokens predate the `push` preference and were registered without it.
      // The default merge would stamp push:false here and silently disable delivery
      // for devices that never disabled push — drop the merged value so the cron
      // route's `push !== false` check treats them as still deliverable.
      if (typeof item.preferences?.push !== "boolean") {
        const { push: _push, ...rest } = prefs;
        return { ...item, preferences: rest as AlertPreferences };
      }
      return { ...item, preferences: prefs as AlertPreferences };
    });
}

export async function claimDelivery(token: string, eventId: string, reminder: number) {
  const db = getAdminDb();
  if (!db) return false;
  const id = createHash("sha256").update(`${token}:${eventId}:${reminder}`).digest("hex");
  const ref = db.collection("pushDeliveries").doc(id);
  try { await ref.create({ createdAt: Date.now(), tokenId: tokenId(token), eventId, reminder }); return true; } catch { return false; }
}

export async function removePushToken(token: string) {
  const db = getAdminDb();
  if (db) await db.collection("pushTokens").doc(tokenId(token)).delete();
}

export type NotificationHistoryItem = {
  id: string;
  title: string;
  body: string;
  eventType: string;
  eventId: string;
  timestamp: number;
  category: "markets" | "killZones" | "overlaps" | "weekly" | "news";
  sentSuccessfully: boolean;
  read: boolean;
  reminder?: number;
};

export async function saveNotificationHistory(item: NotificationHistoryItem) {
  const db = getAdminDb();
  if (!db) return;
  await db.collection("notificationHistory").doc(item.id).set({ ...item }, { merge: true });
}

/** Atomic create — returns false if this event/reminder notification already exists. */
export async function claimNotificationHistory(item: NotificationHistoryItem): Promise<boolean> {
  const db = getAdminDb();
  if (!db) return false;
  try {
    await db.collection("notificationHistory").doc(item.id).create({ ...item });
    return true;
  } catch {
    return false;
  }
}

/** Deletes every notification history document (used by the panel's “Clear all”). */
export async function clearNotificationHistory(): Promise<number> {
  const db = getAdminDb();
  if (!db) return 0;
  let deleted = 0;
  try {
    // Firestore batches cap at 500 writes, so drain the collection in chunks.
    while (true) {
      const snapshot = await db.collection("notificationHistory").limit(400).get();
      if (snapshot.empty) break;
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      deleted += snapshot.size;
      if (snapshot.size < 400) break;
    }
    return deleted;
  } catch (error) {
    console.error("Failed to clear notification history:", error);
    return deleted;
  }
}

export async function listNotificationHistory(limit = 80): Promise<NotificationHistoryItem[]> {
  const db = getAdminDb();
  if (!db) return [];
  try {
    const snapshot = await db
      .collection("notificationHistory")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    return snapshot.docs.map((doc) => doc.data() as NotificationHistoryItem);
  } catch {
    const snapshot = await db.collection("notificationHistory").limit(limit).get();
    const items = snapshot.docs.map((doc) => doc.data() as NotificationHistoryItem);
    return items.sort((a, b) => b.timestamp - a.timestamp);
  }
}

