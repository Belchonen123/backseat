import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { thresholds } from "@config/thresholds";

/**
 * User-tunable preferences that must survive a cold start. Persisted to the
 * device secure store (same mechanism as the household pointer) so toggles
 * remember their value instead of silently resetting on relaunch.
 *
 * NOTE: `loudAlarm` is intentionally NOT a kill-switch for the alarm — the
 * escalation alarm always fires (safety-of-life). It governs only whether the
 * pre-escalation reminder also plays an audible chime.
 */
const STORAGE_KEY = "backseat.settings";

export interface Settings {
  /** Audible chime on the first (pre-escalation) reminder. */
  loudReminder: boolean;
  /** Include the parked-location map link when paging the Safety Circle. */
  shareLocationOnEscalation: boolean;
  /** REMINDER -> ALARM grace, in seconds. Defaults to the tuned threshold. */
  reminderToAlarmSeconds: number;
  /** ALARM -> NOTIFY_CONTACTS grace, in seconds. Defaults to the tuned threshold. */
  alarmToNotifySeconds: number;
}

/**
 * Safe bounds for the user-editable escalation timings. These are guardrails on
 * a safety-of-life timer: too short risks false pages, too long delays help.
 * The editor clamps to these; do not let arbitrary values reach the timers.
 */
export const TIMING_BOUNDS = {
  reminderToAlarmSeconds: { min: 15, max: 180 },
  alarmToNotifySeconds: { min: 30, max: 600 },
} as const;

export function clampTiming<K extends keyof typeof TIMING_BOUNDS>(
  key: K,
  value: number,
): number {
  const { min, max } = TIMING_BOUNDS[key];
  if (!Number.isFinite(value)) return DEFAULTS[key];
  return Math.min(max, Math.max(min, Math.round(value)));
}

const DEFAULTS: Settings = {
  loudReminder: true,
  shareLocationOnEscalation: true,
  reminderToAlarmSeconds: thresholds.REMINDER_TO_ALARM_SECONDS,
  alarmToNotifySeconds: thresholds.ALARM_TO_NOTIFY_SECONDS,
};

interface SettingsStore extends Settings {
  hydrated: boolean;
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  hydrate: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULTS,
  hydrated: false,
  set: (key, value) => {
    set({ [key]: value } as Pick<Settings, typeof key>);
    const {
      loudReminder,
      shareLocationOnEscalation,
      reminderToAlarmSeconds,
      alarmToNotifySeconds,
    } = get();
    const snapshot: Settings = {
      loudReminder,
      shareLocationOnEscalation,
      reminderToAlarmSeconds,
      alarmToNotifySeconds,
    };
    void SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(snapshot)).catch(() => {});
  },
  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const raw = await SecureStore.getItemAsync(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        const merged: Settings = { ...DEFAULTS, ...parsed };
        // Defensive: never let a tampered/legacy store push the safety timers
        // out of their guardrails.
        merged.reminderToAlarmSeconds = clampTiming(
          "reminderToAlarmSeconds",
          merged.reminderToAlarmSeconds,
        );
        merged.alarmToNotifySeconds = clampTiming(
          "alarmToNotifySeconds",
          merged.alarmToNotifySeconds,
        );
        set({ ...merged, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch {
      set({ hydrated: true });
    }
  },
}));

void useSettingsStore.getState().hydrate();
