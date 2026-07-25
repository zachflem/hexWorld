import type { DockRecord } from "../data/docks";
import { MAX_DOCK_LEVEL } from "../data/docks";
import type { ResourceAmounts, ResourceType } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";
import type { TerritoryRecord } from "../data/territory";
import type { Tweaks } from "../data/tweaksSchema";
import type { Axial } from "./hexCoords";
import { linearBuildCost } from "./formulas";
import { storageCapacity } from "./storage";
import { advanceCourierSite, structureHasCourierAutomation } from "./couriers";

/**
 * Linear (not Formula A) build-count cost — same reasoning as
 * walls.slot_cost/wallBuildCost. See TWEAKS.md.
 */
export function dockBuildCost(tweaks: Tweaks, n: number): Record<string, number> {
  const cost: Record<string, number> = {};
  for (const [res, amount] of Object.entries(tweaks.docks.build_cost_base)) {
    cost[res] = linearBuildCost(amount, n);
  }
  return cost;
}

export function dockBuildDurationMs(tweaks: Tweaks): number {
  return tweaks.docks.build_time_minutes * 60_000;
}

/** Effective dock level — legacy fishingBoat without level counts as L3. */
export function dockLevel(dock: DockRecord): number {
  if (dock.level != null) return dock.level;
  if (dock.fishingBoat) return 3;
  return 1;
}

export function nextDockLevel(level: number): number | null {
  return level < MAX_DOCK_LEVEL ? level + 1 : null;
}

export function dockUpgradeCost(
  tweaks: Tweaks,
  targetLevel: 2 | 3,
): Partial<Record<ResourceType, number>> {
  return { ...tweaks.docks.level_upgrades[String(targetLevel) as "2" | "3"].cost };
}

export function dockUpgradeDurationMs(tweaks: Tweaks, targetLevel: 2 | 3): number {
  return tweaks.docks.level_upgrades[String(targetLevel) as "2" | "3"].build_time_minutes * 60_000;
}

/**
 * Food generated per real second by one dock. L3+ applies the legacy fishing-boat
 * yield bonus. Not also scaled by transition_tiles.yield_multiplier.
 */
export function dockYieldPerSecond(tweaks: Tweaks, dock: DockRecord): number {
  const base = tweaks.extraction_tiles.food.small_yield_per_tick / tweaks.game.tick_interval_seconds;
  const level = dockLevel(dock);
  const productionMultiplier =
    level >= 3 || dock.fishingBoat ? tweaks.docks.fishing_boat.yield_bonus_multiplier : 1;
  return base * tweaks.docks.yield_multiplier_vs_food_tile * productionMultiplier;
}

/**
 * Accrue dock yield into local stockpile; L2+ runs implied courier to base.
 * L1 docks are manual-collect only (Milestone 26).
 */
export function accrueDockResources(
  tweaks: Tweaks,
  docks: DockRecord[],
  resources: ResourceAmounts,
  elapsedSeconds: number,
  storageLevels: StorageLevels,
  now: number,
  seed: number,
  baseCoord: Axial,
  territory: TerritoryRecord,
  scoutedTiles: Axial[],
  gridSize: number,
): { resources: ResourceAmounts; docks: DockRecord[] } {
  if (elapsedSeconds <= 0 || docks.length === 0) return { resources, docks };

  const tileStockpileCap = tweaks.storage.capacity_base_per_resource;
  let nextResources = { ...resources };

  const nextDocks = docks.map((dock) => {
    if (dock.buildStartedAt != null) return dock;
    const rate = dockYieldPerSecond(tweaks, dock);
    let stockpile = Math.min(tileStockpileCap, dock.stockpile + rate * elapsedSeconds);

    const { site, resources: afterCourier } = advanceCourierSite(
      tweaks,
      seed,
      dock.coord,
      "food",
      { stockpile, courier: dock.courier },
      nextResources,
      storageLevels,
      now,
      baseCoord,
      territory,
      scoutedTiles,
      gridSize,
      structureHasCourierAutomation(dockLevel(dock)),
    );
    nextResources = afterCourier;
    return { ...dock, stockpile: site.stockpile, courier: site.courier };
  });

  return { resources: nextResources, docks: nextDocks };
}

/** Manual collection: instantly moves a dock's entire local stockpile to base food storage, capped there. */
export function collectDock(
  tweaks: Tweaks,
  dock: DockRecord,
  resources: ResourceAmounts,
  storageLevels: StorageLevels,
): { resources: ResourceAmounts; dock: DockRecord } {
  const baseCap = storageCapacity(tweaks, storageLevels.food);
  const roomAtBase = Math.max(0, baseCap - resources.food);
  const transferred = Math.min(dock.stockpile, roomAtBase);

  return {
    resources: { ...resources, food: resources.food + transferred },
    dock: { ...dock, stockpile: dock.stockpile - transferred },
  };
}
