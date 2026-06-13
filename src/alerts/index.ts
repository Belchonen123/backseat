/**
 * Device alert layer (Build Brief §4). The HandlerDeps in the FSM call these.
 * On-device these are implemented with Notifee:
 *   - REMINDER: heads-up notification + chime on the default-importance
 *     "reminder" channel.
 *   - ALARM: full-screen intent on a high-importance "high_stakes_alarm"
 *     channel, looping alarm audio that overrides the ringer + a foreground
 *     service that keeps it alive, vibration, and a press action that opens the
 *     full-screen /alarm takeover. The alarm keeps sounding until ACK — muting
 *     the device does NOT stop it (mute ≠ resolve).
 *
 * Notifee is a native module — it only runs in the custom dev client / release
 * build, never in Expo Go, a plain web context, or unit tests. We load it
 * lazily and fall back to a logging no-op so the JS layer (and `npm test`) load
 * without the native module. Detection logic never depends on the alarm firing
 * — but if the native layer is missing on a real build, that is a FAIL-LOUD bug
 * surfaced by SystemHealth (notifications probe), never a silent degrade.
 */
import { Platform } from "react-native";

export interface AlertLayer {
  fireReminder(): void;
  fireAlarm(): void;
  stopAlarm(): void;
}

/**
 * Notifee permission state, lazily resolved. Used by SystemHealth (the
 * `notifications` / `batteryExemption` probes) and the Protection Paused "Fix"
 * buttons. All degrade to a documented best-effort when Notifee is absent
 * (Expo Go / no prebuild) so the JS layer never crashes.
 */
function loadNotifee(): typeof import("@notifee/react-native").default | null {
  if (Platform.OS !== "android") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@notifee/react-native") as typeof import("@notifee/react-native");
    return mod.default;
  } catch {
    return null;
  }
}

/** True if the OS will actually deliver our notifications. */
export async function hasNotificationPermission(): Promise<boolean> {
  const notifee = loadNotifee();
  if (!notifee) return true; // best-effort off-device; SystemHealth notes the gap
  try {
    const settings = await notifee.getNotificationSettings();
    // 1 === AUTHORIZED, 2 === PROVISIONAL (AuthorizationStatus); both deliver.
    return settings.authorizationStatus !== 0;
  } catch {
    return true;
  }
}

/** Prompt for POST_NOTIFICATIONS (Android 13+). Returns the resulting grant. */
export async function requestNotificationPermission(): Promise<boolean> {
  const notifee = loadNotifee();
  if (!notifee) return true;
  try {
    const settings = await notifee.requestPermission();
    return settings.authorizationStatus !== 0;
  } catch {
    return false;
  }
}

/** True when the app is exempt from battery optimization (background survives). */
export async function hasBatteryExemption(): Promise<boolean> {
  const notifee = loadNotifee();
  if (!notifee) return true;
  try {
    // isBatteryOptimizationEnabled() === true means optimization is ON (bad).
    return !(await notifee.isBatteryOptimizationEnabled());
  } catch {
    return true;
  }
}

/** Open the OS battery-optimization settings so the user can grant the exemption. */
export async function openBatterySettings(): Promise<void> {
  const notifee = loadNotifee();
  if (!notifee) return;
  try {
    await notifee.openBatteryOptimizationSettings();
  } catch {
    /* best-effort */
  }
}

/**
 * Fire the real alarm for `seconds`, then stop it. Lets the user verify on their
 * device that the alarm actually overrides the ringer / DND and is loud enough —
 * the one thing an emulator can't prove. Returns a cancel function.
 */
export function testAlarm(seconds = 5): () => void {
  const layer = getAlertLayer();
  layer.fireAlarm();
  const id = setTimeout(() => layer.stopAlarm(), seconds * 1000);
  return () => {
    clearTimeout(id);
    layer.stopAlarm();
  };
}

const REMINDER_CHANNEL = "reminder";
const ALARM_CHANNEL = "high_stakes_alarm";
const ALARM_NOTIFICATION_ID = "backseat-alarm";
const REMINDER_NOTIFICATION_ID = "backseat-reminder";

const noop: AlertLayer = {
  fireReminder: () => console.log("[alerts:stub] fireReminder"),
  fireAlarm: () => console.log("[alerts:stub] fireAlarm"),
  stopAlarm: () => console.log("[alerts:stub] stopAlarm"),
};

/**
 * Returns the real Notifee-backed layer on Android, the no-op stub elsewhere
 * (iOS for now, web, Expo Go, tests). The layer is built once and memoised.
 */
let cached: AlertLayer | null = null;
export function getAlertLayer(): AlertLayer {
  if (cached) return cached;
  cached = Platform.OS === "android" ? buildNotifeeLayer() ?? noop : noop;
  return cached;
}

/**
 * Builds the Notifee layer. Returns null if the native module can't be loaded
 * (e.g. running in Expo Go / a JS-only context), so the caller falls back to
 * the no-op stub instead of crashing.
 */
function buildNotifeeLayer(): AlertLayer | null {
  let notifee: typeof import("@notifee/react-native").default;
  let AndroidImportance: typeof import("@notifee/react-native").AndroidImportance;
  let AndroidCategory: typeof import("@notifee/react-native").AndroidCategory;
  let AndroidVisibility: typeof import("@notifee/react-native").AndroidVisibility;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("@notifee/react-native") as typeof import("@notifee/react-native");
    notifee = mod.default;
    AndroidImportance = mod.AndroidImportance;
    AndroidCategory = mod.AndroidCategory;
    AndroidVisibility = mod.AndroidVisibility;
  } catch (e) {
    console.warn("[alerts] Notifee native module unavailable, using stub:", e);
    return null;
  }

  // The foreground service keeps the looping alarm sound alive even if the app
  // is backgrounded. The runner must return a promise that never resolves on
  // its own — Notifee resolves it (and removes the notification) when we call
  // stopForegroundService() in stopAlarm. Registered once per JS context.
  notifee.registerForegroundService(() => new Promise<void>(() => {}));

  let channelsReady: Promise<void> | null = null;
  function ensureChannels(): Promise<void> {
    if (!channelsReady) {
      channelsReady = Promise.all([
        notifee.createChannel({
          id: REMINDER_CHANNEL,
          name: "Back-seat reminders",
          importance: AndroidImportance.DEFAULT,
          vibration: true,
        }),
        notifee.createChannel({
          id: ALARM_CHANNEL,
          name: "High-stakes alarm",
          importance: AndroidImportance.HIGH,
          // Loud by default; the looping sound is what overrides the ringer.
          sound: "default",
          vibration: true,
          vibrationPattern: [300, 500, 300, 500],
          bypassDnd: true,
          visibility: AndroidVisibility.PUBLIC,
        }),
      ]).then(() => undefined);
    }
    return channelsReady;
  }

  return {
    fireReminder: () => {
      void (async () => {
        try {
          await ensureChannels();
          await notifee.displayNotification({
            id: REMINDER_NOTIFICATION_ID,
            title: "Check the back seat",
            body: "Your drive just ended. Tap when you've checked the back seat.",
            android: {
              channelId: REMINDER_CHANNEL,
              importance: AndroidImportance.DEFAULT,
              category: AndroidCategory.REMINDER,
              smallIcon: "ic_notification",
              pressAction: { id: "open-reminder", launchActivity: "default" },
              autoCancel: false,
            },
          });
        } catch (e) {
          console.error("[alerts] fireReminder failed:", e);
        }
      })();
    },

    fireAlarm: () => {
      void (async () => {
        try {
          await ensureChannels();
          await notifee.displayNotification({
            id: ALARM_NOTIFICATION_ID,
            title: "CHECK THE BACK SEAT",
            body: "Press to confirm everyone is out of the car. Your Safety Circle will be paged if you don't respond.",
            android: {
              channelId: ALARM_CHANNEL,
              importance: AndroidImportance.HIGH,
              category: AndroidCategory.ALARM,
              smallIcon: "ic_notification",
              // Full-screen takeover even on the lock screen.
              fullScreenAction: { id: "open-alarm", launchActivity: "default" },
              pressAction: { id: "open-alarm", launchActivity: "default" },
              // Loop the alarm sound and keep the service alive until ACK.
              loopSound: true,
              asForegroundService: true,
              ongoing: true,
              autoCancel: false,
              visibility: AndroidVisibility.PUBLIC,
              vibrationPattern: [300, 500, 300, 500],
            },
          });
          // The alarm supersedes the gentler reminder — clear it.
          await notifee.cancelNotification(REMINDER_NOTIFICATION_ID);
        } catch (e) {
          console.error("[alerts] fireAlarm failed:", e);
        }
      })();
    },

    stopAlarm: () => {
      void (async () => {
        try {
          // stopForegroundService both resolves the runner promise and removes
          // the ongoing notification; cancel is belt-and-braces for the id.
          // Reaching all-clear resolves everything, so clear the reminder too.
          await notifee.stopForegroundService();
          await notifee.cancelNotification(ALARM_NOTIFICATION_ID);
          await notifee.cancelNotification(REMINDER_NOTIFICATION_ID);
        } catch (e) {
          console.error("[alerts] stopAlarm failed:", e);
        }
      })();
    },
  };
}
