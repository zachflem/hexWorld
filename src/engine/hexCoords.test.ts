import { describe, expect, it } from "vitest";
import {
  axialDistance,
  axialNeighbors,
  axialRing,
  axialSpiral,
  isWithinMapBounds,
  mapCenter,
  pixelToAxial,
  axialToPixel,
} from "./hexCoords";

describe("hexCoords", () => {
  it("has 6 neighbors, each at distance 1", () => {
    const center = { q: 3, r: -2 };
    const neighbors = axialNeighbors(center);
    expect(neighbors).toHaveLength(6);
    for (const n of neighbors) {
      expect(axialDistance(center, n)).toBe(1);
    }
  });

  it("rings have 6*radius tiles, matching DESIGN.md §6 ring sizes", () => {
    const center = { q: 0, r: 0 };
    expect(axialRing(center, 1)).toHaveLength(6);
    expect(axialRing(center, 2)).toHaveLength(12);
    expect(axialRing(center, 3)).toHaveLength(18);
  });

  it("a radius-2 spiral is the base tile + 19 total owned tiles", () => {
    const center = { q: 5, r: 5 };
    expect(axialSpiral(center, 2)).toHaveLength(19);
  });

  it("every tile in a spiral is within its own radius", () => {
    const center = { q: 0, r: 0 };
    const radius = 3;
    for (const coord of axialSpiral(center, radius)) {
      expect(axialDistance(center, coord)).toBeLessThanOrEqual(radius);
    }
  });

  it("pixel round-trip recovers the original axial coordinate", () => {
    const size = 24;
    for (const coord of [{ q: 0, r: 0 }, { q: 5, r: -3 }, { q: -8, r: 12 }]) {
      const pixel = axialToPixel(coord, size);
      expect(pixelToAxial(pixel, size)).toEqual(coord);
    }
  });

  it("map bounds accept the center and reject out-of-range coordinates", () => {
    const gridSize = 128;
    expect(isWithinMapBounds(mapCenter(gridSize), gridSize)).toBe(true);
    expect(isWithinMapBounds({ q: 0, r: -1 }, gridSize)).toBe(false);
    expect(isWithinMapBounds({ q: 0, r: gridSize }, gridSize)).toBe(false);
  });
});
