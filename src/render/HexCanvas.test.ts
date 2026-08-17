import { describe, expect, it } from "vitest";
import { axialToPixel } from "../engine/hexCoords";
import { BASE_HEX_SIZE, centerPanOnBase } from "./HexCanvas";

describe("centerPanOnBase", () => {
  it("places the base tile's world center at the view center", () => {
    const base = { q: 10, r: -4 };
    const viewWidth = 800;
    const viewHeight = 600;
    const pan = centerPanOnBase(base, viewWidth, viewHeight);
    const basePixel = axialToPixel(base, BASE_HEX_SIZE);

    expect(basePixel.x * 1 + pan.x).toBeCloseTo(viewWidth / 2);
    expect(basePixel.y * 1 + pan.y).toBeCloseTo(viewHeight / 2);
  });
});
