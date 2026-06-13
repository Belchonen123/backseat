/**
 * BackseatDetection — public JS API for the two native trip-end primitives.
 *
 * The native Kotlin module only exists in a custom dev client / release build
 * (after `expo prebuild` + a native build). In Expo Go, on web, in unit tests,
 * or before a prebuild, `requireNativeModule('BackseatDetection')` throws. To
 * keep the app loading everywhere — exactly like `src/alerts/index.ts` does for
 * Notifee — we lazily resolve the native module in a try/catch and degrade to
 * safe no-ops that log ONCE so the absence is visible but not noisy.
 *
 * SAFETY-OF-LIFE: when these are no-ops, NO native detection happens. The JS
 * speed heuristic in `src/detection/activity.ts` is the only fallback. A real
 * build that silently lands on the no-op path is a FAIL-LOUD bug — surface it
 * via SystemHealth, never treat it as an acceptable degrade.
 *
 * UNVERIFIED: the native side cannot be tested on emulator / Expo Go. Validate
 * on a physical phone across real drives (Build Brief Sprint 0 gate).
 */
import { EventEmitter, type Subscription } from "expo-modules-core";

import type {
  ActivityTransitionEvent,
  BluetoothDisconnectEvent,
  BondedDevice,
  BackseatDetectionNativeModule,
} from "./src/BackseatDetection.types";

export type {
  ActivityTransitionEvent,
  BluetoothDisconnectEvent,
  BondedDevice,
  DetectedActivity,
} from "./src/BackseatDetection.types";

// Log each kind of degrade only once to avoid spamming the console.
let warnedMissing = false;
function warnMissingOnce(reason: unknown): void {
  if (warnedMissing) return;
  warnedMissing = true;
  console.warn(
    "[backseat-detection] native module unavailable — activity + Bluetooth " +
      "detection are NO-OPs (Expo Go / no prebuild?). Reason:",
    reason
  );
}

/**
 * Resolve the native module once. Returns null if it can't be loaded, so every
 * exported function can fall back to a no-op rather than crash the JS bundle.
 */
let resolved: BackseatDetectionNativeModule | null | undefined;
function getNative(): BackseatDetectionNativeModule | null {
  if (resolved !== undefined) return resolved;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("./src/index").default as BackseatDetectionNativeModule;
    resolved = mod;
  } catch (e) {
    warnMissingOnce(e);
    resolved = null;
  }
  return resolved;
}

// A single EventEmitter wrapping the native module powers the listener helpers.
// Created lazily; null when the native module is absent.
let emitter: EventEmitter | null | undefined;
function getEmitter(): EventEmitter | null {
  if (emitter !== undefined) return emitter;
  const native = getNative();
  emitter = native ? new EventEmitter(native as unknown as object) : null;
  return emitter;
}

// --- Activity Recognition --------------------------------------------------

/**
 * Register Google Activity Recognition transition updates for
 * IN_VEHICLE / ON_FOOT / STILL. Resolves once registered; rejects if the
 * native call fails (e.g. ACTIVITY_RECOGNITION permission not granted).
 * No-op (resolves) when the native module is absent.
 */
export async function startActivityUpdates(): Promise<void> {
  const native = getNative();
  if (!native) return;
  await native.startActivityUpdates();
}

/** Stop activity transition updates. No-op when native module is absent. */
export async function stopActivityUpdates(): Promise<void> {
  const native = getNative();
  if (!native) return;
  await native.stopActivityUpdates();
}

/**
 * Subscribe to mapped activity transitions. Returns an unsubscribe function.
 * When the native module is absent this is a no-op and returns a noop remover.
 */
export function addActivityTransitionListener(
  cb: (event: ActivityTransitionEvent) => void
): () => void {
  const e = getEmitter();
  if (!e) return () => {};
  const sub: Subscription = e.addListener<ActivityTransitionEvent>(
    "onActivityTransition",
    cb
  );
  return () => sub.remove();
}

// --- Bluetooth ACL ---------------------------------------------------------

/**
 * Start the ACL-disconnect BroadcastReceiver, optionally filtered to a single
 * device MAC address (the registered car's btDeviceId). No-op when native
 * module is absent.
 */
export function startBluetoothMonitor(deviceId?: string): void {
  const native = getNative();
  if (!native) return;
  native.startBluetoothMonitor(deviceId);
}

/** Tear down the ACL-disconnect receiver. No-op when native module is absent. */
export function stopBluetoothMonitor(): void {
  const native = getNative();
  if (!native) return;
  native.stopBluetoothMonitor();
}

/**
 * Subscribe to Bluetooth ACL disconnects. Returns an unsubscribe function.
 * No-op (returns noop remover) when the native module is absent.
 */
export function addBluetoothDisconnectListener(
  cb: (event: BluetoothDisconnectEvent) => void
): () => void {
  const e = getEmitter();
  if (!e) return () => {};
  const sub: Subscription = e.addListener<BluetoothDisconnectEvent>(
    "onBluetoothDisconnect",
    cb
  );
  return () => sub.remove();
}

/**
 * Enumerate the phone's already-paired (bonded) Bluetooth devices so the user
 * can pick which one is their car. Requires the BLUETOOTH_CONNECT runtime grant
 * on Android 12+; the native side rejects when it is missing or Bluetooth is
 * off. We catch any rejection (and the missing-module case) and return `[]` so
 * the caller never throws — an empty picker is the safe degrade.
 */
export async function getBondedDevices(): Promise<BondedDevice[]> {
  const native = getNative();
  if (!native) return [];
  try {
    return await native.getBondedDevices();
  } catch (e) {
    warnMissingOnce(e);
    return [];
  }
}

/** True only when the real native module is linked (custom dev client build). */
export function isNativeDetectionAvailable(): boolean {
  return getNative() !== null;
}
