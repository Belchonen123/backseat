/**
 * Bluetooth monitor lifecycle. When the household has a vehicle with a paired
 * Bluetooth device, register the native ACL-disconnect receiver filtered to that
 * device's MAC address; tear it down when the pairing goes away or the screen
 * tree unmounts.
 *
 * We keep the receiver armed for the whole signed-in session (not just during a
 * confirmed drive): a registered broadcast receiver is cheap and battery-neutral
 * — there is no polling — and arming it only mid-drive risks missing the very
 * disconnect that ENDS the drive. The detection engine still ignores a disconnect
 * until a drive is actually confirmed, so an idle disconnect can't fake a trip.
 *
 * No-op when the native module is absent (Expo Go / no prebuild) — see the
 * graceful fallback in modules/backseat-detection. UNVERIFIED until a device run.
 */
import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_api";
import { useActiveHousehold } from "@/state/household";
import {
  startBluetoothMonitor,
  stopBluetoothMonitor,
} from "../../modules/backseat-detection";

export function useBluetoothMonitor(): void {
  const { householdId } = useActiveHousehold();
  const vehicles = useQuery(
    api.vehicles.listByHousehold,
    householdId ? { householdId } : "skip",
  );
  // First vehicle that actually has a paired Bluetooth device wins.
  const btDeviceId = vehicles?.find((v) => v.btDeviceId)?.btDeviceId ?? null;

  useEffect(() => {
    if (!btDeviceId) return;
    startBluetoothMonitor(btDeviceId);
    return () => stopBluetoothMonitor();
  }, [btDeviceId]);
}
