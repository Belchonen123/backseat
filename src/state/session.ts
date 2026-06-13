/**
 * Session FSM store.
 *
 * Bridges the presentational screens to the real pure FSM in
 * `src/fsm/machine.ts`. The store holds the canonical `FsmState` and exposes a
 * `dispatch(event)` that runs `transition()` and stores the result. The screens
 * keep using the same public surface (the `SessionState` UI enum + the
 * convenience transition methods); those are now thin wrappers that build the
 * appropriate `FsmEvent` and dispatch it.
 *
 * No timers / Notifee here — that is the handler layer's job. This store only
 * reflects FSM state so the UI can render it.
 */

import { create } from 'zustand';
import {
  initialState,
  transition,
  type FsmEvent,
  type FsmState,
  type FsmStateName,
} from '@/fsm/machine';

/** Escalation finite-state machine states. */
export enum SessionState {
  /** No car paired / first run. */
  Idle = 'idle',
  /** Actively monitoring an in-progress drive (blue). */
  Monitoring = 'monitoring',
  /** Trip ended, first amber reminder counting down to alarm. */
  Reminder = 'reminder',
  /** Reminder expired — loud red alarm / escalation. */
  Alarm = 'alarm',
  /** User confirmed safety — resolved (teal). */
  Resolved = 'resolved',
  /** Protection paused due to missing permissions. */
  Paused = 'paused',
}

/** How a trip ended, for the history log. */
export type TripOutcome = 'ack_reminder' | 'ack_alarm' | 'escalated';

export interface PairedCar {
  id: string;
  name: string;
  trigger: string;
}

export interface SessionStore {
  /** UI-facing escalation state, derived from the FSM. */
  state: SessionState;
  /** Canonical FSM state (source of truth). */
  fsm: FsmState;
  car: PairedCar | null;
  /** Seconds remaining before the next escalation step. */
  reminderSecondsLeft: number;
  alarmSecondsLeft: number;

  /** Run a real FSM event through `transition()` and store the result. */
  dispatch: (event: FsmEvent) => void;

  // --- convenience transitions used by the screens (wrap dispatch) ---
  startMonitoring: () => void;
  endTrip: () => void;
  acknowledge: () => void;
  escalate: () => void;
  reset: () => void;
  pairCar: (car: PairedCar) => void;
}

export const REMINDER_TOTAL_SECONDS = 45;
export const ALARM_TOTAL_SECONDS = 135; // 2:15 escalation window

/** Map the FSM's canonical state names onto the UI enum the screens expect. */
const FSM_TO_UI: Record<FsmStateName, SessionState> = {
  IDLE: SessionState.Idle,
  DRIVING: SessionState.Monitoring,
  REMINDER: SessionState.Reminder,
  ALARM: SessionState.Alarm,
  NOTIFY_CONTACTS: SessionState.Alarm,
  ALL_CLEAR: SessionState.Resolved,
};

export function fsmNameToUi(name: FsmStateName): SessionState {
  return FSM_TO_UI[name];
}

export const useSession = create<SessionStore>((set, get) => ({
  state: SessionState.Idle,
  fsm: initialState,
  car: null,
  reminderSecondsLeft: REMINDER_TOTAL_SECONDS,
  alarmSecondsLeft: ALARM_TOTAL_SECONDS,

  dispatch: (event) => {
    const { state: nextFsm } = transition(get().fsm, event);
    set({ fsm: nextFsm, state: fsmNameToUi(nextFsm.name) });
  },

  startMonitoring: () => get().dispatch({ type: 'DRIVE_CONFIRMED', at: Date.now() }),
  endTrip: () =>
    get().dispatch({
      type: 'TRIP_ENDED',
      at: Date.now(),
      parked: { lat: 0, lng: 0, capturedAt: Date.now() },
    }),
  acknowledge: () => {
    const { fsm, dispatch } = get();
    dispatch(
      fsm.name === 'REMINDER'
        ? { type: 'ACK_REMINDER', at: Date.now() }
        : { type: 'ACK_ALARM', at: Date.now() },
    );
  },
  escalate: () => get().dispatch({ type: 'REMINDER_TIMEOUT', at: Date.now() }),
  reset: () => {
    get().dispatch({ type: 'RESET', at: Date.now() });
    set({
      reminderSecondsLeft: REMINDER_TOTAL_SECONDS,
      alarmSecondsLeft: ALARM_TOTAL_SECONDS,
    });
  },
  pairCar: (car) => set({ car }),
}));

// Convenience selectors the screens use.
export const selectIsArmed = (s: SessionStore): boolean =>
  s.state === SessionState.Monitoring;
export const selectCar = (s: SessionStore): PairedCar | null => s.car;
