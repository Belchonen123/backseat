/**
 * BackSeat detection FSM (Build Brief §3).
 *
 * Pure transition function `(state, event) -> state`. NO side effects here —
 * timers, notifications, location capture, escalation all live in the handler
 * layer (src/fsm/handlers.ts). Persist `FsmState` so a mid-drive process kill
 * recovers correctly.
 *
 *   IDLE --(drive confirmed)--> DRIVING --(trip ended)--> REMINDER
 *   REMINDER --(ack tap)--> ALL_CLEAR --> IDLE
 *   REMINDER --(timeout ~45s)--> ALARM
 *   ALARM --(hold ack)--> ALL_CLEAR --> IDLE
 *   ALARM --(timeout ~3min total)--> NOTIFY_CONTACTS (alarm continues)
 */

export type FsmStateName =
  | "IDLE"
  | "DRIVING"
  | "REMINDER"
  | "ALARM"
  | "NOTIFY_CONTACTS"
  | "ALL_CLEAR";

export interface ParkedLocation {
  lat: number;
  lng: number;
  /** epoch ms */
  capturedAt: number;
}

export interface FsmState {
  name: FsmStateName;
  /** epoch ms the current drive started (set when entering DRIVING). */
  driveStartedAt: number | null;
  /** epoch ms trip ended (set when entering REMINDER). */
  tripEndedAt: number | null;
  parked: ParkedLocation | null;
  /** id of the trip row in Convex once created; null until synced. */
  tripId: string | null;
}

export type FsmEvent =
  /** Detection layer confirmed a real drive (arming rule already satisfied). */
  | { type: "DRIVE_CONFIRMED"; at: number }
  /** Trip ended (BT ACL disconnect primary, or IN_VEHICLE->ON_FOOT fallback). */
  | { type: "TRIP_ENDED"; at: number; parked: ParkedLocation }
  /** REMINDER single-tap "I have my child". */
  | { type: "ACK_REMINDER"; at: number }
  /** ALARM hold-to-confirm completed. */
  | { type: "ACK_ALARM"; at: number }
  /** REMINDER_TO_ALARM_SECONDS elapsed with no ack. */
  | { type: "REMINDER_TIMEOUT"; at: number }
  /** ALARM_TO_NOTIFY_SECONDS elapsed with no ack. */
  | { type: "ALARM_TIMEOUT"; at: number }
  /** ALL_CLEAR finished -> return to IDLE. */
  | { type: "RESET"; at: number };

export const initialState: FsmState = {
  name: "IDLE",
  driveStartedAt: null,
  tripEndedAt: null,
  parked: null,
  tripId: null,
};

/** Side effects that the handler layer must perform after a transition. */
export type Effect =
  | { kind: "ARM" }
  | { kind: "START_REMINDER_TIMER" }
  | { kind: "FIRE_REMINDER" }
  | { kind: "START_ALARM_TIMER" }
  | { kind: "FIRE_ALARM" }
  | { kind: "STOP_ALARM" }
  | { kind: "SEND_ESCALATION" }
  | { kind: "LOG_ALL_CLEAR"; outcome: "ack_reminder" | "ack_alarm" }
  | { kind: "CLEAR_TIMERS" };

export interface TransitionResult {
  state: FsmState;
  effects: Effect[];
}

/** Pure. Given current state + event, returns next state and the effects to run. */
export function transition(state: FsmState, event: FsmEvent): TransitionResult {
  switch (state.name) {
    case "IDLE":
      if (event.type === "DRIVE_CONFIRMED") {
        return {
          state: { ...state, name: "DRIVING", driveStartedAt: event.at },
          effects: [{ kind: "ARM" }],
        };
      }
      return noop(state);

    case "DRIVING":
      if (event.type === "TRIP_ENDED") {
        return {
          state: {
            ...state,
            name: "REMINDER",
            tripEndedAt: event.at,
            parked: event.parked,
          },
          effects: [{ kind: "FIRE_REMINDER" }, { kind: "START_REMINDER_TIMER" }],
        };
      }
      return noop(state);

    case "REMINDER":
      if (event.type === "ACK_REMINDER") {
        return {
          state: { ...state, name: "ALL_CLEAR" },
          effects: [
            { kind: "CLEAR_TIMERS" },
            { kind: "LOG_ALL_CLEAR", outcome: "ack_reminder" },
          ],
        };
      }
      if (event.type === "REMINDER_TIMEOUT") {
        return {
          state: { ...state, name: "ALARM" },
          effects: [{ kind: "FIRE_ALARM" }, { kind: "START_ALARM_TIMER" }],
        };
      }
      return noop(state);

    case "ALARM":
      if (event.type === "ACK_ALARM") {
        return {
          state: { ...state, name: "ALL_CLEAR" },
          effects: [
            { kind: "STOP_ALARM" },
            { kind: "CLEAR_TIMERS" },
            { kind: "LOG_ALL_CLEAR", outcome: "ack_alarm" },
          ],
        };
      }
      if (event.type === "ALARM_TIMEOUT") {
        // Alarm CONTINUES — escalation is additive, never silences (non-negotiable #4).
        return {
          state: { ...state, name: "NOTIFY_CONTACTS" },
          effects: [{ kind: "SEND_ESCALATION" }],
        };
      }
      return noop(state);

    case "NOTIFY_CONTACTS":
      // Mute != resolve. Only an explicit ack clears the cycle.
      if (event.type === "ACK_ALARM") {
        return {
          state: { ...state, name: "ALL_CLEAR" },
          effects: [
            { kind: "STOP_ALARM" },
            { kind: "CLEAR_TIMERS" },
            { kind: "LOG_ALL_CLEAR", outcome: "ack_alarm" },
          ],
        };
      }
      return noop(state);

    case "ALL_CLEAR":
      if (event.type === "RESET") {
        return { state: { ...initialState }, effects: [] };
      }
      return noop(state);

    default:
      return noop(state);
  }
}

function noop(state: FsmState): TransitionResult {
  return { state, effects: [] };
}
