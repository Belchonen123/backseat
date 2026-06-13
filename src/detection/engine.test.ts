import { step, initialMemo, DetectionMemo } from "./engine";

const base = { metersSinceVehicle: 0, btDisconnected: false };

describe("detection arming rule", () => {
  it("does not confirm a 30-second crawl", () => {
    let memo: DetectionMemo = initialMemo;
    const r1 = step(memo, { activity: "IN_VEHICLE", at: 0, ...base });
    memo = r1.memo;
    const r2 = step(memo, { activity: "IN_VEHICLE", at: 30_000, ...base });
    expect(r2.signal).toBeNull();
  });

  it("confirms after sustained IN_VEHICLE >= 90s", () => {
    let memo = step(initialMemo, { activity: "IN_VEHICLE", at: 0, ...base }).memo;
    const r = step(memo, { activity: "IN_VEHICLE", at: 95_000, ...base });
    expect(r.signal).toEqual({ type: "DRIVE_CONFIRMED", at: 95_000 });
    expect(r.memo.confirmed).toBe(true);
  });

  it("confirms after >= 800m even if quick", () => {
    let memo = step(initialMemo, { activity: "IN_VEHICLE", at: 0, ...base }).memo;
    const r = step(memo, {
      activity: "IN_VEHICLE",
      at: 20_000,
      metersSinceVehicle: 900,
      btDisconnected: false,
    });
    expect(r.signal?.type).toBe("DRIVE_CONFIRMED");
  });

  it("resets if user leaves vehicle before confirming (never-driven car)", () => {
    let memo = step(initialMemo, { activity: "IN_VEHICLE", at: 0, ...base }).memo;
    const r = step(memo, { activity: "ON_FOOT", at: 10_000, ...base });
    expect(r.signal).toBeNull();
    expect(r.memo).toEqual(initialMemo);
  });

  it("fires TRIP_ENDED on BT disconnect after confirm", () => {
    const confirmed: DetectionMemo = { vehicleSince: 0, confirmed: true };
    const r = step(confirmed, {
      activity: "IN_VEHICLE",
      at: 200_000,
      metersSinceVehicle: 5000,
      btDisconnected: true,
    });
    expect(r.signal).toEqual({
      type: "TRIP_ENDED",
      at: 200_000,
      reason: "bt_disconnect",
    });
  });

  it("fires TRIP_ENDED via activity fallback (no BT)", () => {
    const confirmed: DetectionMemo = { vehicleSince: 0, confirmed: true };
    const r = step(confirmed, { activity: "ON_FOOT", at: 200_000, ...base });
    expect(r.signal?.type).toBe("TRIP_ENDED");
    expect(r.signal && "reason" in r.signal && r.signal.reason).toBe("activity");
  });
});
