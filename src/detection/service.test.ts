import { DetectionService, type ServiceDeps } from "./service";
import { DetectionLogger } from "./logger";

/** Manual timer harness so we can fire escalation timeouts deterministically. */
function harness() {
  const cbs = new Map<number, () => void>();
  let id = 0;
  const calls: string[] = [];
  const deps: ServiceDeps = {
    setTimer: (_s, cb) => {
      const tid = ++id;
      cbs.set(tid, cb);
      return tid;
    },
    clearTimer: (tid) => cbs.delete(tid),
    fireReminder: () => calls.push("reminder"),
    fireAlarm: () => calls.push("alarm"),
    stopAlarm: () => calls.push("stopAlarm"),
    onArmed: () => calls.push("armed"),
    onTripEnd: () => calls.push("tripEnd"),
    onAllClear: (o) => calls.push(`allClear:${o}`),
    sendEscalation: () => calls.push("escalation"),
    logger: new DetectionLogger(),
  };
  const fire = (tid: number) => cbs.get(tid)?.();
  return { deps, calls, fire, cbs };
}

const driving = (at: number) => ({ lat: 37.42, lng: -122.08, speedMps: 14, at });

describe("DetectionService end-to-end", () => {
  it("confirms a real drive, fires REMINDER on trip-end, escalates if no ack", () => {
    const h = harness();
    const svc = new DetectionService(h.deps);

    // Drive: first vehicle fix, then a fix 95s later still moving -> confirmed.
    svc.ingestLocation(driving(0));
    svc.ingestLocation(driving(95_000));
    expect(h.calls).toContain("armed");
    expect(svc.getState().name).toBe("DRIVING");

    // Park: three sustained slow fixes flip activity to ON_FOOT -> trip end.
    const slow = (at: number) => ({ lat: 37.42, lng: -122.08, speedMps: 0.3, at });
    svc.ingestLocation(slow(96_000));
    svc.ingestLocation(slow(97_000));
    svc.ingestLocation(slow(98_000));

    expect(svc.getState().name).toBe("REMINDER");
    expect(svc.getState().parked).not.toBeNull();
    expect(h.calls).toContain("tripEnd");
    expect(h.calls).toContain("reminder");

    // No ack -> reminder timer fires -> ALARM.
    h.fire(1);
    expect(svc.getState().name).toBe("ALARM");
    expect(h.calls).toContain("alarm");

    // Still no ack -> alarm timer fires -> escalation (alarm continues).
    h.fire(2);
    expect(svc.getState().name).toBe("NOTIFY_CONTACTS");
    expect(h.calls).toContain("escalation");
    expect(h.calls.filter((c) => c === "stopAlarm")).toHaveLength(0);
  });

  it("Bluetooth disconnect is a fast trip-end after a confirmed drive", () => {
    const h = harness();
    const svc = new DetectionService(h.deps);
    svc.ingestLocation(driving(0));
    svc.ingestLocation(driving(95_000));
    expect(svc.getState().name).toBe("DRIVING");

    svc.onBluetoothDisconnect(95_500);
    expect(svc.getState().name).toBe("REMINDER");
  });

  it("single-tap ack in REMINDER clears back to IDLE", () => {
    const h = harness();
    const svc = new DetectionService(h.deps);
    svc.ingestLocation(driving(0));
    svc.ingestLocation(driving(95_000));
    svc.onBluetoothDisconnect(95_500);
    expect(svc.getState().name).toBe("REMINDER");

    svc.acknowledge(96_000);
    expect(h.calls).toContain("allClear:ack_reminder");
    expect(svc.getState().name).toBe("IDLE"); // ALL_CLEAR auto-resets
  });

  it("does not arm on a parked-but-never-driven car (walk away)", () => {
    const h = harness();
    const svc = new DetectionService(h.deps);
    // Slow/idle fixes only — never reaches automotive speed.
    svc.ingestLocation({ lat: 37.42, lng: -122.08, speedMps: 0.5, at: 0 });
    svc.ingestLocation({ lat: 37.42, lng: -122.08, speedMps: 1.0, at: 60_000 });
    expect(svc.getState().name).toBe("IDLE");
    expect(h.calls).not.toContain("armed");
  });

  it("native Activity Recognition transition to ON_FOOT is a trip-end", () => {
    const h = harness();
    const svc = new DetectionService(h.deps);
    // Confirm a drive via GPS, then let the NATIVE classifier report the stop.
    svc.ingestLocation(driving(0));
    svc.ingestLocation(driving(95_000));
    expect(svc.getState().name).toBe("DRIVING");

    svc.ingestActivity("ON_FOOT", 96_000);
    expect(svc.getState().name).toBe("REMINDER");
    expect(h.calls).toContain("reminder");
  });

  it("uses the injected escalation timing (editable settings) for timers", () => {
    const seconds: number[] = [];
    const h = harness();
    const deps: ServiceDeps = {
      ...h.deps,
      setTimer: (s, cb) => {
        seconds.push(s);
        return h.deps.setTimer(s, cb);
      },
      getTiming: () => ({ reminderToAlarmSeconds: 20, alarmToNotifySeconds: 40 }),
    };
    const svc = new DetectionService(deps);
    svc.ingestLocation(driving(0));
    svc.ingestLocation(driving(95_000));
    svc.onBluetoothDisconnect(95_500); // -> REMINDER, starts reminder timer
    expect(seconds).toContain(20);

    h.fire(1); // reminder timeout -> ALARM, starts alarm timer
    expect(svc.getState().name).toBe("ALARM");
    expect(seconds).toContain(40);
  });
});
