/**
 * Background location task (free-stack spine, Build Brief §2.1). Registers a
 * TaskManager task that receives location batches while the drive is active and
 * feeds each fix into the detection runtime. Speed comes from the OS when
 * available; otherwise the activity heuristic derives it from successive fixes.
 *
 * NOTE: full battery-conscious stop/start GPS gating is the part Transistorsoft
 * sells; here we use a balanced accuracy + a foreground service during drives.
 * Validate battery behavior on a real phone (Sprint 0 gate).
 */
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import { detectionService } from "./runtime";
import type { LocationFix } from "./service";
import { detectionLog } from "./logger";

export const LOCATION_TASK = "backseat-location";

TaskManager.defineTask(LOCATION_TASK, ({ data, error }) => {
  if (error) {
    detectionLog.log("error", "location task error", { error: error.message });
    return;
  }
  const locations = (data as { locations?: Location.LocationObject[] } | undefined)
    ?.locations;
  if (!locations) return;
  for (const loc of locations) {
    const fix: LocationFix = {
      lat: loc.coords.latitude,
      lng: loc.coords.longitude,
      speedMps: Math.max(0, loc.coords.speed ?? 0),
      at: loc.timestamp,
    };
    detectionService.ingestLocation(fix);
  }
});

/** Start background tracking for a drive. Call after permissions are granted. */
export async function startTracking(): Promise<void> {
  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (already) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 5000,
    distanceInterval: 20,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: "BackSeat is monitoring your drive",
      notificationBody: "You'll get a reminder to check the back seat when you park.",
      notificationColor: "#1960a3",
    },
  });
  detectionLog.log("location", "background tracking started");
}

export async function stopTracking(): Promise<void> {
  const started = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK);
  if (started) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
    detectionLog.log("location", "background tracking stopped");
  }
}
