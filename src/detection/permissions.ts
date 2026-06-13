/**
 * Real SystemHealth probes (Build Brief §4). Maps device permission/radio state
 * to the HealthProbes the SystemHealth module evaluates. Drives Protection
 * Paused when anything required is missing — fail loud, never silent.
 *
 * Some inputs (activity recognition transitions, full-screen-intent grant,
 * battery-optimization exemption) require native modules/queries not in the
 * Expo JS SDK; those probes return a documented best-effort value until the
 * native config plugin lands. They are wired here so there is ONE place to
 * complete them.
 */
import * as Location from "expo-location";
import type { HealthProbes } from "../health/systemHealth";
import { hasNotificationPermission, hasBatteryExemption } from "../alerts";
import { isNativeDetectionAvailable } from "../../modules/backseat-detection";

export const deviceProbes: HealthProbes = {
  fineLocation: async () => {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === "granted";
  },
  backgroundLocation: async () => {
    const { status } = await Location.getBackgroundPermissionsAsync();
    return status === "granted";
  },
  // Best-effort: the OS ACTIVITY_RECOGNITION grant is not queryable from the
  // Expo JS SDK. The GPS speed heuristic is the working fallback when native
  // Activity Recognition isn't linked, so we don't fail-loud on this alone.
  // TODO(native): expose a grant check from modules/backseat-detection.
  activityRecognition: async () => true,
  // Optional accelerant (not required — GPS+motion trip-end works without it).
  // The ACL-disconnect receiver only exists in the native build, so reflect that
  // honestly: "missing" on a JS-only build, "present" once the module is linked.
  // (The per-device pairing + BLUETOOTH_CONNECT grant are surfaced in Pair My Car.)
  bluetooth: async () => isNativeDetectionAvailable(),
  // Real: Notifee notification-settings authorization (POST_NOTIFICATIONS 13+).
  notifications: hasNotificationPermission,
  // Best-effort: USE_FULL_SCREEN_INTENT has no portable JS query across OS
  // versions. TODO(native): reflect the real grant on Android 14+.
  fullScreenIntent: async () => true,
  // Real: Notifee PowerManager.isIgnoringBatteryOptimizations().
  batteryExemption: hasBatteryExemption,
};

/** Request the location permissions the free-stack spine needs, in order. */
export async function requestLocationPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== "granted") return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.status === "granted";
}
