/**
 * Side-effect layer for the FSM (Build Brief §3/§9). The pure transition
 * function returns Effect[]; this runner performs them. Kept separate so the
 * machine stays unit-testable. Injected dependencies make it testable too.
 */
import { thresholds } from "@config/thresholds";
import type { Effect, FsmState } from "./machine";

export interface HandlerDeps {
  /** Schedule a callback after `seconds`; returns a cancel handle id. */
  setTimer: (seconds: number, cb: () => void) => number;
  clearTimer: (id: number) => void;
  /** Local alert side effects (Notifee on device). */
  fireReminder: () => void;
  fireAlarm: () => void;
  stopAlarm: () => void;
  /** Backend sync (Convex). */
  onArmed: (state: FsmState) => void;
  onTripEnd: (state: FsmState) => void;
  onAllClear: (outcome: "ack_reminder" | "ack_alarm", state: FsmState) => void;
  sendEscalation: (state: FsmState) => void;
  /** Fired so the store can dispatch the matching timeout event. */
  emitReminderTimeout: () => void;
  emitAlarmTimeout: () => void;
  /**
   * Live escalation timing in seconds. Optional: when absent we fall back to the
   * tuned constants in config/thresholds. The app wires this to the user's
   * persisted settings so an edit takes effect on the NEXT trip without a
   * rebuild. Read lazily (per timer start) so a mid-session change is honoured.
   */
  getTiming?: () => { reminderToAlarmSeconds: number; alarmToNotifySeconds: number };
  log: (msg: string, data?: unknown) => void;
}

export interface TimerBag {
  reminder: number | null;
  alarm: number | null;
}

export function makeTimerBag(): TimerBag {
  return { reminder: null, alarm: null };
}

/** Execute the effects for one transition. Pure-ish: all I/O via deps. */
export function runEffects(
  effects: Effect[],
  state: FsmState,
  deps: HandlerDeps,
  timers: TimerBag,
): void {
  const timing = deps.getTiming?.() ?? {
    reminderToAlarmSeconds: thresholds.REMINDER_TO_ALARM_SECONDS,
    alarmToNotifySeconds: thresholds.ALARM_TO_NOTIFY_SECONDS,
  };
  for (const effect of effects) {
    deps.log(`effect:${effect.kind}`, { state: state.name });
    switch (effect.kind) {
      case "ARM":
        deps.onArmed(state);
        break;
      case "FIRE_REMINDER":
        deps.onTripEnd(state);
        deps.fireReminder();
        break;
      case "START_REMINDER_TIMER":
        timers.reminder = deps.setTimer(
          timing.reminderToAlarmSeconds,
          deps.emitReminderTimeout,
        );
        break;
      case "FIRE_ALARM":
        deps.fireAlarm();
        break;
      case "START_ALARM_TIMER":
        timers.alarm = deps.setTimer(
          timing.alarmToNotifySeconds,
          deps.emitAlarmTimeout,
        );
        break;
      case "STOP_ALARM":
        deps.stopAlarm();
        break;
      case "SEND_ESCALATION":
        // NB: does NOT stop the alarm — escalation is additive (non-negotiable #4).
        deps.sendEscalation(state);
        break;
      case "LOG_ALL_CLEAR":
        deps.onAllClear(effect.outcome, state);
        break;
      case "CLEAR_TIMERS":
        if (timers.reminder !== null) deps.clearTimer(timers.reminder);
        if (timers.alarm !== null) deps.clearTimer(timers.alarm);
        timers.reminder = null;
        timers.alarm = null;
        break;
    }
  }
}
