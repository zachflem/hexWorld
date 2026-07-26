import type { ResourceAmounts, ResourceType } from "../data/resources";
import { RESOURCE_ORDER } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";
import type { Tweaks } from "../data/tweaksSchema";
import { formulaBCost } from "./formulas";

/** capacity(L) = capacity(L-1) * 2 — doubles per level, starting at capacity_base_per_resource for L1. */
export function storageCapacity(tweaks: Tweaks, level: number): number {
  return tweaks.storage.capacity_base_per_resource * 2 ** (level - 1);
}

/** Per-resource memory so a full-hub toast fires once until room opens again. */
export type StorageFullAlertMemory = Set<ResourceType>;

export function emptyStorageFullAlertMemory(): StorageFullAlertMemory {
  return new Set();
}

export interface CourierStockpileSite {
  resource: ResourceType;
  stockpile: number;
  stockpileCap: number;
}

/**
 * When a courier-automated site's local buffer is full and the hub has no
 * room for that resource, toast once per resource until hub room returns.
 */
export function reconcileStorageFullAlerts(
  tweaks: Tweaks,
  resources: ResourceAmounts,
  storageLevels: StorageLevels,
  courierSites: CourierStockpileSite[],
  prev: StorageFullAlertMemory,
): { next: StorageFullAlertMemory; alerts: ResourceType[] } {
  const next = new Set<ResourceType>();
  const alerts: ResourceType[] = [];

  for (const resource of RESOURCE_ORDER) {
    const hubCap = storageCapacity(tweaks, storageLevels[resource]);
    const hubFull = resources[resource] >= hubCap;
    if (!hubFull) continue;

    const localFull = courierSites.some(
      (site) =>
        site.resource === resource && site.stockpileCap > 0 && site.stockpile >= site.stockpileCap,
    );
    if (!localFull) continue;

    next.add(resource);
    if (!prev.has(resource)) alerts.push(resource);
  }

  return { next, alerts };
}

export function storageFullAlertToastText(resource: ResourceType): string {
  return `Your base ${resource} storage and stockpile is full!`;
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

/** L1→L2 = `upgrade_time_minutes_base` minutes; each further level × (1 + growth%/100). */
export function storageUpgradeDurationMs(tweaks: Tweaks, targetLevel: number): number {
  const { upgrade_time_minutes_base, upgrade_time_growth_per_level_pct } = tweaks.storage;
  const stepsAboveFirst = Math.max(0, targetLevel - 2);
  const multiplier = (1 + upgrade_time_growth_per_level_pct / 100) ** stepsAboveFirst;
  return upgrade_time_minutes_base * multiplier * 60 * 1000;
}
