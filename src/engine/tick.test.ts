import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import { accrueResources, collectTile, yieldPerSecond } from "./tick";
import { axialEquals, axialNeighbors, axialSpiral, type Axial } from "./hexCoords";
import { isTransitionTile, terrainAt, type TerrainType } from "./terrain";
import type { ExtractionTile } from "../data/extractionTiles";
import type { PathTile } from "../data/pathTiles";
import type { ResourceAmounts } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
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

function pathTile(overrides: Partial<PathTile> = {}): PathTile {
  return {
    coord: { q: 0, r: 0 },
    tier: "goat_track",
    totalInvested: {},
    upgrade: null,
    buildCost: {},
    damaged: false,
    ...overrides,
  };
}

const ALL_L1_STORAGE: StorageLevels = { food: 1, wood: 1, stone: 1, steel: 1, power: 1 };
const NO_RESOURCES: ResourceAmounts = { food: 0, wood: 0, stone: 0, steel: 0, power: 0 };
const BASE: Axial = { q: 0, r: 0 };

// `terrain`, if given, additionally requires that exact TerrainType — used by
// the terrain_yield_multiplier tests below. Omitted everywhere else (matches
// whatever terrain happens to be there — those tests compute their expected
// yield off the tile's actual terrain rather than assuming a fixed rate).
function findCoord(seed: number, wantTransition: boolean, candidates: Axial[], terrain?: TerrainType): Axial {
  const coord = candidates.find(
    (c) => isTransitionTile(seed, c) === wantTransition && (terrain === undefined || terrainAt(seed, c) === terrain),
  );
  if (!coord) throw new Error("no matching coord found in sample area");
  return coord;
}

/**
 * A path tile adjacent to base, and an extraction tile adjacent to that path
 * tile (2 hexes from base) — whatever terrain happens to be there (the
 * immediate 2-hex ring around base isn't guaranteed to contain every terrain
 * type, e.g. seed 1's is entirely grassland). Tests using this compute their
 * expected food yield via foodYieldAt below rather than assuming a fixed
 * 1.5/s rate, so they stay correct regardless of which terrain is found.
 */
function findConnectedPair(seed: number): { pathCoord: Axial; tileCoord: Axial } {
  const pathCoord = axialNeighbors(BASE)[0];
  const tileCoord = findCoord(
    seed,
    false,
    axialNeighbors(pathCoord).filter((c) => !axialEquals(c, BASE)),
  );
  return { pathCoord, tileCoord };
}

/** The real per-second food yield a small-tier tile at `coord` produces — accounts for terrain_yield_multiplier, so tests don't have to hardcode the terrain-neutral 1.5/s rate. */
function foodYieldAt(tweaks: ReturnType<typeof loadRealTweaks>, seed: number, coord: Axial): number {
  return yieldPerSecond(tweaks, extractionTile({ coord, resource: "food", tier: "small" }), seed);
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
  it("accumulates into the tile's own stockpile, not the shared pool, when unconnected", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const coord = findCoord(seed, false, axialSpiral(BASE, 30));
    const tiles: ExtractionTile[] = [extractionTile({ coord, resource: "food", tier: "small" })];

    const result = accrueResources(tweaks, tiles, [], 10, seed, NO_RESOURCES, ALL_L1_STORAGE, [BASE]);

    expect(result.resources.food).toBe(0);
    expect(result.tiles[0].stockpile).toBeCloseTo(foodYieldAt(tweaks, seed, coord) * 10);
  });

  it("a damaged tile produces nothing and its existing stockpile stays frozen", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const { pathCoord, tileCoord } = findConnectedPair(seed);
    const tiles: ExtractionTile[] = [
      extractionTile({ coord: tileCoord, resource: "food", tier: "small", stockpile: 50, damaged: true }),
    ];
    const pathTiles: PathTile[] = [pathTile({ coord: pathCoord, tier: "highway" })]; // would otherwise drain instantly

    const result = accrueResources(tweaks, tiles, pathTiles, 10, seed, NO_RESOURCES, ALL_L1_STORAGE, [BASE]);

    expect(result.tiles[0].stockpile).toBe(50); // untouched — no new yield, no drain
    expect(result.resources.food).toBe(0);
  });

  it("caps the local stockpile at storage.capacity_base_per_resource", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const coord = findCoord(seed, false, axialSpiral(BASE, 30));
    const tiles: ExtractionTile[] = [extractionTile({ coord, resource: "food", tier: "small" })];

    const result = accrueResources(tweaks, tiles, [], 100_000, seed, NO_RESOURCES, ALL_L1_STORAGE, [BASE]);

    expect(result.tiles[0].stockpile).toBe(tweaks.storage.capacity_base_per_resource);
  });

  it("drains a connected tile's stockpile to the shared pool at the path's transport rate", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const { pathCoord, tileCoord } = findConnectedPair(seed);
    const tiles: ExtractionTile[] = [
      extractionTile({ coord: tileCoord, resource: "food", tier: "small", stockpile: 50 }),
    ];
    const pathTiles: PathTile[] = [pathTile({ coord: pathCoord, tier: "goat_track" })];

    // goat_track rate multiplier is 0.5x yield, so 0.5x transport, over 1 second.
    const rate = foodYieldAt(tweaks, seed, tileCoord);
    const transported = rate * 0.5;
    const result = accrueResources(tweaks, tiles, pathTiles, 1, seed, NO_RESOURCES, ALL_L1_STORAGE, [BASE]);

    expect(result.resources.food).toBeCloseTo(transported);
    expect(result.tiles[0].stockpile).toBeCloseTo(50 + rate - transported);
  });

  it("a highway moves the entire stockpile in one tick (near-instant)", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const { pathCoord, tileCoord } = findConnectedPair(seed);
    const tiles: ExtractionTile[] = [
      extractionTile({ coord: tileCoord, resource: "food", tier: "small", stockpile: 50 }),
    ];
    const pathTiles: PathTile[] = [pathTile({ coord: pathCoord, tier: "highway" })];

    const result = accrueResources(tweaks, tiles, pathTiles, 1, seed, NO_RESOURCES, ALL_L1_STORAGE, [BASE]);

    expect(result.tiles[0].stockpile).toBeCloseTo(0);
    expect(result.resources.food).toBeCloseTo(50 + foodYieldAt(tweaks, seed, tileCoord));
  });

  it("never transports more than the room left at the shared storage cap", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const cap = tweaks.storage.capacity_base_per_resource;
    const { pathCoord, tileCoord } = findConnectedPair(seed);
    const tiles: ExtractionTile[] = [
      extractionTile({ coord: tileCoord, resource: "food", tier: "small", stockpile: cap }),
    ];
    const pathTiles: PathTile[] = [pathTile({ coord: pathCoord, tier: "highway" })];
    const resources: ResourceAmounts = { ...NO_RESOURCES, food: cap - 10 };

    const result = accrueResources(tweaks, tiles, pathTiles, 1, seed, resources, ALL_L1_STORAGE, [BASE]);

    // Tile stockpile was already at its own cap, so the tick's production is wasted;
    // only 10 units fit in the pool (cap-10 -> cap), so only 10 drain out of the stockpile.
    expect(result.resources.food).toBe(cap);
    expect(result.tiles[0].stockpile).toBeCloseTo(cap - 10);
  });

  it("does nothing for zero or negative elapsed time", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const coord = findCoord(seed, false, axialSpiral(BASE, 30));
    const tiles: ExtractionTile[] = [extractionTile({ coord, resource: "food", tier: "small", stockpile: 12 })];

    const result = accrueResources(tweaks, tiles, [], 0, seed, NO_RESOURCES, ALL_L1_STORAGE, [BASE]);

    expect(result.resources).toBe(NO_RESOURCES);
    expect(result.tiles).toEqual(tiles);
  });

  it("credits a tile connected to both base and an outpost only once — base, listed first, claims it", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const { pathCoord, tileCoord } = findConnectedPair(seed);
    const tiles: ExtractionTile[] = [
      extractionTile({ coord: tileCoord, resource: "food", tier: "small", stockpile: 50 }),
    ];
    const pathTiles: PathTile[] = [pathTile({ coord: pathCoord, tier: "highway" })];
    // An outpost sitting directly adjacent to the tile also connects to it
    // (same "no path tile needed for the first hop" rule as base itself,
    // engine/paths.ts:findResourceTileConnection) — but base, listed first,
    // must still win the claim, and the tile shouldn't drain twice.
    const outpostCoord = axialNeighbors(tileCoord).find((n) => !axialEquals(n, pathCoord) && !axialEquals(n, BASE));
    if (!outpostCoord) throw new Error("expected a free neighbor of tileCoord");

    const result = accrueResources(tweaks, tiles, pathTiles, 1, seed, NO_RESOURCES, ALL_L1_STORAGE, [
      BASE,
      outpostCoord,
    ]);

    expect(result.resources.food).toBeCloseTo(50 + foodYieldAt(tweaks, seed, tileCoord)); // claimed once (highway, near-instant), not doubled
  });

  it("credits a tile only reachable from an outpost through that outpost", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const { pathCoord, tileCoord } = findConnectedPair(seed);
    const tiles: ExtractionTile[] = [
      extractionTile({ coord: tileCoord, resource: "food", tier: "small", stockpile: 50 }),
    ];
    const pathTiles: PathTile[] = [pathTile({ coord: pathCoord, tier: "highway" })];
    // Far away from BASE, so base has no route to this tile — only the
    // outpost, sited right where the base would need to be, can claim it.
    const farAway: Axial = { q: 500, r: 500 };

    const result = accrueResources(tweaks, tiles, pathTiles, 1, seed, NO_RESOURCES, ALL_L1_STORAGE, [
      farAway,
      BASE,
    ]);

    expect(result.resources.food).toBeCloseTo(50 + foodYieldAt(tweaks, seed, tileCoord)); // base still connects via pathCoord/tileCoord as before
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
    const resources: ResourceAmounts = { ...NO_RESOURCES, food: cap - 20 }; // only 20 room left, less than the 40 stockpile

    const result = collectTile(tweaks, tile, resources, ALL_L1_STORAGE);

    expect(result.resources.food).toBe(cap);
    expect(result.tile.stockpile).toBe(20);
  });
});
