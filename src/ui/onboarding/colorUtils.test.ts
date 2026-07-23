import { describe, expect, it } from "vitest";
import { hexToHsl, hexToRgb, hslToHex, hslToRgb, rgbToHex, rgbToHsl } from "./colorUtils";

describe("colorUtils", () => {
  it("round-trips hex and rgb", () => {
    expect(hexToRgb("#863bff")).toEqual({ r: 134, g: 59, b: 255 });
    expect(rgbToHex(134, 59, 255)).toBe("#863bff");
  });

  it("clamps rgb channels when converting to hex", () => {
    expect(rgbToHex(-5, 300, 128)).toBe("#00ff80");
  });

  it("round-trips hex and hsl for saturated colors", () => {
    const hsl = hexToHsl("#863bff");
    expect(hsl.s).toBeGreaterThan(50);
    expect(hslToHex(hsl.h, hsl.s, hsl.l)).toBe("#863bff");
  });

  it("converts hsl to rgb for wheel rendering", () => {
    expect(hslToRgb(0, 100, 50)).toEqual({ r: 255, g: 0, b: 0 });
    expect(hslToRgb(0, 0, 50)).toEqual({ r: 128, g: 128, b: 128 });
  });

  it("converts rgb to hsl for grayscale", () => {
    const hsl = rgbToHsl(128, 128, 128);
    expect(hsl.h).toBe(0);
    expect(hsl.s).toBe(0);
    expect(hsl.l).toBeCloseTo(50, 0);
  });
});
