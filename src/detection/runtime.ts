/**
 * Device runtime: a single DetectionService wired to real timers, the device
 * alert layer (Notifee stub for now), and an optional Convex sink. The
 * background location task and the debug screen both talk to this singleton.
 */
import { DetectionService } from "./service";
import { getAlertLayer } from "../alerts";
import { detectionLog } from "./logger";
import { useSettingsStore, clampTiming } from "../state/settings";
import {
  addActivityTransitionListener,
  addBluetoothDisconnectListener,
  startActivityUpdates,
  isNativeDetectionAvailable,
} from "../../modules/backseat-detection";

const alerts = getAlertLayer();

/** seconds -> setTimeout (RN timer ids are numbers). */
function setTimer(seconds: number, cb: () => void): number {
  return setTimeout(cb, seconds * 1000) as unknown as number;
}
function clearTimer(id: number): void {
  clearTimeout(id);
}

export const detectionService = new DetectionService({
  setTimer,
  clearTimer,
  fireReminder: () => alerts.fireReminder(),
  fireAlarm: () => alerts.fireAlarm(),
  stopAlarm: () => alerts.stopAlarm(),
  // Backend sync hooks are attached at app start once a household/trip exists.
  onArmed: (s) => detectionLog.log("effect", "armed (sync hook)", { name: s.name }),
  onTripEnd: (s) =>
    detectionLog.log("effect", "trip-end (sync hook)", { parked: s.parked }),
  onAllClear: (o) => {
    detectionLog.log("effect", `all-clear (sync hook): ${o}`);
    // Clears any reminder/alarm notification on either ack path. Idempotent —
    // the ack_alarm path already ran STOP_ALARM; a second call is a no-op.
    alerts.stopAlarm();
  },
  sendEscalation: () => detectionLog.log("effect", "escalation (sync hook)"),
  // Live escalation timing, read from the user's persisted settings at each
  // timer start so an edit in Settings takes effect on the next trip without a
  // rebuild. Clamped to safe bounds defensively.
  getTiming: () => {
    const s = useSettingsStore.getState();
    return {
      reminderToAlarmSeconds: clampTiming("reminderToAlarmSeconds", s.reminderToAlarmSeconds),
      alarmToNotifySeconds: clampTiming("alarmToNotifySeconds", s.alarmToNotifySeconds),
    };
  },
  logger: detectionLog,
});

// Wire the native trip-end primitives into the service. These listeners are
// no-ops when the native module is absent (Expo Go / no prebuild) — see the
// graceful fallback in modules/backseat-detection. When present, real Activity
// Recognition transitions and Bluetooth ACL disconnects drive the same engine
// the GPS heuristic feeds, so detection upgrades transparently.
// UNVERIFIED until run on a real device (Sprint 0 road gate).
addActivityTransitionListener((e) => detectionService.ingestActivity(e.activity, e.at));
addBluetoothDisconnectListener((e) => detectionService.onBluetoothDisconnect(e.at));
detectionLog.log("detection", "native detection module", {
  available: isNativeDetectionAvailable(),
});

// Activity Recognition runs continuously so the app can spot IN_VEHICLE in the
// first place (it's the entry signal for a drive, not just the exit). Cheap,
// broadcast-driven. No-op without the native build. The Bluetooth monitor, by
// contrast, is armed/disarmed per paired-car via useBluetoothMonitor (it needs
// a target device id), so it is NOT started here.
void startActivityUpdates().catch((e) =>
  detectionLog.log("error", "startActivityUpdates failed", { error: String(e) }),
);
