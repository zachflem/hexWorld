import { describe, expect, it } from "vitest";
import { axialNeighbors, axialSpiral } from "./hexCoords";
import { isBuildableLand, isTransitionTile, terrainAt } from "./terrain";

describe("terrainAt", () => {
  it("is deterministic — same seed and coordinate always yields the same terrain", () => {
    const seed = 12345;
    const coord = { q: 17, r: -4 };
    const first = terrainAt(seed, coord);
    for (let i = 0; i < 5; i++) {
      expect(terrainAt(seed, coord)).toBe(first);
    }
  });

  it("produces a varied map, not a single terrain type everywhere", () => {
    const seed = 42;
    const terrainTypes = new Set(axialSpiral({ q: 0, r: 0 }, 20).map((coord) => terrainAt(seed, coord)));
    expect(terrainTypes.size).toBeGreaterThan(1);
  });

  it("different seeds can produce different maps for the same coordinates", () => {
    const coords = axialSpiral({ q: 0, r: 0 }, 10);
    const mapA = coords.map((c) => terrainAt(1, c));
    const mapB = coords.map((c) => terrainAt(2, c));
    expect(mapA).not.toEqual(mapB);
  });
});

describe("isTransitionTile", () => {
  it("is true exactly when a tile has a differently-terrained neighbor", () => {
    const seed = 7;
    for (const coord of axialSpiral({ q: 0, r: 0 }, 15)) {
      const own = terrainAt(seed, coord);
      const expected = axialNeighbors(coord).some((n) => terrainAt(seed, n) !== own);
      expect(isTransitionTile(seed, coord)).toBe(expected);
    }
  });

  it("finds at least one transition tile across a large enough sample", () => {
    const seed = 7;
    const found = axialSpiral({ q: 0, r: 0 }, 15).some((coord) => isTransitionTile(seed, coord));
    expect(found).toBe(true);
  });
});

describe("isBuildableLand", () => {
  it("is false on water and true on every other terrain type", () => {
    const seed = 7;
    for (const coord of axialSpiral({ q: 0, r: 0 }, 15)) {
      expect(isBuildableLand(seed, coord)).toBe(terrainAt(seed, coord) !== "water");
    }
  });
});
