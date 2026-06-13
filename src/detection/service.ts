/**
 * DetectionService — the live runtime that wires the whole detection loop:
 *
 *   location fix -> activity inference -> arming engine (engine.step)
 *                -> FSM (transition) -> effects (runEffects: timers/alerts/sync)
 *
 * Pure logic (engine, machine, activity) stays in its own modules; this class
 * owns the mutable session state and feeds them. Built with injected deps so it
 * can be unit-tested off-device (see service.test.ts) and driven by either real
 * GPS/BT on the phone or the debug screen's simulator.
 */
import {
  transition,
  initialState,
  type FsmState,
  type FsmEvent,
  type ParkedLocation,
} from "../fsm/machine";
import {
  runEffects,
  makeTimerBag,
  type HandlerDeps,
  type TimerBag,
} from "../fsm/handlers";
import { step, initialMemo, type DetectionMemo, type Activity } from "./engine";
import { inferActivity, initialActivityMemo, type ActivityMemo } from "./activity";
import { haversineMeters } from "./geo";
import { detectionLog, type DetectionLogger } from "./logger";

export interface LocationFix {
  lat: number;
  lng: number;
  /** meters/second; if the platform doesn't supply it, derive from successive fixes. */
  speedMps: number;
  at: number;
}

export interface ServiceDeps {
  setTimer: (seconds: number, cb: () => void) => number;
  clearTimer: (id: number) => void;
  fireReminder: () => void;
  fireAlarm: () => void;
  stopAlarm: () => void;
  /** Backend sync hooks (no-ops are fine for Sprint 0 trigger-proving). */
  onArmed?: (state: FsmState) => void;
  onTripEnd?: (state: FsmState) => void;
  onAllClear?: (outcome: "ack_reminder" | "ack_alarm", state: FsmState) => void;
  sendEscalation?: (state: FsmState) => void;
  /** Live escalation timing (seconds). Falls back to config thresholds if absent. */
  getTiming?: () => { reminderToAlarmSeconds: number; alarmToNotifySeconds: number };
  logger?: DetectionLogger;
}

export class DetectionService {
  private fsm: FsmState = { ...initialState };
  private detection: DetectionMemo = { ...initialMemo };
  private activity: ActivityMemo = { ...initialActivityMemo };
  private timers: TimerBag = makeTimerBag();
  private lastPoint: { lat: number; lng: number } | null = null;
  private metersSinceVehicle = 0;
  private readonly handlerDeps: HandlerDeps;
  private readonly log: DetectionLogger;
  private subscribers = new Set<(s: FsmState) => void>();

  constructor(private readonly deps: ServiceDeps) {
    this.log = deps.logger ?? detectionLog;
    this.handlerDeps = {
      setTimer: deps.setTimer,
      clearTimer: deps.clearTimer,
      fireReminder: deps.fireReminder,
      fireAlarm: deps.fireAlarm,
      stopAlarm: deps.stopAlarm,
      onArmed: (s) => deps.onArmed?.(s),
      onTripEnd: (s) => deps.onTripEnd?.(s),
      onAllClear: (o, s) => deps.onAllClear?.(o, s),
      sendEscalation: (s) => deps.sendEscalation?.(s),
      emitReminderTimeout: () => this.dispatch({ type: "REMINDER_TIMEOUT", at: Date.now() }),
      emitAlarmTimeout: () => this.dispatch({ type: "ALARM_TIMEOUT", at: Date.now() }),
      getTiming: deps.getTiming,
      log: (msg, data) => this.log.log("effect", msg, data),
    };
  }

  getState(): FsmState {
    return this.fsm;
  }

  subscribe(fn: (s: FsmState) => void): () => void {
    this.subscribers.add(fn);
    fn(this.fsm);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  /** Feed one GPS fix. Drives activity inference + the arming engine. */
  ingestLocation(fix: LocationFix): void {
    const prevActivity = this.activity.current;
    const { memo: activityMemo, activity } = inferActivity(this.activity, fix.speedMps);
    this.activity = activityMemo;

    // Accumulate distance once vehicle motion has begun.
    if (activity === "IN_VEHICLE") {
      if (prevActivity !== "IN_VEHICLE") {
        this.metersSinceVehicle = 0; // motion just started
      } else if (this.lastPoint) {
        this.metersSinceVehicle += haversineMeters(this.lastPoint, fix);
      }
    }
    this.lastPoint = { lat: fix.lat, lng: fix.lng };

    if (activity !== prevActivity) {
      this.log.log("activity", `activity ${prevActivity} -> ${activity}`, {
        speedMps: fix.speedMps,
      });
    }
    this.log.log("location", "fix", {
      lat: fix.lat,
      lng: fix.lng,
      speedMps: fix.speedMps,
      activity,
      metersSinceVehicle: Math.round(this.metersSinceVehicle),
    });

    this.feedEngine(activity, fix, false);
  }

  /**
   * Native Activity Recognition transition (IN_VEHICLE / ON_FOOT / STILL).
   * Authoritative over the GPS speed heuristic: the native module calls this
   * directly so the engine sees real transitions instead of inferred ones. GPS
   * still flows through ingestLocation to accumulate distance + parked coords;
   * this only overrides the activity classification.
   *
   * NB: this is the wiring point for the `modules/backseat-detection` module.
   * It is UNVERIFIED until the native build is run on a real device.
   */
  ingestActivity(activity: Activity, at: number = Date.now()): void {
    const prev = this.activity.current;
    if (activity === prev) return;
    // Trust the native classifier; reset the heuristic's slow-streak counter.
    this.activity = { current: activity, slowStreak: 0 };
    if (activity === "IN_VEHICLE" && prev !== "IN_VEHICLE") {
      this.metersSinceVehicle = 0;
    }
    this.log.log("activity", `native AR ${prev} -> ${activity}`, { source: "native", at });
    const point = this.lastPoint ?? { lat: 0, lng: 0 };
    this.feedEngine(activity, { ...point, speedMps: 0, at }, false);
  }

  /** Registered car's Bluetooth ACL disconnect — the fast, high-confidence trip-end. */
  onBluetoothDisconnect(at: number = Date.now()): void {
    this.log.log("bluetooth", "ACL disconnect");
    const point = this.lastPoint ?? { lat: 0, lng: 0 };
    this.feedEngine(this.activity.current, { ...point, speedMps: 0, at }, true);
  }

  private feedEngine(activity: Activity, fix: LocationFix, btDisconnected: boolean): void {
    const { memo, signal } = step(this.detection, {
      activity,
      at: fix.at,
      metersSinceVehicle: this.metersSinceVehicle,
      btDisconnected,
    });
    this.detection = memo;
    if (!signal) return;

    this.log.log("detection", `signal ${signal.type}`, signal);
    if (signal.type === "DRIVE_CONFIRMED") {
      this.dispatch({ type: "DRIVE_CONFIRMED", at: signal.at });
    } else {
      const parked: ParkedLocation = {
        lat: fix.lat,
        lng: fix.lng,
        capturedAt: signal.at,
      };
      this.dispatch({ type: "TRIP_ENDED", at: signal.at, parked });
    }
  }

  /** Acknowledge from the UI (REMINDER tap or ALARM hold). */
  acknowledge(at: number = Date.now()): void {
    if (this.fsm.name === "REMINDER") this.dispatch({ type: "ACK_REMINDER", at });
    else this.dispatch({ type: "ACK_ALARM", at });
  }

  reset(at: number = Date.now()): void {
    this.dispatch({ type: "RESET", at });
    this.detection = { ...initialMemo };
    this.activity = { ...initialActivityMemo };
    this.metersSinceVehicle = 0;
    this.lastPoint = null;
  }

  /** Core: run the pure transition, perform effects, notify subscribers. */
  dispatch(event: FsmEvent): void {
    const { state, effects } = transition(this.fsm, event);
    if (state !== this.fsm || effects.length > 0) {
      this.log.log("fsm", `${this.fsm.name} --${event.type}--> ${state.name}`);
    }
    this.fsm = state;
    runEffects(effects, state, this.handlerDeps, this.timers);
    for (const fn of this.subscribers) fn(this.fsm);
    // ALL_CLEAR is transient — auto-return to IDLE.
    if (this.fsm.name === "ALL_CLEAR") {
      const next = transition(this.fsm, { type: "RESET", at: event.at });
      this.fsm = next.state;
      for (const fn of this.subscribers) fn(this.fsm);
    }
  }
}
