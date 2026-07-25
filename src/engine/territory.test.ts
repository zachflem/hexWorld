import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import type { TerritoryRecord } from "../data/territory";
import type { Tower } from "../data/towers";
import { tweaksSchema } from "../data/tweaksSchema";
import { axialKey, axialNeighbors, axialSpiral, type Axial } from "./hexCoords";
import { terrainAt, type TerrainType } from "./terrain";
import { towerRange } from "./towers";
import { autoClaimTowerRange, canRepairHordeDamagedTile, isTileScoutable, isWithinActiveTowerClaim, tileDefense } from "./territory";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

/** Scans outward from `near` for the first tile of the given terrain, for deterministic terrain-dependent tests. */
function findTerrain(seed: number, terrain: TerrainType, near: Axial = { q: 0, r: 0 }, maxRadius = 100): Axial {
  for (const coord of axialSpiral(near, maxRadius)) {
    if (terrainAt(seed, coord) === terrain) return coord;
  }
  throw new Error(`no ${terrain} tile found near (${near.q},${near.r}) for seed ${seed} within radius ${maxRadius}`);
}

describe("tileDefense", () => {
  it("scales linearly with distance from base", () => {
    const tweaks = loadRealTweaks();
    expect(tileDefense(tweaks, 3)).toBeCloseTo(6);
    expect(tileDefense(tweaks, 4)).toBeCloseTo(8);
    expect(tileDefense(tweaks, 5)).toBeCloseTo(10);
  });
});

describe("isTileScoutable", () => {
  const seed = 3;
  const base = findTerrain(seed, "grassland", { q: 0, r: 0 });

  it("is true for a tile adjacent to owned territory", () => {
    const coord = axialNeighbors(base)[0];
    expect(isTileScoutable(seed, coord, [base], [])).toBe(true);
  });

  it("is true for a tile adjacent to an already-scouted tile, even far from owned territory", () => {
    const farScouted = findTerrain(seed, "grassland", { q: 20, r: 0 });
    const coord = axialNeighbors(farScouted)[0];
    expect(isTileScoutable(seed, coord, [base], [farScouted])).toBe(true);
  });

  it("is false for a tile that skips ahead — not adjacent to owned or scouted territory", () => {
    expect(isTileScoutable(seed, { q: 10, r: 0 }, [base], [])).toBe(false);
  });

  describe("water traversal", () => {
    it("allows scouting the water tile right at a land shoreline", () => {
      const water = findTerrain(seed, "water");
      const landNeighbor = axialNeighbors(water).find((n) => terrainAt(seed, n) !== "water");
      if (!landNeighbor) throw new Error("expected at least one land neighbor for the shoreline test");
      expect(isTileScoutable(seed, water, [landNeighbor], [])).toBe(true);
    });

    it("blocks scouting further out across water, even from an already-scouted water tile", () => {
      const water = findTerrain(seed, "water");
      const waterNeighbor = axialNeighbors(water).find((n) => terrainAt(seed, n) === "water");
      if (!waterNeighbor) throw new Error("expected at least one water neighbor for the lake-traversal test");
      // `water` is already "scouted", but since it's not land, it can't relay further out.
      expect(isTileScoutable(seed, waterNeighbor, [], [water])).toBe(false);
    });

    it("ignores an owned water tile as a scouting anchor", () => {
      const water = findTerrain(seed, "water");
      const waterNeighbor = axialNeighbors(water).find((n) => terrainAt(seed, n) === "water");
      if (!waterNeighbor) throw new Error("expected at least one water neighbor for this test");
      // Even "owned" water (e.g. inside the starting territory blob) can't anchor scouting.
      expect(isTileScoutable(seed, waterNeighbor, [water], [])).toBe(false);
    });
  });
});

describe("autoClaimTowerRange", () => {
  const gridSize = 128;
  const seed = 3;
  const grassland = findTerrain(seed, "grassland", { q: 20, r: 20 });

  function makeTower(overrides: Partial<Tower> = {}): Tower {
    return {
      coord: grassland,
      level: 1,
      totalInvested: {},
      upgrade: null,
      buildCost: {},
      damaged: false,
      ...overrides,
    };
  }

  it("claims every unowned tile within the tower's current range", () => {
    const tweaks = loadRealTweaks();
    const tower = makeTower();
    const territory: TerritoryRecord = { base: { q: 0, r: 0 }, owned: [] };

    const result = autoClaimTowerRange(tweaks, [tower], territory, gridSize, new Set(), seed);

    const range = towerRange(tweaks, tower.level, terrainAt(seed, tower.coord));
    const expectedTiles = axialSpiral(tower.coord, range);
    expect(result.owned).toHaveLength(expectedTiles.length);
    const ownedKeys = new Set(result.owned.map(axialKey));
    for (const coord of expectedTiles) expect(ownedKeys.has(axialKey(coord))).toBe(true);
  });

  it("unions with already-owned territory without duplicating tiles", () => {
    const tweaks = loadRealTweaks();
    const tower = makeTower();
    const alreadyOwned = { q: 0, r: 0 };
    const territory: TerritoryRecord = { base: alreadyOwned, owned: [alreadyOwned] };

    const result = autoClaimTowerRange(tweaks, [tower], territory, gridSize, new Set(), seed);

    const ownedKeys = result.owned.map(axialKey);
    expect(new Set(ownedKeys).size).toBe(ownedKeys.length); // no duplicates
    expect(ownedKeys).toContain(axialKey(alreadyOwned));
  });

  it("grows the claimed radius as the tower's level (and so its range) increases", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: { q: 0, r: 0 }, owned: [] };

    const l1 = autoClaimTowerRange(tweaks, [makeTower({ level: 1 })], territory, gridSize, new Set(), seed);
    const l3 = autoClaimTowerRange(tweaks, [makeTower({ level: 3 })], territory, gridSize, new Set(), seed);

    expect(l3.owned.length).toBeGreaterThan(l1.owned.length);
  });

  it("claims farther from a mountain tower than a forest tower at the same level (#79)", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: { q: 0, r: 0 }, owned: [] };
    const mountain = findTerrain(seed, "mountain", { q: 20, r: 20 });
    const forest = findTerrain(seed, "forest", { q: 20, r: 20 });

    const onMountain = autoClaimTowerRange(tweaks, [makeTower({ coord: mountain })], territory, gridSize, new Set(), seed);
    const onForest = autoClaimTowerRange(tweaks, [makeTower({ coord: forest })], territory, gridSize, new Set(), seed);

    expect(onMountain.owned.length).toBeGreaterThan(onForest.owned.length);
  });

  it("excludes tiles a horde currently occupies", () => {
    const tweaks = loadRealTweaks();
    const tower = makeTower();
    const territory: TerritoryRecord = { base: { q: 0, r: 0 }, owned: [] };
    const hordeCoord = tower.coord; // horde sitting right on the tower's own tile

    const result = autoClaimTowerRange(tweaks, [tower], territory, gridSize, new Set([axialKey(hordeCoord)]), seed);

    expect(result.owned.map(axialKey)).not.toContain(axialKey(hordeCoord));
  });

  it("a damaged tower contributes no claim, same as it contributes no combat value", () => {
    const tweaks = loadRealTweaks();
    const tower = makeTower({ damaged: true });
    const territory: TerritoryRecord = { base: { q: 0, r: 0 }, owned: [] };

    const result = autoClaimTowerRange(tweaks, [tower], territory, gridSize, new Set(), seed);
    expect(result).toBe(territory);
  });

  it("returns the same territory reference when there's nothing new to claim (no-op)", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: { q: 0, r: 0 }, owned: [] };
    expect(autoClaimTowerRange(tweaks, [], territory, gridSize, new Set(), seed)).toBe(territory);
  });
});

describe("isWithinActiveTowerClaim", () => {
  const tweaks = loadRealTweaks();
  const gridSize = 128;
  const seed = 3;
  const grassland = findTerrain(seed, "grassland", { q: 20, r: 20 });

  function makeTower(overrides: Partial<Tower> = {}): Tower {
    return {
      coord: grassland,
      level: 1,
      totalInvested: {},
      upgrade: null,
      buildCost: {},
      damaged: false,
      ...overrides,
    };
  }

  it("is true for a coord inside a healthy tower's range", () => {
    const tower = makeTower({ level: 3 });
    const inRange = axialSpiral(tower.coord, towerRange(tweaks, tower.level, terrainAt(seed, tower.coord)))[1]!;
    expect(isWithinActiveTowerClaim(tweaks, [tower], inRange, gridSize, seed)).toBe(true);
  });

  it("is false when only a damaged tower could cover the coord", () => {
    const tower = makeTower({ damaged: true });
    expect(isWithinActiveTowerClaim(tweaks, [tower], tower.coord, gridSize, seed)).toBe(false);
  });
});

describe("canRepairHordeDamagedTile", () => {
  const tweaks = loadRealTweaks();
  const gridSize = 128;
  const seed = 3;
  const grassland = findTerrain(seed, "grassland", { q: 20, r: 20 });
  const tower: Tower = {
    coord: grassland,
    level: 3,
    totalInvested: {},
    upgrade: null,
    buildCost: {},
    damaged: false,
  };

  it("is true for owned tiles and for unowned tiles inside an active tower viewshed", () => {
    const inRange = axialSpiral(tower.coord, towerRange(tweaks, tower.level, terrainAt(seed, tower.coord)))[1]!;
    const territory: TerritoryRecord = { base: { q: 0, r: 0 }, owned: [] };
    expect(canRepairHordeDamagedTile(tweaks, [tower], territory, inRange, gridSize, seed)).toBe(true);
    expect(canRepairHordeDamagedTile(tweaks, [tower], { ...territory, owned: [inRange] }, inRange, gridSize, seed)).toBe(true);
  });
});
