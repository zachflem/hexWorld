import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import type { DockRecord } from "../data/docks";
import type { ResourceAmounts } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";
import { accrueDockResources, collectDock, dockBuildCost, dockBuildDurationMs, dockYieldPerSecond } from "./docks";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
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

describe("dockBuildCost", () => {
  it("applies linear (not Formula A) build-count scaling to the wood base cost", () => {
    const tweaks = loadRealTweaks();
    const base = tweaks.docks.build_cost_base.wood;
    expect(dockBuildCost(tweaks, 1).wood).toBeCloseTo(base);
    expect(dockBuildCost(tweaks, 2).wood).toBeCloseTo(base * 1.1);
    // Diverges hugely from Formula A's compounding by n=13: linear stays a
    // gentle multiple of base, Formula A would've compounded to ~62,000 wood.
    expect(dockBuildCost(tweaks, 13).wood).toBeCloseTo(base * (1 + 0.1 * 12));
  });
});

describe("dockBuildDurationMs", () => {
  it("is docks.build_time_minutes in milliseconds", () => {
    const tweaks = loadRealTweaks();
    expect(dockBuildDurationMs(tweaks)).toBe(tweaks.docks.build_time_minutes * 60_000);
  });
});

describe("dockYieldPerSecond", () => {
  it("is yield_multiplier_vs_food_tile of the food extraction tile's base rate, without a fishing boat", () => {
    const tweaks = loadRealTweaks();
    const foodBase = tweaks.extraction_tiles.food.small_yield_per_tick / tweaks.game.tick_interval_seconds;
    expect(dockYieldPerSecond(tweaks, dock())).toBeCloseTo(foodBase * tweaks.docks.yield_multiplier_vs_food_tile);
  });

  it("multiplies by fishing_boat.yield_bonus_multiplier once a fishing boat is built", () => {
    const tweaks = loadRealTweaks();
    const withoutBoat = dockYieldPerSecond(tweaks, dock());
    const withBoat = dockYieldPerSecond(tweaks, dock({ fishingBoat: true }));
    expect(withBoat).toBeCloseTo(withoutBoat * tweaks.docks.fishing_boat.yield_bonus_multiplier);
  });
});

describe("accrueDockResources", () => {
  it("deposits produced food straight into base resources when room is available, unlike an unconnected extraction tile", () => {
    const tweaks = loadRealTweaks();
    const rate = dockYieldPerSecond(tweaks, dock());

    const result = accrueDockResources(tweaks, [dock()], NO_RESOURCES, 10, ALL_L1_STORAGE);

    expect(result.resources.food).toBeCloseTo(rate * 10);
    expect(result.docks[0].stockpile).toBeCloseTo(0);
  });

  it("caps the local stockpile at storage.capacity_base_per_resource when base storage is full and nothing can drain", () => {
    const tweaks = loadRealTweaks();
    const cap = tweaks.storage.capacity_base_per_resource;
    const fullStorage: ResourceAmounts = { ...NO_RESOURCES, food: cap };

    const result = accrueDockResources(tweaks, [dock()], fullStorage, 100_000, ALL_L1_STORAGE);

    expect(result.docks[0].stockpile).toBe(cap);
    expect(result.resources.food).toBe(cap);
  });

  it("deposits straight to base food storage every tick, no path connection required", () => {
    const tweaks = loadRealTweaks();
    const rate = dockYieldPerSecond(tweaks, dock({ stockpile: 50 }));

    const result = accrueDockResources(tweaks, [dock({ stockpile: 50 })], NO_RESOURCES, 1, ALL_L1_STORAGE);

    expect(result.resources.food).toBeCloseTo(50 + rate);
    expect(result.docks[0].stockpile).toBeCloseTo(0);
  });

  it("never deposits more than the room left at base's storage cap", () => {
    const tweaks = loadRealTweaks();
    const cap = tweaks.storage.capacity_base_per_resource;
    const resources: ResourceAmounts = { ...NO_RESOURCES, food: cap - 10 };

    const result = accrueDockResources(tweaks, [dock({ stockpile: cap })], resources, 1, ALL_L1_STORAGE);

    expect(result.resources.food).toBe(cap);
    expect(result.docks[0].stockpile).toBeCloseTo(cap - 10);
  });

  it("is a no-op for zero or negative elapsed time, or no docks", () => {
    const tweaks = loadRealTweaks();
    const docks = [dock({ stockpile: 12 })];

    const result = accrueDockResources(tweaks, docks, NO_RESOURCES, 0, ALL_L1_STORAGE);
    expect(result.resources).toEqual(NO_RESOURCES);
    expect(result.docks).toEqual(docks);

    const emptyResult = accrueDockResources(tweaks, [], NO_RESOURCES, 10, ALL_L1_STORAGE);
    expect(emptyResult.docks).toEqual([]);
  });

  it("yields nothing for a dock still under construction", () => {
    const tweaks = loadRealTweaks();
    const underConstruction = dock({ buildStartedAt: 1000 });

    const result = accrueDockResources(tweaks, [underConstruction], NO_RESOURCES, 100, ALL_L1_STORAGE);

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
