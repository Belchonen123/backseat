/**
 * Shared types for the BackseatDetection native module.
 *
 * The native layer maps Google Activity Recognition's many activity codes down
 * to exactly these three values (WALKING/RUNNING -> ON_FOOT). Keep this union in
 * sync with the JS DetectionService's `Activity` vocabulary.
 */
export type DetectedActivity = "IN_VEHICLE" | "ON_FOOT" | "STILL";

export interface ActivityTransitionEvent {
  activity: DetectedActivity;
  /** Epoch millis at which the native layer observed the transition. */
  at: number;
}

export interface BluetoothDisconnectEvent {
  /** MAC address of the device whose ACL link dropped. */
  address: string;
  /** Epoch millis of the disconnect. */
  at: number;
}

/** A phone-paired (bonded) Bluetooth device the user can pick as their car. */
export interface BondedDevice {
  /** MAC address; stable id used as the car's btDeviceId. */
  id: string;
  /** Human-readable device name, or "Unknown device" when unavailable. */
  name: string;
}

/** Surface exposed by the native module (and mirrored by the no-op fallback). */
export interface BackseatDetectionNativeModule {
  startActivityUpdates(): Promise<void>;
  stopActivityUpdates(): Promise<void>;
  startBluetoothMonitor(deviceId?: string): void;
  stopBluetoothMonitor(): void;
  getBondedDevices(): Promise<BondedDevice[]>;
  addListener(eventName: string, listener: (event: unknown) => void): { remove: () => void };
}
