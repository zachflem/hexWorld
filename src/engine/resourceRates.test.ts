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
import type { DockRecord } from "../data/docks";
import type { ResourceAmounts } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";
import type { TerritoryRecord } from "../data/territory";
import { initialUnits, type UnitsRecord } from "../data/units";
import type { PowerNetworkSnapshot } from "./power";

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

function dock(overrides: Partial<DockRecord> = {}): DockRecord {
  return {
    coord: { q: 0, r: 0 },
    buildStartedAt: null,
    stockpile: 0,
    level: 1,
    fishingBoat: false,
    fishingBoatUpgrade: null,
    totalInvested: {},
    buildCost: {},
    ...overrides,
  };
}

const ALL_L1_STORAGE: StorageLevels = { food: 1, wood: 1, stone: 1, steel: 1 };
const NO_RESOURCES: ResourceAmounts = { food: 0, wood: 0, stone: 0, steel: 0 };
const NO_UNITS: UnitsRecord = initialUnits();
const BASE: Axial = { q: 0, r: 0 };
const GRID = 32;

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

function ownedTerritory(...coords: Axial[]): TerritoryRecord {
  const owned = [BASE, ...coords.filter((c) => !axialEquals(c, BASE))];
  return { base: BASE, owned };
}

function rates(
  tweaks: ReturnType<typeof loadRealTweaks>,
  tiles: ExtractionTile[],
  docks: DockRecord[],
  resources: ResourceAmounts,
  units: UnitsRecord,
  seed: number,
  territory: TerritoryRecord,
) {
  return computeResourceRates(
    tweaks,
    tiles,
    docks,
    resources,
    ALL_L1_STORAGE,
    units,
    seed,
    UNLIMITED_POWER,
    BASE,
    territory,
    [],
    GRID,
  );
}

function foodYieldAt(tweaks: ReturnType<typeof loadRealTweaks>, seed: number, coord: Axial, tier: "small" | "mid" = "mid"): number {
  return yieldPerSecond(tweaks, extractionTile({ coord, resource: "food", tier }), seed);
}

describe("computeResourceRates", () => {
  it("credits nothing for an L1 tile (manual only)", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const coord = findCoord(seed, false, axialSpiral(BASE, 30));
    const tiles: ExtractionTile[] = [extractionTile({ coord, resource: "food", tier: "small" })];

    expect(rates(tweaks, tiles, [], NO_RESOURCES, NO_UNITS, seed, ownedTerritory(coord)).food).toBe(0);
  });

  it("credits full yield for an L2 tile with a route to base", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const tileCoord = axialNeighbors(BASE)[0];
    const tiles: ExtractionTile[] = [extractionTile({ coord: tileCoord, resource: "food", tier: "mid" })];

    expect(rates(tweaks, tiles, [], NO_RESOURCES, NO_UNITS, seed, ownedTerritory(tileCoord)).food).toBeCloseTo(
      foodYieldAt(tweaks, seed, tileCoord, "mid"),
    );
  });

  it("credits nothing for an extraction tile still under construction", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const tileCoord = axialNeighbors(BASE)[0];
    const tiles: ExtractionTile[] = [
      extractionTile({ coord: tileCoord, resource: "food", tier: "mid", buildStartedAt: 0 }),
    ];

    expect(rates(tweaks, tiles, [], NO_RESOURCES, NO_UNITS, seed, ownedTerritory(tileCoord)).food).toBe(0);
  });

  it("includes a finished L2 dock's food yield, but not L1 or under construction", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const coord = axialNeighbors(BASE)[0];
    const territory = ownedTerritory(coord);
    const finishedRate = dockYieldPerSecond(tweaks, dock({ coord, level: 2 }));

    expect(rates(tweaks, [], [dock({ coord, level: 2 })], NO_RESOURCES, NO_UNITS, seed, territory).food).toBeCloseTo(
      finishedRate,
    );
    expect(rates(tweaks, [], [dock({ coord, level: 1 })], NO_RESOURCES, NO_UNITS, seed, territory).food).toBe(0);
    expect(
      rates(tweaks, [], [dock({ coord, level: 2, buildStartedAt: 1000 })], NO_RESOURCES, NO_UNITS, seed, territory).food,
    ).toBe(0);
  });

  it("zeroes a resource's rate once it's already at storage cap", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const cap = tweaks.storage.capacity_base_per_resource;
    const tileCoord = axialNeighbors(BASE)[0];
    const tiles: ExtractionTile[] = [extractionTile({ coord: tileCoord, resource: "food", tier: "mid" })];
    const fullResources: ResourceAmounts = { ...NO_RESOURCES, food: cap };

    expect(rates(tweaks, tiles, [], fullResources, NO_UNITS, seed, ownedTerritory(tileCoord)).food).toBe(0);
  });

  it("subtracts standing-unit food upkeep from the food rate", () => {
    const tweaks = loadRealTweaks();
    const units: UnitsRecord = { ...initialUnits(), militiaCount: 10 };

    const result = rates(tweaks, [], [], NO_RESOURCES, units, 1, ownedTerritory());
    expect(result.food).toBeCloseTo(-totalUpkeepPerSecond(tweaks, units));
    expect(result.wood).toBe(0);
  });

  it("upkeep still applies when food is at storage cap", () => {
    const tweaks = loadRealTweaks();
    const cap = tweaks.storage.capacity_base_per_resource;
    const units: UnitsRecord = { ...initialUnits(), militiaCount: 10 };
    const fullResources: ResourceAmounts = { ...NO_RESOURCES, food: cap };

    expect(rates(tweaks, [], [], fullResources, units, 1, ownedTerritory()).food).toBeCloseTo(
      -totalUpkeepPerSecond(tweaks, units),
    );
  });

  it("a damaged tile contributes nothing", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const tileCoord = axialNeighbors(BASE)[0];
    const tiles: ExtractionTile[] = [
      extractionTile({ coord: tileCoord, resource: "food", tier: "mid", damaged: true }),
    ];

    expect(rates(tweaks, tiles, [], NO_RESOURCES, NO_UNITS, seed, ownedTerritory(tileCoord)).food).toBe(0);
  });
});
