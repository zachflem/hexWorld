import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import { computeResourceRates } from "./resourceRates";
import { yieldPerSecond } from "./tick";
import { dockYieldPerSecond } from "./docks";
import { totalUpkeepPerSecond } from "./units";
import { axialEquals, axialNeighbors, axialSpiral, type Axial } from "./hexCoords";
import { isTransitionTile, terrainAt, type TerrainType } from "./terrain";
import type { ExtractionTile } from "../data/extractionTiles";
import type { PathTile } from "../data/pathTiles";
import type { DockRecord } from "../data/docks";
import type { ResourceAmounts } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";
import { initialUnits, type UnitsRecord } from "../data/units";

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

function dock(overrides: Partial<DockRecord> = {}): DockRecord {
  return {
    coord: { q: 0, r: 0 },
    buildStartedAt: null,
    stockpile: 0,
    fishingBoat: false,
    fishingBoatUpgrade: null,
    totalInvested: {},
    buildCost: {},
    ...overrides,
  };
}

const ALL_L1_STORAGE: StorageLevels = { food: 1, wood: 1, stone: 1, steel: 1, power: 1 };
const NO_RESOURCES: ResourceAmounts = { food: 0, wood: 0, stone: 0, steel: 0, power: 0 };
const NO_UNITS: UnitsRecord = initialUnits();
const BASE: Axial = { q: 0, r: 0 };

function findCoord(seed: number, wantTransition: boolean, candidates: Axial[], terrain?: TerrainType): Axial {
  const coord = candidates.find(
    (c) => isTransitionTile(seed, c) === wantTransition && (terrain === undefined || terrainAt(seed, c) === terrain),
  );
  if (!coord) throw new Error("no matching coord found in sample area");
  return coord;
}

function findConnectedPair(seed: number): { pathCoord: Axial; tileCoord: Axial } {
  const pathCoord = axialNeighbors(BASE)[0];
  const tileCoord = findCoord(
    seed,
    false,
    axialNeighbors(pathCoord).filter((c) => !axialEquals(c, BASE)),
  );
  return { pathCoord, tileCoord };
}

function foodYieldAt(tweaks: ReturnType<typeof loadRealTweaks>, seed: number, coord: Axial): number {
  return yieldPerSecond(tweaks, extractionTile({ coord, resource: "food", tier: "small" }), seed);
}

describe("computeResourceRates", () => {
  it("credits nothing for a tile with no path connection to any hub", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const coord = findCoord(seed, false, axialSpiral(BASE, 30));
    const tiles: ExtractionTile[] = [extractionTile({ coord, resource: "food", tier: "small" })];

    const rates = computeResourceRates(tweaks, tiles, [], [], [BASE], NO_RESOURCES, ALL_L1_STORAGE, NO_UNITS, seed);

    expect(rates.food).toBe(0);
  });

  it("a goat-track-connected tile delivers half its raw yield — the transport tier IS the bottleneck", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const { pathCoord, tileCoord } = findConnectedPair(seed);
    const tiles: ExtractionTile[] = [extractionTile({ coord: tileCoord, resource: "food", tier: "small" })];
    const pathTiles: PathTile[] = [pathTile({ coord: pathCoord, tier: "goat_track" })];

    const rates = computeResourceRates(tweaks, tiles, pathTiles, [], [BASE], NO_RESOURCES, ALL_L1_STORAGE, NO_UNITS, seed);

    expect(rates.food).toBeCloseTo(foodYieldAt(tweaks, seed, tileCoord) * 0.5);
  });

  it("a highway-connected tile delivers exactly its raw yield, NOT yield times the 1000x transport-capacity multiplier", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const { pathCoord, tileCoord } = findConnectedPair(seed);
    const tiles: ExtractionTile[] = [extractionTile({ coord: tileCoord, resource: "food", tier: "small" })];
    const pathTiles: PathTile[] = [pathTile({ coord: pathCoord, tier: "highway" })];

    const rates = computeResourceRates(tweaks, tiles, pathTiles, [], [BASE], NO_RESOURCES, ALL_L1_STORAGE, NO_UNITS, seed);

    // Production-limited: a tile can never hand off more per second than it produces per second,
    // regardless of how much spare transport capacity the path tier has.
    expect(rates.food).toBeCloseTo(foodYieldAt(tweaks, seed, tileCoord));
  });

  it("a stone-road-connected tile also delivers exactly its raw yield (2x capacity still isn't a rate multiplier)", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const { pathCoord, tileCoord } = findConnectedPair(seed);
    const tiles: ExtractionTile[] = [extractionTile({ coord: tileCoord, resource: "food", tier: "small" })];
    const pathTiles: PathTile[] = [pathTile({ coord: pathCoord, tier: "stone_road" })];

    const rates = computeResourceRates(tweaks, tiles, pathTiles, [], [BASE], NO_RESOURCES, ALL_L1_STORAGE, NO_UNITS, seed);

    expect(rates.food).toBeCloseTo(foodYieldAt(tweaks, seed, tileCoord));
  });

  it("credits a tile only reachable from an outpost, through that outpost's hub coord", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const { pathCoord, tileCoord } = findConnectedPair(seed);
    const tiles: ExtractionTile[] = [extractionTile({ coord: tileCoord, resource: "food", tier: "small" })];
    const pathTiles: PathTile[] = [pathTile({ coord: pathCoord, tier: "highway" })];
    const farAway: Axial = { q: 500, r: 500 }; // base has no route here — mirrors tick.test.ts's equivalent case

    const rates = computeResourceRates(
      tweaks,
      tiles,
      pathTiles,
      [],
      [farAway, BASE],
      NO_RESOURCES,
      ALL_L1_STORAGE,
      NO_UNITS,
      seed,
    );

    expect(rates.food).toBeCloseTo(foodYieldAt(tweaks, seed, tileCoord));
  });

  it("includes a finished dock's food yield, but not one still under construction", () => {
    const tweaks = loadRealTweaks();
    const finishedRate = dockYieldPerSecond(tweaks, dock());

    const finished = computeResourceRates(tweaks, [], [], [dock()], [BASE], NO_RESOURCES, ALL_L1_STORAGE, NO_UNITS, 1);
    expect(finished.food).toBeCloseTo(finishedRate);

    const underConstruction = computeResourceRates(
      tweaks,
      [],
      [],
      [dock({ buildStartedAt: 1000 })],
      [BASE],
      NO_RESOURCES,
      ALL_L1_STORAGE,
      NO_UNITS,
      1,
    );
    expect(underConstruction.food).toBe(0);
  });

  it("zeroes a resource's rate once it's already at (or above) its storage cap, even with an active connected tile", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const cap = tweaks.storage.capacity_base_per_resource;
    const { pathCoord, tileCoord } = findConnectedPair(seed);
    const tiles: ExtractionTile[] = [extractionTile({ coord: tileCoord, resource: "food", tier: "small" })];
    const pathTiles: PathTile[] = [pathTile({ coord: pathCoord, tier: "highway" })];
    const fullResources: ResourceAmounts = { ...NO_RESOURCES, food: cap };

    const rates = computeResourceRates(tweaks, tiles, pathTiles, [], [BASE], fullResources, ALL_L1_STORAGE, NO_UNITS, seed);

    expect(rates.food).toBe(0);
  });

  it("subtracts standing-unit food upkeep from the food rate, leaving other resources untouched", () => {
    const tweaks = loadRealTweaks();
    const units: UnitsRecord = { ...initialUnits(), militiaCount: 10 };

    const rates = computeResourceRates(tweaks, [], [], [], [BASE], NO_RESOURCES, ALL_L1_STORAGE, units, 1);

    expect(rates.food).toBeCloseTo(-totalUpkeepPerSecond(tweaks, units));
    expect(rates.wood).toBe(0);
    expect(rates.stone).toBe(0);
    expect(rates.steel).toBe(0);
    expect(rates.power).toBe(0);
  });

  it("upkeep still applies even when food is already at storage cap — upkeep isn't blocked by the inflow clamp", () => {
    const tweaks = loadRealTweaks();
    const cap = tweaks.storage.capacity_base_per_resource;
    const units: UnitsRecord = { ...initialUnits(), militiaCount: 10 };
    const fullResources: ResourceAmounts = { ...NO_RESOURCES, food: cap };

    const rates = computeResourceRates(tweaks, [], [], [], [BASE], fullResources, ALL_L1_STORAGE, units, 1);

    expect(rates.food).toBeCloseTo(-totalUpkeepPerSecond(tweaks, units));
  });

  it("a damaged tile contributes nothing, connected or not", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const { pathCoord, tileCoord } = findConnectedPair(seed);
    const tiles: ExtractionTile[] = [
      extractionTile({ coord: tileCoord, resource: "food", tier: "small", damaged: true }),
    ];
    const pathTiles: PathTile[] = [pathTile({ coord: pathCoord, tier: "highway" })];

    const rates = computeResourceRates(tweaks, tiles, pathTiles, [], [BASE], NO_RESOURCES, ALL_L1_STORAGE, NO_UNITS, seed);

    expect(rates.food).toBe(0);
  });
});
