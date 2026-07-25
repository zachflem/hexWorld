import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { axialDistance, axialRing, isWithinMapBounds, mapCenter, type Axial } from "../engine/hexCoords";
import { terrainAt } from "../engine/terrain";
import { createDens } from "./dens";
import { createLab } from "./lab";
import { tweaksForMapSize } from "./mapSize";
import { tweaksSchema } from "./tweaksSchema";
import { createStartingTerritory, spawnDistanceFromCenter, startingBiomeDiversity } from "./territory";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

/** Pre-spawn-variety behavior: geometric center, or nearest non-water. */
function legacyCenterBaseLocation(seed: number, gridSize: number): Axial {
  const center = mapCenter(gridSize);
  if (terrainAt(seed, center) !== "water") return center;

  for (let radius = 1; radius < gridSize; radius++) {
    for (const coord of axialRing(center, radius)) {
      if (!isWithinMapBounds(coord, gridSize)) continue;
      if (terrainAt(seed, coord) !== "water") return coord;
    }
  }
  return center;
}

describe("createStartingTerritory", () => {
  it("owns exactly 19 tiles (base + first two full rings), per DESIGN.md §6", () => {
    const territory = createStartingTerritory(1, 128);
    expect(territory.owned).toHaveLength(19);
  });

  it("every owned tile is within 2 rings of the base and inside map bounds", () => {
    const gridSize = 128;
    const territory = createStartingTerritory(1, gridSize);
    for (const coord of territory.owned) {
      expect(axialDistance(coord, territory.base)).toBeLessThanOrEqual(2);
      expect(isWithinMapBounds(coord, gridSize)).toBe(true);
    }
  });

  it("never places the base on water, across many seeds", () => {
    const gridSize = 128;
    for (let seed = 0; seed < 50; seed++) {
      const territory = createStartingTerritory(seed, gridSize);
      expect(terrainAt(seed, territory.base)).not.toBe("water");
    }
  });

  it("is deterministic — same seed and grid size always yield the same base", () => {
    const a = createStartingTerritory(42_424, 128);
    const b = createStartingTerritory(42_424, 128);
    expect(a.base).toEqual(b.base);
    expect(a.owned).toEqual(b.owned);
  });

  it("keeps owned in-bounds and base dry across many seeds and map sizes", () => {
    for (const gridSize of [32, 64, 96, 128]) {
      for (let seed = 0; seed < 40; seed++) {
        const territory = createStartingTerritory(seed, gridSize);
        expect(terrainAt(seed, territory.base)).not.toBe("water");
        expect(territory.owned.length).toBeLessThanOrEqual(19);
        expect(territory.owned.length).toBeGreaterThan(0);
        for (const coord of territory.owned) {
          expect(isWithinMapBounds(coord, gridSize)).toBe(true);
          expect(axialDistance(coord, territory.base)).toBeLessThanOrEqual(2);
        }
      }
    }
  });

  it("is not stuck on map center for every seed", () => {
    const gridSize = 128;
    const center = mapCenter(gridSize);
    let offCenter = 0;
    for (let seed = 0; seed < 100; seed++) {
      const { base } = createStartingTerritory(seed, gridSize);
      if (base.q !== center.q || base.r !== center.r) offCenter++;
    }
    expect(offCenter).toBeGreaterThan(10);
  });

  it("places a meaningful share of bases well away from center (corners/edges)", () => {
    const gridSize = 128;
    const farThreshold = Math.floor(gridSize / 4); // ≥32 axial steps from center
    let far = 0;
    for (let seed = 0; seed < 120; seed++) {
      const { base } = createStartingTerritory(seed, gridSize);
      if (spawnDistanceFromCenter(base, gridSize) >= farThreshold) far++;
    }
    expect(far).toBeGreaterThan(15);
  });

  it("raises multi-seed starting biome mix vs legacy center-only spawn", () => {
    const gridSize = 128;
    const sample = 100;
    let mixedNew = 0;
    let mixedLegacy = 0;
    for (let seed = 0; seed < sample; seed++) {
      const { base } = createStartingTerritory(seed, gridSize);
      if (startingBiomeDiversity(seed, base) >= 2) mixedNew++;
      if (startingBiomeDiversity(seed, legacyCenterBaseLocation(seed, gridSize)) >= 2) mixedLegacy++;
    }
    expect(mixedNew / sample).toBeGreaterThan(mixedLegacy / sample);
    expect(mixedNew / sample).toBeGreaterThan(0.35);
  });

  it("still places dens and lab for default map sizes across many seeds", () => {
    const baseTweaks = loadRealTweaks();
    for (const gridSize of [32, 64, 96, 128]) {
      const tweaks = tweaksForMapSize(baseTweaks, gridSize);
      for (let seed = 0; seed < 20; seed++) {
        const { base } = createStartingTerritory(seed, gridSize);
        const dens = createDens(seed, gridSize, base, tweaks);
        expect(dens.length).toBeGreaterThanOrEqual(tweaks.dens.count - 1);
        expect(dens.length).toBeLessThanOrEqual(tweaks.dens.count + 1);
        const lab = createLab(seed, gridSize, base, dens, tweaks);
        expect(isWithinMapBounds(lab.coord, gridSize)).toBe(true);
        expect(terrainAt(seed, lab.coord)).not.toBe("water");
      }
    }
  });
});
