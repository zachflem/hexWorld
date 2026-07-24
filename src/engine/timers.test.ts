import { describe, expect, it } from "vitest";
import { isTimerComplete, progressFromRemaining, remainingMs } from "./timers";

describe("isTimerComplete", () => {
  it("is false just before the duration elapses", () => {
    expect(isTimerComplete(1000, 5000, 1000 + 4999)).toBe(false);
  });

  it("is true exactly at the duration", () => {
    expect(isTimerComplete(1000, 5000, 1000 + 5000)).toBe(true);
  });

  it("is true well after the duration — an arbitrarily long offline gap", () => {
    expect(isTimerComplete(1000, 5000, 1000 + 5000 + 1000 * 60 * 60 * 24 * 30)).toBe(true);
  });
});

describe("remainingMs", () => {
  it("counts down toward 0 as time passes", () => {
    expect(remainingMs(1000, 5000, 1000)).toBe(5000);
    expect(remainingMs(1000, 5000, 1000 + 2000)).toBe(3000);
  });

  it("clamps at 0 rather than going negative once the timer is complete", () => {
    expect(remainingMs(1000, 5000, 1000 + 5000)).toBe(0);
    expect(remainingMs(1000, 5000, 1000 + 999_999)).toBe(0);
  });
});

describe("progressFromRemaining", () => {
  it("is 0 when the full duration remains and 1 when none remains", () => {
    expect(progressFromRemaining(5000, 5000)).toBe(0);
    expect(progressFromRemaining(0, 5000)).toBe(1);
  });

  it("tracks the elapsed fraction and clamps out-of-range inputs", () => {
    expect(progressFromRemaining(2500, 5000)).toBeCloseTo(0.5);
    expect(progressFromRemaining(-100, 5000)).toBe(1);
    expect(progressFromRemaining(6000, 5000)).toBe(0);
    expect(progressFromRemaining(100, 0)).toBe(1);
  });
});
