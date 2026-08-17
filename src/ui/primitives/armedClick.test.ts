import { describe, expect, it } from "vitest";
import { createArmedClickGuard } from "./armedClick";

describe("createArmedClickGuard", () => {
  it("rejects a click with no prior pointerdown (Android ghost click)", () => {
    const guard = createArmedClickGuard();
    expect(guard.consume(1)).toBe(false);
  });

  it("accepts a click after primary pointerdown", () => {
    const guard = createArmedClickGuard();
    guard.arm(0);
    expect(guard.consume(1)).toBe(true);
  });

  it("does not reuse a single arm for a second click", () => {
    const guard = createArmedClickGuard();
    guard.arm(0);
    expect(guard.consume(1)).toBe(true);
    expect(guard.consume(1)).toBe(false);
  });

  it("ignores non-primary pointerdown", () => {
    const guard = createArmedClickGuard();
    guard.arm(2);
    expect(guard.consume(1)).toBe(false);
  });

  it("disarm clears a pending arm", () => {
    const guard = createArmedClickGuard();
    guard.arm(0);
    guard.disarm();
    expect(guard.consume(1)).toBe(false);
  });

  it("allows keyboard / assistive clicks (detail === 0) without arming", () => {
    const guard = createArmedClickGuard();
    expect(guard.consume(0)).toBe(true);
  });
});
