"use client";

import { CheckCircle2, Circle, Cloud, Info } from "lucide-react";
import { useEffect, useState } from "react";
import { getFirebaseConfigurationStatus, isFirebaseConfigured } from "@/lib/firebase";
import { readStoredAlertPreferences, resolvePushPreference } from "@/lib/notificationPreferences";
import { getBrowserNotificationPermission, getStoredFcmToken } from "@/lib/pushClient";

export function NotificationOnboarding() {
  const configured = isFirebaseConfigured();
  const configuration = getFirebaseConfigurationStatus();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [pushPreferred, setPushPreferred] = useState(false);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const browserPermission = getBrowserNotificationPermission();
      const token = getStoredFcmToken();
      const { preferences, pushExplicitlySet } = readStoredAlertPreferences();
      setPermission(browserPermission);
      setHasToken(Boolean(token));
      setPushPreferred(
        resolvePushPreference({
          preferences,
          pushExplicitlySet,
          hasToken: Boolean(token),
          permission: browserPermission
        })
      );
    };
    refresh();
    const id = window.setInterval(refresh, 1000);
    return () => window.clearInterval(id);
  }, []);

  const active = configured && permission === "granted" && pushPreferred && hasToken;
  const development = process.env.NODE_ENV !== "production";

  if (!configured) {
    return (
      <article className="glass mb-5 rounded-3xl border-[#FF8A00]/15 p-6">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#FF8A00]" />
          <div>
            <p className="text-xs uppercase tracking-[.18em] text-[#FF9F1C]/80">Firebase Runtime Diagnostics</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Firebase variables were not loaded into this Next.js runtime</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
              FCM and local browser-alert fallback use different paths. Browser alerts remain available; FCM cannot initialize until the listed public values are available to the running application.
            </p>
          </div>
        </div>
        <p className="mt-5 text-sm text-zinc-300">Missing public variables:</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {configuration.missing.map((name) => (
            <code key={name} className="rounded-lg border border-white/10 bg-black/25 px-2 py-1 text-xs text-[#FFB45A]">
              {name}
            </code>
          ))}
        </div>
        <p className="mt-5 flex items-center gap-2 text-sm text-zinc-400">
          <Circle className="h-3 w-3 fill-zinc-500 text-zinc-500" />
          Firebase Configuration Missing in the current runtime.
        </p>
        {development ? (
          <div className="mt-5 rounded-2xl border border-white/8 bg-black/20 p-4 text-xs leading-6 text-zinc-400">
            <p className="font-semibold uppercase tracking-[.14em] text-[#FF9F1C]">Development Mode</p>
            <p>Firebase: Not Loaded</p>
            <p>FCM: Disabled</p>
            <p>Browser Alerts: Active</p>
          </div>
        ) : null}
      </article>
    );
  }

  if (permission === "denied") {
    return (
      <article className="glass mb-5 rounded-3xl border-[#FF8A00]/20 p-6">
        <div className="flex items-start gap-3">
          <Cloud className="mt-0.5 h-5 w-5 text-[#FF8A00]" />
          <div>
            <p className="text-xs uppercase tracking-[.18em] text-[#FF9F1C]/80">Browser Permission Denied</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Allow notifications in browser settings</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Push cannot be enabled from the checkbox while browser permission is blocked. Open your browser site settings, allow notifications for SessionX, then return here.
            </p>
          </div>
        </div>
      </article>
    );
  }

  if (!active) {
    return (
      <article className="glass mb-5 rounded-3xl border-[#FF8A00]/20 p-6">
        <div className="flex items-start gap-3">
          <Cloud className="mt-0.5 h-5 w-5 text-[#FF8A00]" />
          <div>
            <p className="text-xs uppercase tracking-[.18em] text-[#FF9F1C]/80">Firebase Connected</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {permission === "granted" ? (pushPreferred ? "Restoring push subscription" : "Push subscription required") : "Browser Permission Required"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              {permission === "granted"
                ? pushPreferred
                  ? "Your saved push preference is enabled. FCM registration is being restored."
                  : "Enable push notifications below to register this browser for market alerts."
                : "Click Enable Push Notifications to receive market alerts."}
            </p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="glass mb-5 rounded-3xl border-[#FF8A00]/25 p-6">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#FF8A00]" />
        <div>
          <p className="text-xs uppercase tracking-[.18em] text-[#FF9F1C]/80">Notifications Active</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">Push notifications are ready</h2>
          <p className="mt-2 text-sm text-zinc-400">
            You will receive alerts for Market Opens, Market Closes, ICT Kill Zones, Weekly Candle Opens, and custom reminders.
          </p>
        </div>
      </div>
    </article>
  );
}
