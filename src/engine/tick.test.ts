import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import { accrueResources, collectTile, yieldPerSecond } from "./tick";
import { axialEquals, axialNeighbors, axialSpiral, type Axial } from "./hexCoords";
import { isTransitionTile, terrainAt, type TerrainType } from "./terrain";
import type { ExtractionTile } from "../data/extractionTiles";
import type { ResourceAmounts } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";
import type { TerritoryRecord } from "../data/territory";
import type { PowerNetworkSnapshot } from "./power";
import { courierOneWayDurationMs } from "./couriers";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/profiles/default/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

function extractionTile(overrides: Partial<ExtractionTile> = {}): ExtractionTile {
  return {
    coord: { q: 0, r: 0 },
    resource: "food",
    tier: "small",
    stockpile: 0,
    totalInvested: {},
    upgrade: null,
    buildCost: {},
    damaged: false,
    ...overrides,
  };
}

const ALL_L1_STORAGE: StorageLevels = { food: 1, wood: 1, stone: 1, steel: 1 };
const NO_RESOURCES: ResourceAmounts = { food: 0, wood: 0, stone: 0, steel: 0 };
const BASE: Axial = { q: 0, r: 0 };
const GRID = 32;

/** Every tile always reads as powered, regardless of coord — these tests aren't about power. */
class AlwaysPoweredSet extends Set<string> {
  override has(): boolean {
    return true;
  }
}

const UNLIMITED_POWER: PowerNetworkSnapshot = {
  poweredTiles: new AlwaysPoweredSet(),
  totalCapacity: 1e9,
  totalDraw: 0,
  factor: 1,
  cutoff: 0.25,
};

function findCoord(seed: number, wantTransition: boolean, candidates: Axial[], terrain?: TerrainType): Axial {
  const coord = candidates.find(
    (c) => isTransitionTile(seed, c) === wantTransition && (terrain === undefined || terrainAt(seed, c) === terrain),
  );
  if (!coord) throw new Error("no matching coord found in sample area");
  return coord;
}

function foodYieldAt(tweaks: ReturnType<typeof loadRealTweaks>, seed: number, coord: Axial): number {
  return yieldPerSecond(tweaks, extractionTile({ coord, resource: "food", tier: "small" }), seed);
}

function ownedTerritory(...coords: Axial[]): TerritoryRecord {
  const owned = [BASE, ...coords.filter((c) => !axialEquals(c, BASE))];
  return { base: BASE, owned };
}

function accrue(
  tweaks: ReturnType<typeof loadRealTweaks>,
  tiles: ExtractionTile[],
  elapsedSeconds: number,
  seed: number,
  resources: ResourceAmounts,
  now: number,
  territory: TerritoryRecord,
  scouted: Axial[] = [],
) {
  return accrueResources(
    tweaks,
    tiles,
    elapsedSeconds,
    seed,
    resources,
    ALL_L1_STORAGE,
    UNLIMITED_POWER,
    now,
    BASE,
    territory,
    scouted,
    GRID,
    {},
  );
}

describe("yieldPerSecond", () => {
  it("divides the tile's per-tick yield by the tick interval, for a small-tier food tile on its terrain-neutral forest", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const coord = findCoord(seed, false, axialSpiral(BASE, 30), "forest");
    const foodTile = extractionTile({ coord, resource: "food", tier: "small" });
    expect(yieldPerSecond(tweaks, foodTile, seed)).toBeCloseTo(2.2);
  });

  it("scales by the tier multiplier (1.5^tier_index)", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const coord = findCoord(seed, false, axialSpiral(BASE, 30));
    const small = yieldPerSecond(tweaks, extractionTile({ coord, resource: "food", tier: "small" }), seed);
    const mid = yieldPerSecond(tweaks, extractionTile({ coord, resource: "food", tier: "mid" }), seed);
    expect(mid).toBeCloseTo(small * 1.5);
  });

  it("buffs food on grassland and penalizes it on mountain, relative to its neutral forest rate", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const forestCoord = findCoord(seed, false, axialSpiral(BASE, 40), "forest");
    const grasslandCoord = findCoord(seed, false, axialSpiral(BASE, 40), "grassland");
    const mountainCoord = findCoord(seed, false, axialSpiral(BASE, 40), "mountain");
    const neutral = yieldPerSecond(tweaks, extractionTile({ coord: forestCoord, resource: "food", tier: "small" }), seed);
    const onGrassland = yieldPerSecond(tweaks, extractionTile({ coord: grasslandCoord, resource: "food", tier: "small" }), seed);
    const onMountain = yieldPerSecond(tweaks, extractionTile({ coord: mountainCoord, resource: "food", tier: "small" }), seed);
    const multiplier = tweaks.extraction_tiles.terrain_yield_multiplier;
    expect(onGrassland).toBeCloseTo(neutral * multiplier.food.grassland);
    expect(onMountain).toBeCloseTo(neutral * multiplier.food.mountain);
    expect(onGrassland).toBeGreaterThan(neutral);
    expect(onMountain).toBeLessThan(neutral);
  });

  it("buffs stone on mountain and penalizes it on grassland — the inverse of food's terrain preference", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const grasslandCoord = findCoord(seed, false, axialSpiral(BASE, 40), "grassland");
    const mountainCoord = findCoord(seed, false, axialSpiral(BASE, 40), "mountain");
    const onGrassland = yieldPerSecond(tweaks, extractionTile({ coord: grasslandCoord, resource: "stone", tier: "small" }), seed);
    const onMountain = yieldPerSecond(tweaks, extractionTile({ coord: mountainCoord, resource: "stone", tier: "small" }), seed);
    expect(onMountain).toBeGreaterThan(onGrassland);
  });

  it("buffs wood on forest and penalizes it on mountain", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const forestCoord = findCoord(seed, false, axialSpiral(BASE, 40), "forest");
    const mountainCoord = findCoord(seed, false, axialSpiral(BASE, 40), "mountain");
    const onForest = yieldPerSecond(tweaks, extractionTile({ coord: forestCoord, resource: "wood", tier: "small" }), seed);
    const onMountain = yieldPerSecond(tweaks, extractionTile({ coord: mountainCoord, resource: "wood", tier: "small" }), seed);
    expect(onForest).toBeGreaterThan(onMountain);
  });

  it("halves yield on a transition tile", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const coord = findCoord(seed, true, axialSpiral(BASE, 30), "forest");
    const onBorder = yieldPerSecond(tweaks, extractionTile({ coord, resource: "food", tier: "small" }), seed);
    expect(onBorder).toBeCloseTo(2.2 * 0.5);
  });
});

describe("accrueResources", () => {
  it("L1 accumulates into the tile stockpile only — no auto delivery", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const coord = findCoord(seed, false, axialSpiral(BASE, 30));
    const tiles: ExtractionTile[] = [extractionTile({ coord, resource: "food", tier: "small" })];
    const territory = ownedTerritory(coord);

    const result = accrue(tweaks, tiles, 10, seed, NO_RESOURCES, 10_000, territory);

    expect(result.resources.food).toBe(0);
    expect(result.tiles[0].stockpile).toBeCloseTo(foodYieldAt(tweaks, seed, coord) * 10);
    expect(result.tiles[0].courier).toBeNull();
  });

  it("a damaged tile produces nothing and its existing stockpile stays frozen", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const tileCoord = axialNeighbors(BASE)[0];
    const tiles: ExtractionTile[] = [
      extractionTile({ coord: tileCoord, resource: "food", tier: "mid", stockpile: 50, damaged: true }),
    ];

    const result = accrue(tweaks, tiles, 10, seed, NO_RESOURCES, 10_000, ownedTerritory(tileCoord));

    expect(result.tiles[0].stockpile).toBe(50);
    expect(result.resources.food).toBe(0);
  });

  it("a tile still under construction produces nothing, including when buildStartedAt is 0", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const coord = findCoord(seed, false, axialSpiral(BASE, 30));
    const tiles: ExtractionTile[] = [
      extractionTile({ coord, resource: "food", tier: "small", stockpile: 0, buildStartedAt: 0 }),
    ];

    const result = accrue(tweaks, tiles, 60, seed, NO_RESOURCES, 60_000, ownedTerritory(coord));

    expect(result.tiles[0].stockpile).toBe(0);
    expect(result.resources.food).toBe(0);
  });

  it("caps the local stockpile at storage.capacity_base_per_resource", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const coord = findCoord(seed, false, axialSpiral(BASE, 30));
    const tiles: ExtractionTile[] = [extractionTile({ coord, resource: "food", tier: "small" })];

    const result = accrue(tweaks, tiles, 100_000, seed, NO_RESOURCES, 100_000_000, ownedTerritory(coord));

    expect(result.tiles[0].stockpile).toBe(tweaks.storage.capacity_base_per_resource);
  });

  it("L2 courier picks up stockpile and delivers after one-way travel time", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const tileCoord = axialNeighbors(BASE)[0];
    const territory = ownedTerritory(tileCoord);
    const oneWay = courierOneWayDurationMs(tweaks, seed, tileCoord, BASE, territory, [], GRID);
    expect(oneWay).toBeGreaterThan(0);

    const tiles: ExtractionTile[] = [
      extractionTile({ coord: tileCoord, resource: "food", tier: "mid", stockpile: 50 }),
    ];

    const started = accrue(tweaks, tiles, 1, seed, NO_RESOURCES, 1_000, territory);
    expect(started.resources.food).toBe(0);
    expect(started.tiles[0].courier?.phase).toBe("toBase");
    expect(started.tiles[0].courier?.cargo).toBeGreaterThan(0);
    const cargo = started.tiles[0].courier!.cargo;
    expect(started.tiles[0].stockpile).toBeLessThan(50);

    const delivered = accrue(
      tweaks,
      started.tiles,
      0.001,
      seed,
      started.resources,
      started.tiles[0].courier!.arriveAt,
      territory,
    );
    expect(delivered.resources.food).toBeCloseTo(cargo);
    expect(delivered.tiles[0].courier?.phase).toBe("returning");
  });

  it("does nothing for zero or negative elapsed time", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const coord = findCoord(seed, false, axialSpiral(BASE, 30));
    const tiles: ExtractionTile[] = [extractionTile({ coord, resource: "food", tier: "small", stockpile: 12 })];

    const result = accrue(tweaks, tiles, 0, seed, NO_RESOURCES, 0, ownedTerritory(coord));

    expect(result.resources).toBe(NO_RESOURCES);
    expect(result.tiles).toEqual(tiles);
  });
});

describe("collectTile", () => {
  it("moves the whole stockpile to the shared pool", () => {
    const tweaks = loadRealTweaks();
    const tile = extractionTile({ coord: { q: 1, r: 0 }, resource: "food", tier: "small", stockpile: 40 });

    const result = collectTile(tweaks, tile, NO_RESOURCES, ALL_L1_STORAGE);

    expect(result.resources.food).toBe(40);
    expect(result.tile.stockpile).toBe(0);
  });

  it("only collects up to the room left at the storage cap", () => {
    const tweaks = loadRealTweaks();
    const cap = tweaks.storage.capacity_base_per_resource;
    const tile = extractionTile({ coord: { q: 1, r: 0 }, resource: "food", tier: "small", stockpile: 40 });
    const resources: ResourceAmounts = { ...NO_RESOURCES, food: cap - 20 };

    const result = collectTile(tweaks, tile, resources, ALL_L1_STORAGE);

    expect(result.resources.food).toBe(cap);
    expect(result.tile.stockpile).toBe(20);
  });
});
