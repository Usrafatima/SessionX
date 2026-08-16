export type AlertPreferences = {
  markets: boolean;
  killZones: boolean;
  overlaps: boolean;
  weekly: boolean;
  news: boolean;
  sound: boolean;
  desktop: boolean;
  /** User preference for background FCM push — distinct from browser permission and FCM token status. */
  push: boolean;
  reminders: number[];
};

export const preferencesStorageKey = "ttp-notification-preferences";

export const defaultPreferences: AlertPreferences = {
  markets: true,
  killZones: true,
  overlaps: true,
  weekly: true,
  news: false,
  sound: true,
  desktop: false,
  push: false,
  reminders: [10, 5, 1, 0]
};

export type StoredPreferencesRead = {
  preferences: AlertPreferences;
  /** True when the stored JSON included an explicit `push` boolean (user enabled or disabled). */
  pushExplicitlySet: boolean;
};

export function readStoredAlertPreferences(): StoredPreferencesRead {
  if (typeof window === "undefined") {
    return { preferences: { ...defaultPreferences }, pushExplicitlySet: false };
  }
  try {
    const raw = JSON.parse(localStorage.getItem(preferencesStorageKey) ?? "") as Partial<AlertPreferences>;
    return {
      preferences: {
        ...defaultPreferences,
        ...raw,
        reminders: Array.isArray(raw.reminders) ? raw.reminders : defaultPreferences.reminders
      },
      pushExplicitlySet: typeof raw.push === "boolean"
    };
  } catch {
    return { preferences: { ...defaultPreferences }, pushExplicitlySet: false };
  }
}

export function readAlertPreferences(): AlertPreferences {
  return readStoredAlertPreferences().preferences;
}

export function writeAlertPreferences(preferences: AlertPreferences) {
  localStorage.setItem(preferencesStorageKey, JSON.stringify(preferences));
}

/**
 * Resolve whether push should appear enabled.
 * Explicit disable always wins. Legacy installs without `push` fall back to an existing FCM token.
 */
export function resolvePushPreference(options: {
  preferences: AlertPreferences;
  pushExplicitlySet: boolean;
  hasToken: boolean;
  permission: NotificationPermission | "unsupported";
}): boolean {
  const { preferences, pushExplicitlySet, hasToken, permission } = options;
  if (pushExplicitlySet) return preferences.push;
  return hasToken && permission === "granted";
}
