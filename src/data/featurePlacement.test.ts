import { describe, expect, it } from "vitest";
import { axialDistance, axialKey, mapCenter } from "../engine/hexCoords";
import { terrainAt } from "../engine/terrain";
import { enumerateMapCoords, placeFeatures } from "./featurePlacement";

describe("enumerateMapCoords", () => {
  it("covers every in-bounds tile once", () => {
    const gridSize = 32;
    const coords = enumerateMapCoords(gridSize);
    expect(coords).toHaveLength(gridSize * gridSize);
    const keys = new Set(coords.map(axialKey));
    expect(keys.size).toBe(gridSize * gridSize);
  });
});

describe("placeFeatures", () => {
  const seed = 99;
  const gridSize = 64;
  const base = mapCenter(gridSize);

  it("is deterministic for a given seed and salt", () => {
    const opts = {
      seed,
      gridSize,
      salt: 1000,
      count: 5,
      minSeparation: 4,
      anchors: [{ coords: [base], minDistance: 8 }],
    };
    expect(placeFeatures(opts)).toEqual(placeFeatures(opts));
  });

  it("respects count, water, anchors, and min separation", () => {
    const placed = placeFeatures({
      seed,
      gridSize,
      salt: 2000,
      count: 6,
      minSeparation: 5,
      anchors: [{ coords: [base], minDistance: 10 }],
    });
    expect(placed.length).toBe(6);
    for (const coord of placed) {
      expect(terrainAt(seed, coord)).not.toBe("water");
      expect(axialDistance(base, coord)).toBeGreaterThanOrEqual(10);
    }
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        expect(axialDistance(placed[i], placed[j])).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it("skips excluded keys", () => {
    const excluded = new Set([axialKey({ q: base.q + 12, r: base.r })]);
    const placed = placeFeatures({
      seed,
      gridSize,
      salt: 3000,
      count: 8,
      minSeparation: 3,
      anchors: [{ coords: [base], minDistance: 6 }],
      excludedKeys: excluded,
    });
    for (const coord of placed) {
      expect(excluded.has(axialKey(coord))).toBe(false);
    }
  });

  it("uses independent salts for independent streams", () => {
    const shared = {
      seed,
      gridSize,
      count: 4,
      minSeparation: 4,
      anchors: [{ coords: [base], minDistance: 8 }],
    };
    const a = placeFeatures({ ...shared, salt: 1 });
    const b = placeFeatures({ ...shared, salt: 99_999 });
    expect(a).not.toEqual(b);
  });
});
