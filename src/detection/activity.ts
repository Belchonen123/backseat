/**
 * Activity inference for the FREE stack (Build Brief §2.1). The canonical
 * primitive is Android's Activity Recognition Transition API (IN_VEHICLE ->
 * ON_FOOT), wired natively. Until that native module is in place, we derive a
 * usable activity from GPS speed so the trip pipeline can be proven on the road.
 *
 * This is intentionally conservative and HYSTERETIC: entering "vehicle" needs a
 * clearly automotive speed; leaving it needs a sustained slow/stopped reading,
 * so a single noisy fix can't fake a trip-end.
 */
import type { Activity } from "./engine";

/** m/s thresholds. 8 m/s ~= 18 mph (clearly driving), 1.5 m/s ~= walking. */
export const VEHICLE_ENTER_SPEED = 8;
export const VEHICLE_EXIT_SPEED = 1.5;

export interface ActivityMemo {
  current: Activity;
  /** consecutive sub-exit-speed samples while in vehicle. */
  slowStreak: number;
}

export const initialActivityMemo: ActivityMemo = {
  current: "UNKNOWN",
  slowStreak: 0,
};

/** Number of sustained slow fixes before we declare the vehicle stopped. */
export const EXIT_CONFIRM_SAMPLES = 3;

export function inferActivity(
  memo: ActivityMemo,
  speedMps: number,
): { memo: ActivityMemo; activity: Activity } {
  if (memo.current === "IN_VEHICLE") {
    if (speedMps <= VEHICLE_EXIT_SPEED) {
      const slowStreak = memo.slowStreak + 1;
      if (slowStreak >= EXIT_CONFIRM_SAMPLES) {
        return { memo: { current: "ON_FOOT", slowStreak: 0 }, activity: "ON_FOOT" };
      }
      // Still confirming the stop — keep reporting IN_VEHICLE.
      return { memo: { current: "IN_VEHICLE", slowStreak }, activity: "IN_VEHICLE" };
    }
    // Moving again — reset the stop counter.
    return { memo: { current: "IN_VEHICLE", slowStreak: 0 }, activity: "IN_VEHICLE" };
  }

  // Not in a vehicle yet.
  if (speedMps >= VEHICLE_ENTER_SPEED) {
    return { memo: { current: "IN_VEHICLE", slowStreak: 0 }, activity: "IN_VEHICLE" };
  }
  const activity: Activity = speedMps <= VEHICLE_EXIT_SPEED ? "STILL" : "ON_FOOT";
  return { memo: { current: activity, slowStreak: 0 }, activity };
}
