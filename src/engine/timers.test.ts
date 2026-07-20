import { describe, expect, it } from "vitest";
import { isTimerComplete, remainingMs } from "./timers";

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
