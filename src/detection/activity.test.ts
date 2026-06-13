import {
  inferActivity,
  initialActivityMemo,
  EXIT_CONFIRM_SAMPLES,
  ActivityMemo,
} from "./activity";
import { haversineMeters } from "./geo";

describe("speed-based activity heuristic", () => {
  it("enters IN_VEHICLE at automotive speed", () => {
    const r = inferActivity(initialActivityMemo, 12);
    expect(r.activity).toBe("IN_VEHICLE");
  });

  it("does not enter vehicle at walking speed", () => {
    const r = inferActivity(initialActivityMemo, 1.2);
    expect(r.activity).toBe("STILL");
  });

  it("requires sustained slow fixes before declaring ON_FOOT (no single-fix trip-end)", () => {
    let memo: ActivityMemo = { current: "IN_VEHICLE", slowStreak: 0 };
    // First slow fix: still IN_VEHICLE (confirming).
    let r = inferActivity(memo, 0.5);
    expect(r.activity).toBe("IN_VEHICLE");
    memo = r.memo;
    // Reach the confirm threshold.
    for (let i = 1; i < EXIT_CONFIRM_SAMPLES; i++) {
      r = inferActivity(memo, 0.5);
      memo = r.memo;
    }
    expect(r.activity).toBe("ON_FOOT");
  });

  it("a brief slowdown then re-acceleration does not trip-end (resets streak)", () => {
    let memo: ActivityMemo = { current: "IN_VEHICLE", slowStreak: 0 };
    let r = inferActivity(memo, 0.5); // slow once
    memo = r.memo;
    r = inferActivity(memo, 15); // moving again
    expect(r.activity).toBe("IN_VEHICLE");
    expect(r.memo.slowStreak).toBe(0);
  });
});

describe("haversine", () => {
  it("computes ~0 for the same point", () => {
    expect(haversineMeters({ lat: 37.42, lng: -122.08 }, { lat: 37.42, lng: -122.08 })).toBeCloseTo(0, 5);
  });
  it("computes a sane distance (~111m per 0.001 deg lat)", () => {
    const d = haversineMeters({ lat: 37.42, lng: -122.08 }, { lat: 37.421, lng: -122.08 });
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});
