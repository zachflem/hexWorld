import { describe, expect, it } from "vitest";
import { hexToRgb, rgbToHex } from "./colorUtils";

describe("colorUtils", () => {
  it("round-trips hex and rgb", () => {
    expect(hexToRgb("#863bff")).toEqual({ r: 134, g: 59, b: 255 });
    expect(rgbToHex(134, 59, 255)).toBe("#863bff");
  });

  it("clamps rgb channels when converting to hex", () => {
    expect(rgbToHex(-5, 300, 128)).toBe("#00ff80");
  });
});
