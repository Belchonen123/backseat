import { transition, initialState, FsmState, ParkedLocation } from "./machine";

const parked: ParkedLocation = { lat: 37.42, lng: -122.08, capturedAt: 1000 };

function run(state: FsmState, events: Parameters<typeof transition>[1][]): FsmState {
  return events.reduce((s, e) => transition(s, e).state, state);
}

describe("BackSeat FSM", () => {
  it("arms only after a confirmed drive", () => {
    const r = transition(initialState, { type: "DRIVE_CONFIRMED", at: 100 });
    expect(r.state.name).toBe("DRIVING");
    expect(r.effects).toContainEqual({ kind: "ARM" });
  });

  it("ignores trip-end while IDLE (cannot fire when never driven)", () => {
    const r = transition(initialState, { type: "TRIP_ENDED", at: 200, parked });
    expect(r.state.name).toBe("IDLE");
    expect(r.effects).toHaveLength(0);
  });

  it("trip end goes straight to REMINDER and captures parked location", () => {
    const driving = transition(initialState, { type: "DRIVE_CONFIRMED", at: 0 }).state;
    const r = transition(driving, { type: "TRIP_ENDED", at: 300, parked });
    expect(r.state.name).toBe("REMINDER");
    expect(r.state.parked).toEqual(parked);
    expect(r.effects).toContainEqual({ kind: "FIRE_REMINDER" });
  });

  it("single-tap ack in REMINDER -> ALL_CLEAR (ack_reminder)", () => {
    const s = run(initialState, [
      { type: "DRIVE_CONFIRMED", at: 0 },
      { type: "TRIP_ENDED", at: 1, parked },
    ]);
    const r = transition(s, { type: "ACK_REMINDER", at: 2 });
    expect(r.state.name).toBe("ALL_CLEAR");
    expect(r.effects).toContainEqual({ kind: "LOG_ALL_CLEAR", outcome: "ack_reminder" });
  });

  it("reminder timeout escalates to ALARM", () => {
    const s = run(initialState, [
      { type: "DRIVE_CONFIRMED", at: 0 },
      { type: "TRIP_ENDED", at: 1, parked },
    ]);
    const r = transition(s, { type: "REMINDER_TIMEOUT", at: 50 });
    expect(r.state.name).toBe("ALARM");
    expect(r.effects).toContainEqual({ kind: "FIRE_ALARM" });
  });

  it("hold ack in ALARM stops alarm and clears (ack_alarm)", () => {
    const s = run(initialState, [
      { type: "DRIVE_CONFIRMED", at: 0 },
      { type: "TRIP_ENDED", at: 1, parked },
      { type: "REMINDER_TIMEOUT", at: 50 },
    ]);
    const r = transition(s, { type: "ACK_ALARM", at: 60 });
    expect(r.state.name).toBe("ALL_CLEAR");
    expect(r.effects).toContainEqual({ kind: "STOP_ALARM" });
    expect(r.effects).toContainEqual({ kind: "LOG_ALL_CLEAR", outcome: "ack_alarm" });
  });

  it("alarm timeout sends escalation but does NOT stop the alarm (mute != resolve)", () => {
    const s = run(initialState, [
      { type: "DRIVE_CONFIRMED", at: 0 },
      { type: "TRIP_ENDED", at: 1, parked },
      { type: "REMINDER_TIMEOUT", at: 50 },
    ]);
    const r = transition(s, { type: "ALARM_TIMEOUT", at: 200 });
    expect(r.state.name).toBe("NOTIFY_CONTACTS");
    expect(r.effects).toContainEqual({ kind: "SEND_ESCALATION" });
    expect(r.effects).not.toContainEqual({ kind: "STOP_ALARM" });
  });

  it("ack still works after escalation (NOTIFY_CONTACTS -> ALL_CLEAR)", () => {
    const s = run(initialState, [
      { type: "DRIVE_CONFIRMED", at: 0 },
      { type: "TRIP_ENDED", at: 1, parked },
      { type: "REMINDER_TIMEOUT", at: 50 },
      { type: "ALARM_TIMEOUT", at: 200 },
    ]);
    const r = transition(s, { type: "ACK_ALARM", at: 250 });
    expect(r.state.name).toBe("ALL_CLEAR");
    expect(r.effects).toContainEqual({ kind: "STOP_ALARM" });
  });

  it("RESET returns to a clean IDLE", () => {
    const s = run(initialState, [
      { type: "DRIVE_CONFIRMED", at: 0 },
      { type: "TRIP_ENDED", at: 1, parked },
      { type: "ACK_REMINDER", at: 2 },
    ]);
    const r = transition(s, { type: "RESET", at: 3 });
    expect(r.state).toEqual(initialState);
  });
});
