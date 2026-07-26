import { describe, expect, it } from "vitest";
import { collectPinVisible } from "./stockpileState";

describe("collectPinVisible", () => {
  it("hides empty stockpiles", () => {
    expect(collectPinVisible(0, 1000, false, 0.6, 1)).toBe(false);
  });

  it("shows manual sites at the configured fill ratio", () => {
    expect(collectPinVisible(599, 1000, false, 0.6, 1)).toBe(false);
    expect(collectPinVisible(600, 1000, false, 0.6, 1)).toBe(true);
  });

  it("requires a full local buffer for courier-automated sites", () => {
    expect(collectPinVisible(999, 1000, true, 0.6, 1)).toBe(false);
    expect(collectPinVisible(1000, 1000, true, 0.6, 1)).toBe(true);
  });
});
