/**
 * Detection engine (Build Brief §3) — decides WHEN to emit DRIVE_CONFIRMED and
 * TRIP_ENDED. This is the "prove the trigger" core (Sprint 0). It is pure given
 * its inputs so the arming rule is unit-testable; the device layer feeds it
 * activity transitions, BT ACL events, and location fixes.
 *
 *  Arming rule: enter DRIVING only after a CONFIRMED drive —
 *    sustained IN_VEHICLE >= DRIVE_CONFIRM_SECONDS  OR  >= DRIVE_CONFIRM_METERS.
 *  Trip-end:
 *    primary  = registered car's BT ACL disconnect (fast, high-confidence)
 *    fallback = IN_VEHICLE -> ON_FOOT/STILL activity transition.
 */
import { thresholds } from "@config/thresholds";

export type Activity = "IN_VEHICLE" | "ON_FOOT" | "STILL" | "UNKNOWN";

export interface DetectionInput {
  activity: Activity;
  /** epoch ms of this sample. */
  at: number;
  /** meters travelled since vehicle motion began (running total). */
  metersSinceVehicle: number;
  /** registered car BT just disconnected this tick. */
  btDisconnected: boolean;
}

export interface DetectionMemo {
  /** epoch ms IN_VEHICLE began, or null. */
  vehicleSince: number | null;
  confirmed: boolean;
}

export type DetectionSignal =
  | { type: "DRIVE_CONFIRMED"; at: number }
  | { type: "TRIP_ENDED"; at: number; reason: "bt_disconnect" | "activity" }
  | null;

export const initialMemo: DetectionMemo = { vehicleSince: null, confirmed: false };

/** Pure step. Returns next memo + any signal to forward to the FSM. */
export function step(
  memo: DetectionMemo,
  input: DetectionInput,
): { memo: DetectionMemo; signal: DetectionSignal } {
  // Trip-end (only meaningful once a drive was confirmed).
  if (memo.confirmed) {
    if (input.btDisconnected) {
      return {
        memo: initialMemo,
        signal: { type: "TRIP_ENDED", at: input.at, reason: "bt_disconnect" },
      };
    }
    if (input.activity === "ON_FOOT" || input.activity === "STILL") {
      return {
        memo: initialMemo,
        signal: { type: "TRIP_ENDED", at: input.at, reason: "activity" },
      };
    }
    return { memo, signal: null };
  }

  // Not yet confirmed — track vehicle motion and apply the arming rule.
  if (input.activity === "IN_VEHICLE") {
    const vehicleSince = memo.vehicleSince ?? input.at;
    const elapsedSec = (input.at - vehicleSince) / 1000;
    const longEnough = elapsedSec >= thresholds.DRIVE_CONFIRM_SECONDS;
    const farEnough = input.metersSinceVehicle >= thresholds.DRIVE_CONFIRM_METERS;
    if (longEnough || farEnough) {
      return {
        memo: { vehicleSince, confirmed: true },
        signal: { type: "DRIVE_CONFIRMED", at: input.at },
      };
    }
    return { memo: { vehicleSince, confirmed: false }, signal: null };
  }

  // Left the vehicle before confirming (parked-but-never-driven, 30s crawl) — reset.
  return { memo: initialMemo, signal: null };
}
