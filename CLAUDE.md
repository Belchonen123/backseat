# BackSeat — working conventions

BackSeat is a **safety-of-life** Android reminder app (Expo/React Native + Convex).
It detects **trip-end, not a child** — never describe it as a detector, guarantee,
or medical/life-safety device. See `README.md` and the build brief for the full spec.

## Definition of done (non-negotiable)

A screen is **not done** until BOTH are true:

1. **Every interactive control either acts or is visibly disabled.** No row,
   button, or toggle may render as tappable while doing nothing. If the real
   handler isn't ready, give the control an explicit disabled state with a
   "Soon" affordance — never a live-looking control with an empty `onPress`.

2. **Any data the screen creates survives a full app kill-and-relaunch** —
   verified by actually killing the process (`adb shell am force-stop …` then
   relaunch), NOT a Metro fast-reload. A warm reload keeps in-memory state and
   will hide persistence bugs. Created data must be written to Convex and read
   back from a query (or persisted to the device store), not held only in
   Zustand/local component state.

## Verification

- Treat "✅ verified" claims skeptically. The emulator mis-targets taps and the
  soft keyboard shifts layouts — confirm each step with a screenshot, and prefer
  a cold-restart check over a happy-path demo.
- Detection is **not "done" until proven on the road** (≥10 real drives). The
  simulator/emulator can't reproduce the automotive→on-foot transition or verify
  the alarm overrides DND/ringer on a locked device.
