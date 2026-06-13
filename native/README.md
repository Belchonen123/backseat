# Native modules to finish the free-stack detection spine

The JS detection loop is complete and proven in simulation (`src/detection/*`,
25 passing unit tests). Two device primitives still need native code + a custom
dev-client rebuild. Both feed the existing `DetectionService` — no JS redesign.

## 1. Activity Recognition Transition API  (the canonical IN_VEHICLE → ON_FOOT)
- Add Play Services `com.google.android.gms:play-services-location`.
- Register transitions for `IN_VEHICLE`/`ON_FOOT`/`STILL` (enter+exit) via
  `ActivityRecognitionClient.requestActivityTransitionUpdates`.
- On each transition, call into JS and replace the speed heuristic in
  `src/detection/activity.ts` by feeding the real `Activity` straight into
  `DetectionService.feedEngine` (expose a `ingestActivity(activity, at)` method).
- Permission: `ACTIVITY_RECOGNITION` (already declared in `app.json`).

## 2. Bluetooth ACL disconnect receiver  (the fast, high-confidence trip-end)
- Register a `BroadcastReceiver` for `BluetoothDevice.ACTION_ACL_DISCONNECTED`
  **only during a confirmed drive** (start it with the short-lived foreground
  service, tear it down at trip end — Build Brief §4).
- Filter to the registered car's `btDeviceId` (from the `vehicles` table).
- On match, call `DetectionService.onBluetoothDisconnect(at)` — already wired.
- Permission: `BLUETOOTH_CONNECT` (already declared).

## 3. Notifee alarm layer  (replace the stub in `src/alerts/index.ts`)
- DND-override high-importance channel `high_stakes_alarm`, full-screen intent,
  looping alarm-stream audio + haptics until ack. Declare the Android 14 alarm
  category and justify `USE_FULL_SCREEN_INTENT`.

## Packaging
Wrap 1 & 2 as an Expo **config plugin** (`app.config.ts` `plugins: [...]`) so the
manifest entries + receiver are added on `expo prebuild`. Build a new custom dev
client (`eas build --profile development`) — these cannot run in Expo Go.

## Sprint 0 gate (Build Brief §8)
Validate on a **physical Android phone** across ≥10 real drives over ≥3 days
(pocket, cupholder, seat; short + long): `TRIP_ENDED` fires within seconds of
parking, **zero misses**, acceptable false-positive rate. Watch the **Debug
screen** (`app/debug.tsx`) live; tune the numbers in `config/thresholds.ts` and
`src/detection/activity.ts`. Until this passes, nothing else matters.

## Built (needs prebuild + device verification)

A local Expo native module **`BackseatDetection`** now implements primitives 1
and 2 above (Activity Recognition transitions + Bluetooth ACL disconnect). It is
**UNVERIFIED** — native code here CANNOT run in Expo Go or on the emulator (no
real automotive transition, no paired car Bluetooth). It must be built with a
prebuild and validated on a physical phone across real drives (Sprint 0 gate).

### Files created

- `modules/backseat-detection/expo-module.config.json` — registers the Kotlin module.
- `modules/backseat-detection/android/build.gradle` — module build; adds
  `com.google.android.gms:play-services-location`.
- `modules/backseat-detection/android/src/main/java/com/backseat/detection/BackseatDetectionModule.kt`
  — the module: AR transition registration + dynamic ACL-disconnect receiver,
  emits `onActivityTransition` / `onBluetoothDisconnect`.
- `.../ActivityTransitionReceiver.kt` — manifest receiver for the AR PendingIntent.
- `.../BackseatDetectionModuleHolder.kt` — weak bridge from receiver to live module.
- `modules/backseat-detection/src/BackseatDetection.types.ts` — shared TS types.
- `modules/backseat-detection/src/index.ts` — `requireNativeModule` accessor.
- `modules/backseat-detection/index.ts` — public JS API with no-op fallback.
- `plugins/withBackseatDetection.js` — config plugin: declares the AR receiver
  in AndroidManifest.

### Activity mapping (honest)

`IN_VEHICLE -> IN_VEHICLE`, `ON_FOOT / WALKING / RUNNING -> ON_FOOT`,
`STILL -> STILL`. All other Google AR activities are ignored.

### app.json plugins line to add

Append to the `expo.plugins` array:

```json
"./plugins/withBackseatDetection"
```

### Integration commands

```sh
# 1. Link the local module + regenerate android/ with the receiver + permissions
npx expo prebuild -p android

# 2. (autolinking picks up modules/backseat-detection automatically)
#    play-services-location is declared in the module's android/build.gradle.

# 3. Build + run a custom dev client on a PHYSICAL device (not emulator)
npx expo run:android --device
#    or: eas build --profile development
```

### JS API to call from service.ts

```ts
import {
  startActivityUpdates,        // () => Promise<void>
  stopActivityUpdates,         // () => Promise<void>
  startBluetoothMonitor,       // (deviceId?: string) => void
  stopBluetoothMonitor,        // () => void
  addActivityTransitionListener,   // (cb: (e: { activity, at }) => void) => () => void
  addBluetoothDisconnectListener,  // (cb: (e: { address, at }) => void) => () => void
  isNativeDetectionAvailable,  // () => boolean
} from "../../modules/backseat-detection";
```

Wire `addActivityTransitionListener` -> `service.ingestActivity(activity, at)`
and `addBluetoothDisconnectListener` -> `service.onBluetoothDisconnect(at)`.

### Honest status

UNVERIFIED. Not compiled, not prebuilt, not run. Treat every line as a draft
until proven on the road per the Sprint 0 gate above.
