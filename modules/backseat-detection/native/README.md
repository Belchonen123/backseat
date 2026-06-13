# backseat-detection (native)

Local Expo native module for BackSeat's trip-end primitives. UNVERIFIED until
built with `expo prebuild` and validated on a physical device — none of this
runs in Expo Go or on the emulator.

## Built (needs prebuild + device verification)

- Activity Recognition transition updates (IN_VEHICLE / ON_FOOT / STILL).
- Bluetooth ACL-disconnect monitor (optional MAC filter).
- getBondedDevices added; needs BLUETOOTH_CONNECT runtime grant (Android 12+) to
  read paired devices; rejects cleanly (JS falls back to `[]`) when the grant is
  missing or Bluetooth is off. UNVERIFIED until prebuild + device.
