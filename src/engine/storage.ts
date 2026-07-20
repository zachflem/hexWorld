import type { ResourceType } from "../data/resources";
import type { Tweaks } from "../data/tweaksSchema";
import { formulaBCost } from "./formulas";

/** capacity(L) = capacity(L-1) * 2 — doubles per level, starting at capacity_base_per_resource for L1. */
export function storageCapacity(tweaks: Tweaks, level: number): number {
  return tweaks.storage.capacity_base_per_resource * 2 ** (level - 1);
}

/** Formula B cost to upgrade one resource's storage from `currentLevel` to the next. */
export function storageUpgradeCost(
  tweaks: Tweaks,
  resource: ResourceType,
  currentLevel: number,
): Partial<Record<ResourceType, number>> {
  const targetLevel = currentLevel + 1;
  const baseCostMap = tweaks.storage.upgrade_cost_base[resource];
  const cost: Partial<Record<ResourceType, number>> = {};
  for (const [res, amount] of Object.entries(baseCostMap)) {
    cost[res as ResourceType] = formulaBCost(amount, targetLevel);
  }
  return cost;
}
