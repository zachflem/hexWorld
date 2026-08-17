import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import type { DockRecord } from "../data/docks";
import type { ResourceAmounts } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";
import type { TerritoryRecord } from "../data/territory";
import { axialNeighbors, type Axial } from "./hexCoords";
import {
  accrueDockResources,
  collectDock,
  dockBuildCost,
  dockBuildDurationMs,
  dockLevel,
  dockUpgradeCost,
  dockYieldPerSecond,
  nextDockLevel,
} from "./docks";
import { courierOneWayDurationMs } from "./couriers";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/profiles/default/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
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

const ALL_L1_STORAGE: StorageLevels = { food: 1, wood: 1, stone: 1, steel: 1 };
const NO_RESOURCES: ResourceAmounts = { food: 0, wood: 0, stone: 0, steel: 0 };
const BASE: Axial = { q: 0, r: 0 };
const GRID = 32;

function territory(...coords: Axial[]): TerritoryRecord {
  return { base: BASE, owned: [BASE, ...coords] };
}

function accrue(
  tweaks: ReturnType<typeof loadRealTweaks>,
  docks: DockRecord[],
  resources: ResourceAmounts,
  elapsed: number,
  now: number,
  terr: TerritoryRecord,
  seed = 1,
) {
  return accrueDockResources(
    tweaks,
    docks,
    resources,
    elapsed,
    ALL_L1_STORAGE,
    now,
    seed,
    BASE,
    terr,
    [],
    GRID,
    {},
  );
}

describe("dockBuildCost", () => {
  it("applies linear (not Formula A) build-count scaling to the wood base cost", () => {
    const tweaks = loadRealTweaks();
    const base = tweaks.docks.build_cost_base.wood;
    expect(dockBuildCost(tweaks, 1).wood).toBeCloseTo(base);
    expect(dockBuildCost(tweaks, 2).wood).toBeCloseTo(base * 1.1);
    expect(dockBuildCost(tweaks, 13).wood).toBeCloseTo(base * (1 + 0.1 * 12));
  });
});

describe("dockBuildDurationMs", () => {
  it("is docks.build_time_minutes in milliseconds", () => {
    const tweaks = loadRealTweaks();
    expect(dockBuildDurationMs(tweaks)).toBe(tweaks.docks.build_time_minutes * 60_000);
  });
});

describe("dock levels", () => {
  it("infers L3 from legacy fishingBoat when level is absent", () => {
    expect(dockLevel(dock({ fishingBoat: true }))).toBe(3);
    expect(dockLevel(dock({ level: 2 }))).toBe(2);
    expect(nextDockLevel(1)).toBe(2);
    expect(nextDockLevel(3)).toBeNull();
  });

  it("reads L2/L3 upgrade costs from tweaks.docks.level_upgrades", () => {
    const tweaks = loadRealTweaks();
    expect(dockUpgradeCost(tweaks, 2)).toEqual(tweaks.docks.level_upgrades["2"].cost);
    expect(dockUpgradeCost(tweaks, 3)).toEqual(tweaks.docks.level_upgrades["3"].cost);
  });
});

describe("dockYieldPerSecond", () => {
  it("is yield_multiplier_vs_food_tile of the food extraction tile's base rate, without a fishing boat", () => {
    const tweaks = loadRealTweaks();
    const foodBase = tweaks.extraction_tiles.food.small_yield_per_tick / tweaks.game.tick_interval_seconds;
    expect(dockYieldPerSecond(tweaks, dock())).toBeCloseTo(foodBase * tweaks.docks.yield_multiplier_vs_food_tile);
  });

  it("multiplies by fishing_boat.yield_bonus_multiplier at L3 (production upgrade)", () => {
    const tweaks = loadRealTweaks();
    const l1 = dockYieldPerSecond(tweaks, dock({ level: 1 }));
    const l3 = dockYieldPerSecond(tweaks, dock({ level: 3 }));
    expect(l3).toBeCloseTo(l1 * tweaks.docks.fishing_boat.yield_bonus_multiplier);
  });
});

describe("accrueDockResources", () => {
  it("L1 docks accumulate stockpile only — no auto delivery", () => {
    const tweaks = loadRealTweaks();
    const coord = axialNeighbors(BASE)[0];
    const rate = dockYieldPerSecond(tweaks, dock({ coord }));

    const result = accrue(tweaks, [dock({ coord, level: 1 })], NO_RESOURCES, 10, 10_000, territory(coord));

    expect(result.resources.food).toBe(0);
    expect(result.docks[0].stockpile).toBeCloseTo(rate * 10);
  });

  it("caps the local stockpile at storage.capacity_base_per_resource", () => {
    const tweaks = loadRealTweaks();
    const cap = tweaks.storage.capacity_base_per_resource;
    const fullStorage: ResourceAmounts = { ...NO_RESOURCES, food: cap };
    const coord = axialNeighbors(BASE)[0];

    const result = accrue(tweaks, [dock({ coord })], fullStorage, 100_000, 100_000_000, territory(coord));

    expect(result.docks[0].stockpile).toBe(cap);
    expect(result.resources.food).toBe(cap);
  });

  it("L2 courier delivers stockpile after one-way travel", () => {
    const tweaks = loadRealTweaks();
    const seed = 1;
    const coord = axialNeighbors(BASE)[0];
    const terr = territory(coord);
    const oneWay = courierOneWayDurationMs(tweaks, seed, coord, BASE, terr, [], GRID);
    expect(oneWay).toBeGreaterThan(0);

    const started = accrue(
      tweaks,
      [dock({ coord, level: 2, stockpile: 50 })],
      NO_RESOURCES,
      1,
      1_000,
      terr,
      seed,
    );
    expect(started.resources.food).toBe(0);
    expect(started.docks[0].courier?.phase).toBe("toBase");
    const cargo = started.docks[0].courier!.cargo;

    const delivered = accrue(
      tweaks,
      started.docks,
      started.resources,
      0.001,
      started.docks[0].courier!.arriveAt,
      terr,
      seed,
    );
    expect(delivered.resources.food).toBeCloseTo(cargo);
  });

  it("is a no-op for zero or negative elapsed time, or no docks", () => {
    const tweaks = loadRealTweaks();
    const docks = [dock({ stockpile: 12 })];

    const result = accrue(tweaks, docks, NO_RESOURCES, 0, 0, territory());
    expect(result.resources).toEqual(NO_RESOURCES);
    expect(result.docks).toEqual(docks);

    const emptyResult = accrue(tweaks, [], NO_RESOURCES, 10, 10_000, territory());
    expect(emptyResult.docks).toEqual([]);
  });

  it("yields nothing for a dock still under construction", () => {
    const tweaks = loadRealTweaks();
    const underConstruction = dock({ buildStartedAt: 1000 });

    const result = accrue(tweaks, [underConstruction], NO_RESOURCES, 100, 100_000, territory());

    expect(result.resources.food).toBe(0);
    expect(result.docks[0]).toEqual(underConstruction);
  });
});

describe("collectDock", () => {
  it("moves the whole stockpile to base food resources", () => {
    const tweaks = loadRealTweaks();
    const result = collectDock(tweaks, dock({ stockpile: 40 }), NO_RESOURCES, ALL_L1_STORAGE);
    expect(result.resources.food).toBe(40);
    expect(result.dock.stockpile).toBe(0);
  });

  it("only collects up to the room left at base's storage cap", () => {
    const tweaks = loadRealTweaks();
    const cap = tweaks.storage.capacity_base_per_resource;
    const resources: ResourceAmounts = { ...NO_RESOURCES, food: cap - 20 };

    const result = collectDock(tweaks, dock({ stockpile: 40 }), resources, ALL_L1_STORAGE);

    expect(result.resources.food).toBe(cap);
    expect(result.dock.stockpile).toBe(20);
  });
});
