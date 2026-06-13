# BackSeat

A phone-based, background "check the back seat" reminder for caregivers (Android-first, Expo + React Native + Convex). **Safety-of-life product — see the non-negotiables in the build brief.** It detects *trip-end*, not a child; it is a reminder aid, never a detection device or guarantee.

## What's built (this scaffold)

End-to-end skeleton with a **live backend** and a **typed front end** wired to it.

### Backend — LIVE on Convex
Deployment `dev:effervescent-rabbit-158` → https://effervescent-rabbit-158.convex.cloud

- `convex/schema.ts` — households, guardians, vehicles, trips, events (Brief §5).
- CRUD + flow mutations/queries: `households`, `guardians`, `vehicles`, `trips`.
- `convex/escalation.ts` — `sendEscalation` action (FCM-first push to secondary
  escalation guardians with the parked maps link; logs `contacts_paged`).
  Set `FCM_SERVER_KEY` in the Convex dashboard to enable real pushes.
- Verified end-to-end with `scripts/smoke.mjs` (creates a household, guardians,
  a full trip with parked maps URL, and the armed→trip_end→all_clear event log).

### Detection core (Brief §3) — pure + unit-tested
- `config/thresholds.ts` — all tunable numbers (arming + escalation timing).
- `src/fsm/machine.ts` — pure `(state, event) -> state` FSM + effects. No I/O.
- `src/fsm/handlers.ts` — side-effect runner (timers, alerts, Convex, escalation).
- `src/detection/engine.ts` — arming rule + trip-end triggers (BT disconnect /
  activity fallback), pure and testable.
- `src/health/systemHealth.ts` — SystemHealth probe → Protection Paused (Brief §4).
- `src/detection/service.ts` — **DetectionService runtime**: ties location →
  activity inference → arming engine → FSM → effects. Driven by real GPS
  (`locationTask.ts`, expo-task-manager background task + drive foreground
  service) or the debug-screen simulator.
- `src/detection/activity.ts` — free-stack speed→activity heuristic (hysteretic;
  no single-fix trip-end) until the native Activity Recognition module lands.
- `src/detection/logger.ts` — structured ring-buffer log (the road-test log).
- `app/debug.tsx` — **Sprint 0 debug screen**: live FSM state + structured log +
  simulate-drive/park/BT/ack buttons.
- `src/detection/permissions.ts` — real expo-location SystemHealth probes.
- `native/README.md` — the two native modules left (Activity Recognition + BT
  ACL receiver) and the Sprint 0 road-test gate.
- **25 unit tests passing** (`npm test`): FSM, arming rule, activity heuristic,
  haversine, and a full drive→trip-end→reminder→alarm→escalation integration test.

### Auth — Clerk ↔ Convex (wired)
- `app/_layout.tsx` wraps the app in `ClerkProvider` + `ConvexProviderWithClerk`
  with a secure token cache (`src/auth/tokenCache.ts`).
- `app/sign-in.tsx` — email-code sign-in/sign-up (Clerk dev default).
- `app/index.tsx` — entry gate: signed-out → sign-in, no household → onboarding.
- `convex/auth.config.ts` trusts the Clerk issuer (deployed; `CLERK_JWT_ISSUER_DOMAIN`
  set on the deployment). `convex/users.ts` exposes `users.me`.
- **Manual step:** in the Clerk dashboard create a **JWT template named `convex`**
  (JWT Templates → New → Convex). This lets the device mint Convex-audience tokens.

### Front end (expo-router, TS strict)
- Theme + reusable components in `src/theme`, `src/components`.
- All screens: Monitor (idle + armed), Reminder, Alarm (hold-to-confirm),
  Protection Paused, Safety Circle, Add/Edit Contact, Onboarding, Test Drive,
  History, Settings.
- **History** and **Safety Circle** are wired to **live Convex queries**
  (`useQuery`), keyed off the active household (`src/state/household.ts`).
- `src/convex/client.ts` + `app/_layout.tsx` provide the `ConvexProvider`.

## Run

```
npm install --legacy-peer-deps
npm test                 # FSM + detection unit tests
npm run typecheck        # tsc --noEmit, strict

# Backend (push functions to the dev deployment)
$env:CONVEX_DEPLOY_KEY = "<dev deploy key>"
npx convex dev --once
node scripts/smoke.mjs   # live backend round-trip

npx expo export --platform android   # JS bundle sanity check (no device needed)

# App — local build onto a connected device / running emulator (needs Android SDK + JDK 17)
npx expo run:android

# App — cloud build via EAS (no Android Studio needed); profiles in eas.json
npm install -g eas-cli && eas login
eas build --profile development --platform android   # installable dev-client APK
eas build --profile preview     --platform android   # standalone test APK
eas build --profile production  --platform android   # Play Store AAB
eas submit  --profile production --platform android   # push AAB to Play (internal track)
```

## Not yet done (next per the brief's sprint plan)
- **Sprint 0 device validation** — prove the trigger across ≥10 real drives.
  The simulator cannot reproduce the automotive→on-foot transition.
- Native wiring: `react-native-background-geolocation` (or the free
  expo-location + Activity Recognition stack), the BT ACL receiver config
  plugin, and **Notifee** for the full-screen-intent DND-override alarm
  (`src/alerts/index.ts` is the integration point; currently a safe stub).
- Clerk auth, FCM token registration on device, the short-lived drive FGS.
