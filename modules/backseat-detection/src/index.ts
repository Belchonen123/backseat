/**
 * Native-module accessor for BackseatDetection.
 *
 * This file ONLY resolves the native module via expo-modules-core's
 * `requireNativeModule`. The graceful no-op fallback + typed public API lives in
 * the package root `index.ts` (one level up), mirroring the lazy-require pattern
 * used by `src/alerts/index.ts`: if the native module is absent (Expo Go, no
 * prebuild, web, tests) the app must still load.
 */
import { requireNativeModule } from "expo-modules-core";

import type { BackseatDetectionNativeModule } from "./BackseatDetection.types";

// Throws if the native module is not linked. Callers MUST wrap in try/catch.
export default requireNativeModule("BackseatDetection") as BackseatDetectionNativeModule;

export * from "./BackseatDetection.types";
