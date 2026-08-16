"use client";

import { Bell, CheckCheck, Trash2, Volume2, CheckCircle2, Tag, Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getTradingEvents, nextTradingEvents, TradingEvent, TradingEventKind } from "@/lib/tradingSchedule";
import {
  AlertPreferences,
  defaultPreferences,
  preferencesStorageKey,
  readAlertPreferences,
  readStoredAlertPreferences,
  resolvePushPreference,
  writeAlertPreferences
} from "@/lib/notificationPreferences";
import {
  disablePush,
  enablePush,
  getBrowserNotificationPermission,
  getStoredFcmToken,
  listenForForegroundPush,
  restorePushRegistration,
  syncPushPreferences
} from "@/lib/pushClient";
import { isFirebaseConfigured, getFirebaseMessagingServiceWorkerUrl } from "@/lib/firebase";

export type AlertRecord = TradingEvent & {
  createdAt: number;
  read: boolean;
  reminder?: number;
  sentSuccessfully?: boolean;
};

const alertsKey = "ttp-notification-alerts";
const firedKey = "ttp-notification-fired";
const clearedKey = "ttp-notification-cleared";

// Alerts the user deleted stay deleted: “Clear all” records their keys here so the
// server-history merge (which repopulates the panel every 30s) never brings them back.
function clearedAlertKeys(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(clearedKey) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}
function markCleared(keys: string[]) {
  try {
    const next = [...new Set([...clearedAlertKeys(), ...keys])].slice(-400);
    localStorage.setItem(clearedKey, JSON.stringify(next));
  } catch {}
}
type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const read = <T,>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
};

function formatDistance(millis: number) {
  const minutes = Math.max(0, Math.ceil(millis / 60000));
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

type UpcomingAlert = {
  id: string;
  kind: TradingEventKind;
  title: string;
  description: string;
  emoji: string;
  category: AlertRecord["category"];
  eventAt: number;
  triggerAt: number;
  reminder: number;
};

function buildUpcomingAlerts(now: Date, prefs: AlertPreferences): UpcomingAlert[] {
  const horizon = now.getTime() + 24 * 60 * 60_000;
  const items: UpcomingAlert[] = [];
  for (const event of getTradingEvents(now)) {
    if (!prefs[event.category]) continue;
    for (const reminder of prefs.reminders) {
      const triggerAt = event.at.getTime() - reminder * 60_000;
      if (triggerAt <= now.getTime() || triggerAt > horizon) continue;
      const action = event.kind === "market-close" || event.kind === "kill-zone-end" ? "ends" : "starts";
      items.push({
        id: `${event.id}-${reminder}`,
        kind: event.kind,
        title: reminder ? `${event.title} in ${reminder} minute${reminder === 1 ? "" : "s"}` : event.title,
        description: reminder
          ? `${event.title} ${action} in ${reminder} minute${reminder === 1 ? "" : "s"}.`
          : event.description,
        emoji: event.emoji,
        category: event.category,
        eventAt: event.at.getTime(),
        triggerAt,
        reminder
      });
    }
  }
  return items.sort((a, b) => a.triggerAt - b.triggerAt);
}

function play(kind: TradingEventKind) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = kind === "market-close" ? 330 : kind === "weekly-open" ? 660 : 520;
    gain.gain.setValueAtTime(0.045, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.23);
  } catch {
    /* audio is optional */
  }
}

function showDesktopAlert(alert: AlertRecord, tag: string) {
  const options: NotificationOptions = { body: alert.description, icon: "/icons/icon.svg", tag };
  const title = alert.emoji ? `${alert.emoji} ${alert.title}` : alert.title;
  const showFallback = () => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, options);
    }
  };
  if ("serviceWorker" in navigator && "Notification" in window && Notification.permission === "granted") {
    // navigator.serviceWorker.ready never settles when the service worker is
    // missing or failed to activate, which silently killed these popups.
    // Time out and fall back to a plain Notification so the alert still shows.
    const ready = navigator.serviceWorker.ready;
    const timeout = new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Service worker not ready")), 3000));
    Promise.race([ready, timeout])
      .then((registration) => registration.showNotification(title, options))
      .catch(showFallback);
  } else {
    showFallback();
  }
}

function saveAlertToHistoryApi(alert: AlertRecord) {
  fetch("/api/notifications/history", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: `${alert.id}-${alert.reminder ?? 0}`,
      title: alert.title.includes(alert.emoji) ? alert.title : `${alert.emoji} ${alert.title}`,
      body: alert.description,
      eventType: alert.kind,
      eventId: alert.id,
      timestamp: alert.createdAt,
      category: alert.category,
      sentSuccessfully: alert.sentSuccessfully ?? true,
      read: alert.read,
      reminder: alert.reminder
    })
  }).catch(() => undefined);
}

function mergeAlertRecords(local: AlertRecord[], server: AlertRecord[]): AlertRecord[] {
  const cleared = clearedAlertKeys();
  const map = new Map<string, AlertRecord>();
  for (const item of [...server, ...local]) {
    const key = `${item.id}-${item.reminder ?? 0}`;
    if (cleared.has(key)) continue;
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt).slice(0, 80);
}

export function NotificationRuntime({ now, showTopAlert = true }: { now: Date; showTopAlert?: boolean }) {
  useEffect(() => {
    // 1. Service Worker Registration
    if ("serviceWorker" in navigator && isFirebaseConfigured()) {
      navigator.serviceWorker.register(getFirebaseMessagingServiceWorkerUrl(), { scope: "/" }).catch(() => undefined);
    } else if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" }).catch(() => undefined);
    }

    // 2. Application-Level Notification Engine & Push Restoration
    // Runs automatically whenever dashboard loads, independent of Notifications page.
    const { preferences, pushExplicitlySet } = readStoredAlertPreferences();
    const browserPermission = getBrowserNotificationPermission();
    const token = getStoredFcmToken();
    const preferred = resolvePushPreference({
      preferences,
      pushExplicitlySet,
      hasToken: Boolean(token),
      permission: browserPermission
    });

    if (browserPermission === "granted" && !preferences.desktop) {
      const updated = { ...preferences, desktop: true };
      writeAlertPreferences(updated);
    }

    if (preferred && isFirebaseConfigured() && browserPermission === "granted") {
      void restorePushRegistration(preferences).catch(() => undefined);
    }

    // 3. In-Tab Scheduled Event Monitoring
    const run = () => {
      const prefs = readAlertPreferences();
      const fired = new Set(read<string[]>(firedKey, []));
      const current = new Date();
      const alerts = read<AlertRecord[]>(alertsKey, []);
      for (const event of getTradingEvents(current)) {
        if (!prefs[event.category]) continue;
        for (const reminder of prefs.reminders) {
          const trigger = event.at.getTime() - reminder * 60000;
          if (current.getTime() < trigger || current.getTime() - trigger > 300_000) continue;
          const key = `${event.id}-${reminder}`;
          if (fired.has(key)) continue;
          const action = event.kind === "market-close" || event.kind === "kill-zone-end" ? "ends" : "starts";
          const alert: AlertRecord = {
            ...event,
            title: reminder ? `${event.title} in ${reminder} minute${reminder === 1 ? "" : "s"}` : event.title,
            description: reminder
              ? `${event.title} ${action} in ${reminder} minute${reminder === 1 ? "" : "s"}.`
              : event.description,
            createdAt: current.getTime(),
            read: false,
            reminder,
            sentSuccessfully: true
          };
          fired.add(key);
          alerts.unshift(alert);
          if ((prefs.desktop || Notification.permission === "granted") && "Notification" in window && Notification.permission === "granted") {
            showDesktopAlert(alert, key);
          }
          if (prefs.sound) play(event.kind);
          
          saveAlertToHistoryApi(alert);
          window.dispatchEvent(new CustomEvent("trading-alert", { detail: alert }));
        }
      }
      localStorage.setItem(firedKey, JSON.stringify([...fired].slice(-400)));
      localStorage.setItem(alertsKey, JSON.stringify(alerts.slice(0, 80)));
    };
    run();
    const id = window.setInterval(run, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const savePushAlert = (payload: { title?: string; body?: string; data?: Record<string, string> }) => {
      if (!payload.title && !payload.body) return;
      const eventId = payload.data?.eventId;
      const reminder = payload.data?.reminder ? Number(payload.data.reminder) : undefined;
      const tag = eventId ? (reminder !== undefined ? `${eventId}-${reminder}` : eventId) : null;
      const fired = new Set(read<string[]>(firedKey, []));
      // If the in-tab engine already fired this alert (and showed its own popup),
      // record the push but do NOT show a second popup.
      const engineAlreadyDisplayed = tag ? fired.has(tag) : false;
      if (tag) {
        fired.add(tag);
        localStorage.setItem(firedKey, JSON.stringify([...fired].slice(-400)));
      }
      const record: AlertRecord = {
        id: eventId || `push-${Date.now()}`,
        kind: (payload.data?.kind as TradingEventKind) || "economic-news",
        at: new Date(),
        title: payload.title || "SessionX",
        description: payload.body || "",
        emoji: "🔔",
        category: (payload.data?.category as AlertRecord["category"]) || "news",
        createdAt: Date.now(),
        read: false,
        reminder,
        sentSuccessfully: true
      };
      if (clearedAlertKeys().has(`${record.id}-${record.reminder ?? 0}`)) return;
      const alerts = [record, ...read<AlertRecord[]>(alertsKey, [])].slice(0, 80);
      localStorage.setItem(alertsKey, JSON.stringify(alerts));
      saveAlertToHistoryApi(record);
      window.dispatchEvent(new CustomEvent("trading-alert", { detail: record }));
      // A push received while the page is foregrounded must display a system popup,
      // not merely update Recent Notifications. (The in-tab engine covers trigger-time
      // popups; this closes the gap for pushes arriving when the engine is not mounted
      // or missed its scan window. Same tag => the SW replaces, never duplicates.)
      if (!engineAlreadyDisplayed && "Notification" in window && Notification.permission === "granted") {
        showDesktopAlert({ ...record, emoji: "", description: record.description }, tag ?? `push-${Date.now()}`);
      }
    };
    const unsubscribe = listenForForegroundPush(savePushAlert);
    const workerMessage = (event: MessageEvent) => {
      if (event.data?.type === "TRADING_PUSH") savePushAlert(event.data.payload);
    };
    navigator.serviceWorker?.addEventListener("message", workerMessage);
    return () => {
      unsubscribe();
      navigator.serviceWorker?.removeEventListener("message", workerMessage);
    };
  }, []);

  return showTopAlert ? <TopAlertBar now={now} /> : null;
}

function TopAlertBar({ now }: { now: Date }) {
  const next = useMemo(() => nextTradingEvents(now), [now]);
  const primary = next[0];
  if (!primary) return null;
  return (
    <div className="fixed right-4 top-4 z-30 hidden max-w-sm rounded-2xl border border-[#FF8A00]/20 bg-[#0A0A0A]/90 px-4 py-3 shadow-glow backdrop-blur-xl md:block">
      <p className="text-xs font-semibold uppercase tracking-[.16em] text-[#FF9F1C]">
        {primary.emoji} {primary.title}
      </p>
      <p className="mt-1 text-sm text-zinc-300">
        In <span className="digital font-semibold text-white">{formatDistance(primary.at.getTime() - now.getTime())}</span>
      </p>
    </div>
  );
}

function pushStatusCopy(options: {
  configured: boolean;
  permission: NotificationPermission | "unsupported";
  pushPreferred: boolean;
  pushEnabled: boolean;
  hasToken: boolean;
  pushBusy: boolean;
}) {
  const { configured, permission, pushPreferred, pushEnabled, hasToken, pushBusy } = options;
  if (!configured) return "Firebase is not configured yet. The in-tab browser-alert fallback is active.";
  if (permission === "unsupported") return "This browser does not support web push notifications.";
  if (permission === "denied") {
    return "Browser permission is blocked. Allow notifications in your browser site settings — the checkbox alone cannot enable push while permission is denied.";
  }
  if (pushBusy) return "Finishing FCM registration in the background. The page stays usable while this completes.";
  if (pushEnabled && hasToken) return "Receive FCM alerts when the browser or installed app is closed. Preference, browser permission, and FCM registration are active.";
  if (pushPreferred && permission === "granted") return "Push preference is enabled. Restoring your FCM registration…";
  if (pushPreferred && permission === "default") return "Push preference is saved. Grant browser permission to finish enabling background alerts.";
  return "Receive FCM alerts when the browser or installed app is closed.";
}

export function NotificationsPage() {
  const [prefs, setPrefs] = useState<AlertPreferences>(defaultPreferences);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [alerts, setAlerts] = useState<AlertRecord[]>([]);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const { preferences, pushExplicitlySet } = readStoredAlertPreferences();
    const browserPermission = getBrowserNotificationPermission();
    const token = getStoredFcmToken();
    const preferred = resolvePushPreference({
      preferences,
      pushExplicitlySet,
      hasToken: Boolean(token),
      permission: browserPermission
    });

    setPrefs(preferences);
    setPermission(browserPermission);
    setHasToken(Boolean(token));
    setPushEnabled(preferred && browserPermission === "granted" && isFirebaseConfigured());

    // Load persistent history from API and merge with localStorage
    const local = read<AlertRecord[]>(alertsKey, []);
    setAlerts(local);

    const loadHistory = async () => {
      try {
        const res = await fetch("/api/notifications/history", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) {
            const serverAlerts: AlertRecord[] = data.items.map((item: any) => ({
              id: item.eventId || item.id,
              kind: item.eventType || "economic-news",
              at: new Date(item.timestamp),
              title: item.title,
              description: item.body,
              emoji: item.title?.match(/^[\p{Emoji}\u200d]+/u)?.[0] || "🔔",
              category: item.category || "news",
              createdAt: item.timestamp,
              read: Boolean(item.read),
              reminder: item.reminder,
              sentSuccessfully: item.sentSuccessfully ?? true
            }));
            const currentLocal = read<AlertRecord[]>(alertsKey, []);
            const merged = mergeAlertRecords(currentLocal, serverAlerts);
            setAlerts(merged);
            localStorage.setItem(alertsKey, JSON.stringify(merged));
          }
        }
      } catch {}
    };
    void loadHistory();
    const historyPoll = window.setInterval(loadHistory, 30_000);

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<AlertRecord>).detail;
      setAlerts((old) => mergeAlertRecords(old, [detail]));
    };

    const install = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("trading-alert", handler);
    window.addEventListener("beforeinstallprompt", install);

    let cancelled = false;
    const restore = async () => {
      if (!preferred || !isFirebaseConfigured()) return;
      if (browserPermission === "denied") {
        setPushEnabled(false);
        setPushMessage(
          "Browser notification permission is blocked. Open your browser site settings and allow notifications for this site. The Push Notifications checkbox cannot override a denied permission."
        );
        return;
      }
      if (browserPermission !== "granted") {
        setPushEnabled(false);
        setPushMessage("Your push preference is saved. Enable browser permission to finish restoring background alerts.");
        return;
      }

      const needsTokenRefresh = !token;
      if (needsTokenRefresh) setPushBusy(true);
      try {
        const result = await restorePushRegistration({ ...preferences, push: true });
        if (cancelled) return;
        setHasToken(Boolean(result.token));
        setPushEnabled(result.enabled);
        setPermission(getBrowserNotificationPermission());
        if (result.enabled) {
          const next = { ...preferences, push: true };
          setPrefs(next);
          writeAlertPreferences(next);
          if (!pushExplicitlySet) void syncPushPreferences(next);
        } else if (result.message) {
          setPushMessage(result.message);
        }
      } catch (error) {
        if (cancelled) return;
        setPushMessage(error instanceof Error ? error.message : "Unable to restore push notifications.");
      } finally {
        if (!cancelled) setPushBusy(false);
      }
    };
    void restore();

    return () => {
      cancelled = true;
      window.clearInterval(historyPoll);
      window.removeEventListener("trading-alert", handler);
      window.removeEventListener("beforeinstallprompt", install);
    };
  }, []);

  const upcoming = useMemo(() => buildUpcomingAlerts(new Date(nowTick), prefs), [nowTick, prefs]);
  // Recompute every render (not memoized) so cleared reminders disappear immediately.
  const visibleUpcoming = upcoming.filter((item) => !clearedAlertKeys().has(item.id));

  const save = (next: AlertPreferences) => {
    setPrefs(next);
    writeAlertPreferences(next);
    if (next.push && getStoredFcmToken()) void syncPushPreferences(next);
  };

  const setDesktop = async (value: boolean) => {
    if (!value) return save({ ...prefs, desktop: false });
    if (!("Notification" in window)) return setPermission("unsupported");
    if (Notification.permission === "denied") {
      setPermission("denied");
      setPushMessage("Desktop notifications are blocked in your browser settings.");
      return;
    }
    const result = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    setPermission(result);
    save({ ...prefs, desktop: result === "granted" });
  };

  const clear = async () => {
    // Tombstone every alert key — delivered ones on screen, everything still in
    // server history, AND the upcoming reminder rows (they regenerate from the
    // schedule, so they need tombstoning + marking-fired to stay gone).
    const keys = alerts.map((alert) => `${alert.id}-${alert.reminder ?? 0}`);
    const upcomingKeys = visibleUpcoming.map((item) => item.id);
    keys.push(...upcomingKeys);
    try {
      const res = await fetch("/api/notifications/history", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items)) {
          for (const item of data.items) {
            keys.push(`${item.eventId || item.id}-${item.reminder ?? 0}`);
          }
        }
      }
    } catch {}
    markCleared(keys);
    // Mark cleared reminders as fired so the in-tab engine can't re-deliver them.
    if (upcomingKeys.length) {
      try {
        const fired = new Set(read<string[]>(firedKey, []));
        upcomingKeys.forEach((key) => fired.add(key));
        localStorage.setItem(firedKey, JSON.stringify([...fired].slice(-400)));
      } catch {}
    }
    localStorage.removeItem(alertsKey);
    setAlerts([]);
    // Permanently delete the history from Firestore so it can't come back on any device.
    fetch("/api/notifications/history", { method: "DELETE" }).catch(() => undefined);
  };

  const markRead = () => {
    const updated = alerts.map((item) => ({ ...item, read: true }));
    setAlerts(updated);
    localStorage.setItem(alertsKey, JSON.stringify(updated));
  };

  const togglePush = async (value: boolean) => {
    setPushMessage("");
    setPushBusy(true);
    try {
      if (value) {
        if (getBrowserNotificationPermission() === "denied") {
          setPushEnabled(false);
          setPushMessage(
            "Browser notification permission is blocked. Open your browser site settings and allow notifications for this site. Checking this box cannot enable push while permission is denied."
          );
          return;
        }
        await enablePush(prefs);
        const next = { ...prefs, push: true, desktop: true };
        setPushEnabled(true);
        setHasToken(Boolean(getStoredFcmToken()));
        setPermission("granted");
        save(next);
        setPushMessage("Background push notifications are enabled.");
      } else {
        await disablePush();
        const next = { ...prefs, push: false };
        setPushEnabled(false);
        setHasToken(false);
        save(next);
        setPushMessage("Push notifications have been disabled.");
      }
    } catch (error) {
      setPushEnabled(false);
      setHasToken(Boolean(getStoredFcmToken()));
      setPermission(getBrowserNotificationPermission());
      setPushMessage(error instanceof Error ? error.message : "Unable to update push notifications.");
    } finally {
      setPushBusy(false);
    }
  };

  const installApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };

  const testNotification = () => {
    const alert: AlertRecord = {
      id: `test-${Date.now()}`,
      kind: "economic-news",
      at: new Date(),
      title: "Test Notification",
      description: "Your SessionX notification settings are working.",
      emoji: "🧪",
      category: "news",
      createdAt: Date.now(),
      read: false,
      sentSuccessfully: true
    };
    const updated = mergeAlertRecords(alerts, [alert]);
    setAlerts(updated);
    localStorage.setItem(alertsKey, JSON.stringify(updated));
    saveAlertToHistoryApi(alert);
    window.dispatchEvent(new CustomEvent("trading-alert", { detail: alert }));
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("🧪 SessionX", { body: alert.description, icon: "/icons/icon.svg" });
    } else {
      setPushMessage("Test added to Recent Notifications. Turn on Desktop notifications to receive a browser popup.");
    }
  };

  const statusText = pushStatusCopy({
    configured: isFirebaseConfigured(),
    permission,
    pushPreferred: prefs.push,
    pushEnabled,
    hasToken,
    pushBusy
  });
  const messageClass = permission === "denied" || pushMessage.toLowerCase().includes("blocked") ? "text-red-300" : "text-[#FF9F1C]";

  const rows: [keyof AlertPreferences, string, string][] = [
    ["markets", "Market opens & closes", "Sydney, Tokyo, London and New York"],
    ["killZones", "ICT Kill Zones", "Start, end and advance reminders"],
    ["overlaps", "Session overlaps", "High-liquidity overlap starts"],
    ["weekly", "Weekly Candle Open", "New FX trading week"],
    ["news", "Economic News", "Placeholder for a future calendar feed"]
  ];

  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-12 lg:px-10">
      <div className="mb-8">
        <p className="text-sm font-medium uppercase tracking-[.24em] text-[#FF8A00]/80">SessionX</p>
        <h1 className="mt-3 text-3xl font-semibold text-white md:text-5xl">Notifications</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
          Professional timing alerts, calculated from live market schedules in their local timezones.
        </p>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.05fr_.95fr]">
        <div className="space-y-5">
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between gap-5">
              <div>
                <h2 className="text-xl font-semibold text-white">Enable Push Notifications</h2>
                <p className="mt-1 text-sm text-zinc-400">{statusText}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  Preference: {prefs.push ? "enabled" : "disabled"} · Browser: {permission} · FCM token:{" "}
                  {hasToken ? "registered" : "none"}
                </p>
              </div>
              <input
                aria-label="Enable push notifications"
                type="checkbox"
                checked={pushEnabled}
                disabled={pushBusy || permission === "unsupported" || !isFirebaseConfigured()}
                onChange={(e) => togglePush(e.target.checked)}
                className="h-5 w-5 accent-[#FF8A00] disabled:opacity-40"
              />
            </div>
            {pushMessage && <p className={`mt-3 text-sm ${messageClass}`}>{pushMessage}</p>}
          </div>
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between gap-5">
              <div>
                <h2 className="text-xl font-semibold text-white">Desktop notifications</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {permission === "denied"
                    ? "Blocked by your browser — change permission in browser settings."
                    : permission === "unsupported"
                      ? "Browser notifications are not supported here."
                      : "Turn this on to enable in-tab alerts and request browser permission."}
                </p>
              </div>
              <input
                aria-label="Desktop notifications"
                type="checkbox"
                checked={prefs.desktop}
                disabled={permission === "denied" || permission === "unsupported"}
                onChange={(e) => setDesktop(e.target.checked)}
                className="h-5 w-5 accent-[#FF8A00]"
              />
            </div>
          </div>
          <div className="glass rounded-3xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">App & testing</h2>
                <p className="mt-1 text-sm text-zinc-400">Install SessionX for a standalone experience.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={installApp}
                  disabled={!installPrompt}
                  className="rounded-xl border border-[#FF8A00]/25 bg-[#FF8A00]/10 px-3 py-2 text-sm text-[#FFB45A] disabled:opacity-40"
                >
                  Install App
                </button>
                <button onClick={testNotification} className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-200">
                  Test
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem(preferencesStorageKey);
                    save(defaultPreferences);
                  }}
                  className="rounded-xl border border-white/10 px-3 py-2 text-sm text-zinc-200"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
          <div className="glass rounded-3xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Sound alerts</h2>
                <p className="mt-1 text-sm text-zinc-400">A distinct tone accompanies each event category.</p>
              </div>
              <Volume2 className="h-5 w-5 text-[#FF9F1C]" />
              <input
                aria-label="Sound alerts"
                type="checkbox"
                checked={prefs.sound}
                onChange={(e) => save({ ...prefs, sound: e.target.checked })}
                className="h-5 w-5 accent-[#FF8A00]"
              />
            </div>
          </div>
          <div className="glass rounded-3xl p-6">
            <h2 className="text-xl font-semibold text-white">Alert types</h2>
            <div className="mt-4 space-y-2">
              {rows.map(([key, label, description]) => (
                <label key={key} className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[.035] p-4">
                  <span>
                    <span className="block font-medium text-white">{label}</span>
                    <span className="mt-1 block text-xs text-zinc-500">{description}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(prefs[key])}
                    onChange={(e) => save({ ...prefs, [key]: e.target.checked })}
                    className="h-5 w-5 accent-[#FF8A00]"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="glass rounded-3xl p-6">
            <h2 className="text-xl font-semibold text-white">Reminder timing</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[10, 5, 1, 0].map((minutes) => (
                <label key={minutes} className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[.035] p-4 text-sm text-zinc-200">
                  <input
                    type="checkbox"
                    checked={prefs.reminders.includes(minutes)}
                    onChange={(e) =>
                      save({
                        ...prefs,
                        reminders: e.target.checked
                          ? [...prefs.reminders, minutes].sort((a, b) => b - a)
                          : prefs.reminders.filter((value) => value !== minutes)
                      })
                    }
                    className="h-4 w-4 accent-[#FF8A00]"
                  />
                  {minutes ? `${minutes} minutes before` : "At event time"}
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="glass h-fit rounded-3xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#FF9F1C]" />
              <p className="text-sm text-[#8A8A8A]">{alerts.filter((alert) => !alert.read).length} unread · {visibleUpcoming.length} upcoming</p>
            </div>
            <div className="flex gap-2">
              <button onClick={markRead} title="Mark all read" className="rounded-xl border border-[#222222] p-2 text-[#8A8A8A] hover:text-[#F5F5F5]">
                <CheckCheck className="h-4 w-4" />
              </button>
              <button onClick={clear} className="rounded-xl border border-[#222222] p-2 text-[#8A8A8A] hover:text-[#F5F5F5]" title="Clear all">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-5 max-h-[560px] space-y-3 overflow-y-auto">
            {visibleUpcoming.map((item) => (
              <div key={item.id} className="rounded-2xl border border-[#FF8A00]/20 bg-[#111111] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[#F5F5F5]">
                      {item.emoji} {item.title}
                    </p>
                    <p className="mt-1 text-sm text-[#8A8A8A]">{item.description}</p>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#FF8A00]/25 bg-[#FF8A00]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#FF9F1C]">
                    in {formatDistance(item.triggerAt - nowTick)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#8A8A8A]">
                  <span className="rounded-md border border-[#222222] bg-[#0A0A0A] px-2 py-0.5">Category: {item.category}</span>
                  <span className="rounded-md border border-[#222222] bg-[#0A0A0A] px-2 py-0.5">Type: {item.kind}</span>
                  <span className="rounded-md border border-[#222222] bg-[#0A0A0A] px-2 py-0.5">
                    Event {new Date(item.eventAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}
                  </span>
                </div>
              </div>
            ))}
            {alerts.map((alert) => (
              <div
                key={`${alert.id}-${alert.createdAt}-${alert.reminder ?? 0}`}
                className={`rounded-2xl border p-4 ${alert.read ? "border-[#222222] bg-[#0A0A0A]" : "border-[#FF8A00]/20 bg-[#FF8A00]/[.07]"}`}
              >
                <div className="flex justify-between items-start gap-3">
                  <p className="font-medium text-[#F5F5F5] text-base">
                    {alert.emoji} {alert.title}
                  </p>
                  <time className="digital shrink-0 text-xs text-[#8A8A8A] flex items-center gap-1">
                    <Clock className="h-3 w-3 text-[#FF8A00]" />
                    {new Date(alert.createdAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: true
                    })}
                  </time>
                </div>
                <p className="mt-2 text-sm leading-5 text-[#8A8A8A]">{alert.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#222222] pt-2 text-xs text-[#8A8A8A]">
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#FF8A00]/20 bg-[#FF8A00]/10 px-2 py-0.5 text-[#FF9F1C]">
                    <Tag className="h-3 w-3" />
                    Category: {alert.category}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#222222] bg-[#0A0A0A] px-2 py-0.5 text-[#F5F5F5]/80">
                    Type: {alert.kind}
                  </span>
                  {alert.reminder !== undefined ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-[#222222] bg-[#0A0A0A] px-2 py-0.5">
                      Offset: {alert.reminder === 0 ? "at event" : `${alert.reminder}m before`}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 rounded-md border border-[#FF8A00]/30 bg-[#FF8A00]/10 px-2 py-0.5 text-[#FF9F1C]">
                    <CheckCircle2 className="h-3 w-3" />
                    Sent Successfully
                  </span>
                </div>
              </div>
            ))}
            {visibleUpcoming.length === 0 && alerts.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-[#222222] p-6 text-center text-sm text-[#8A8A8A]">
                No notifications yet. Upcoming alerts will appear here when their reminder time is reached.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
