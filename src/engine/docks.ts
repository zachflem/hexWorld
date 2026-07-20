import type { DockRecord } from "../data/docks";
import type { ResourceAmounts } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";
import type { Tweaks } from "../data/tweaksSchema";
import { storageCapacity } from "./storage";

/**
 * Food generated per real second by one dock — a flat rate off the food
 * extraction tile's base yield (tweaks.docks.yield_multiplier_vs_food_tile),
 * boosted further once a fishing boat is built. Deliberately NOT also scaled
 * by transition_tiles.yield_multiplier the way ExtractionTile's yieldPerSecond
 * (engine/tick.ts) is — a dock sits on transition water by definition, so
 * 0.7x is already its full intended rate, not a rate to be halved again.
 */
export function dockYieldPerSecond(tweaks: Tweaks, dock: DockRecord): number {
  const base = tweaks.extraction_tiles.food.small_yield_per_tick / tweaks.game.tick_interval_seconds;
  const boatMultiplier = dock.fishingBoat ? tweaks.docks.fishing_boat.yield_bonus_multiplier : 1;
  return base * tweaks.docks.yield_multiplier_vs_food_tile * boatMultiplier;
}

/**
 * Mirrors engine/tick.ts:accrueResources, food-only and simplified for
 * docks: no path-connection draining (a water tile is never on the land path
 * network) — each dock's local stockpile fills, then deposits straight into
 * base food storage every tick, capped there same as everywhere else. No
 * `damaged` freeze either — docks are immune to horde capture.
 */
export function accrueDockResources(
  tweaks: Tweaks,
  docks: DockRecord[],
  resources: ResourceAmounts,
  elapsedSeconds: number,
  storageLevels: StorageLevels,
): { resources: ResourceAmounts; docks: DockRecord[] } {
  if (elapsedSeconds <= 0 || docks.length === 0) return { resources, docks };

  const tileStockpileCap = tweaks.storage.capacity_base_per_resource;
  let food = resources.food;

  const nextDocks = docks.map((dock) => {
    const rate = dockYieldPerSecond(tweaks, dock);
    let stockpile = Math.min(tileStockpileCap, dock.stockpile + rate * elapsedSeconds);

    const baseCap = storageCapacity(tweaks, storageLevels.food);
    const roomAtBase = Math.max(0, baseCap - food);
    const transferred = Math.min(stockpile, roomAtBase);
    stockpile -= transferred;
    food += transferred;

    return { ...dock, stockpile };
  });

  return { resources: { ...resources, food }, docks: nextDocks };
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
