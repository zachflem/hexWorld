import type { ScrapYardRecord } from "../data/scrapYards";
import { MAX_SCRAP_YARD_LEVEL_SHIPPED } from "../data/scrapYards";
import type { ResourceAmounts, ResourceType } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";
import type { TerritoryRecord } from "../data/territory";
import type { Tweaks } from "../data/tweaksSchema";
import type { Axial } from "./hexCoords";
import { isStructureActive, scaledCostMap } from "./formulas";
import { powerPerformanceFactor, type PowerNetworkSnapshot } from "./power";
import { storageCapacity } from "./storage";
import { tierUpgradeCost, tierUpgradeDurationMs } from "./tiers";
import { advanceCourierSite, structureHasCourierAutomation } from "./couriers";

/** Formula A build cost — same base as steel extraction small (Q56). */
export function scrapYardBuildCost(tweaks: Tweaks, n: number): Record<string, number> {
  return scaledCostMap(tweaks.scrap_yards.build_cost_base, n);
}

export function scrapYardBuildDurationMs(tweaks: Tweaks): number {
  return tweaks.scrap_yards.build_time_minutes * 60_000;
}

export function nextScrapYardLevel(level: number): number | null {
  return level < MAX_SCRAP_YARD_LEVEL_SHIPPED ? level + 1 : null;
}

/**
 * L2/L3 upgrade costs reuse steel mid/large tier math (Q56) so we don't
 * invent a second cost table before L4/L5 exist.
 */
export function scrapYardUpgradeCost(
  tweaks: Tweaks,
  targetLevel: 2 | 3,
): Partial<Record<ResourceType, number>> {
  const tier = targetLevel === 2 ? "mid" : "large";
  return tierUpgradeCost(tweaks, "steel", tier);
}

export function scrapYardUpgradeDurationMs(tweaks: Tweaks, targetLevel: 2 | 3): number {
  const tier = targetLevel === 2 ? "mid" : "large";
  return tierUpgradeDurationMs(tweaks, tier);
}

/** Manual collect — move yard steel stockpile into the shared pool. */
export function collectScrapYard(
  tweaks: Tweaks,
  yard: ScrapYardRecord,
  resources: ResourceAmounts,
  storageLevels: StorageLevels,
): { resources: ResourceAmounts; yard: ScrapYardRecord } {
  const baseCap = storageCapacity(tweaks, storageLevels.steel);
  const roomAtBase = Math.max(0, baseCap - resources.steel);
  const transferred = Math.min(yard.stockpile, roomAtBase);
  return {
    resources: { ...resources, steel: resources.steel + transferred },
    yard: { ...yard, stockpile: yard.stockpile - transferred },
  };
}

/**
 * Yard last-mile courier unlocks at L2+ — same pattern as food/wood/stone/docks
 * (`structureHasCourierAutomation`). L1 is manual collect only.
 * L2+ yards outside power / below cutoff clear the courier (extraction parity).
 */
export function advanceScrapYardCouriers(
  tweaks: Tweaks,
  yards: ScrapYardRecord[],
  resources: ResourceAmounts,
  storageLevels: StorageLevels,
  now: number,
  seed: number,
  baseCoord: Axial,
  territory: TerritoryRecord,
  scoutedTiles: Axial[],
  gridSize: number,
  powerNetwork: PowerNetworkSnapshot,
): { resources: ResourceAmounts; scrapYards: ScrapYardRecord[] } {
  if (yards.length === 0) return { resources, scrapYards: yards };

  let nextResources = { ...resources };
  const nextYards = yards.map((yard) => {
    if (!isStructureActive(yard)) return yard;

    const powerMul = powerPerformanceFactor(powerNetwork, yard.level, yard.coord);
    if (powerMul <= 0) return { ...yard, courier: null };

    const { site, resources: afterCourier } = advanceCourierSite(
      tweaks,
      seed,
      yard.coord,
      "steel",
      { stockpile: yard.stockpile, courier: yard.courier },
      nextResources,
      storageLevels,
      now,
      baseCoord,
      territory,
      scoutedTiles,
      gridSize,
      structureHasCourierAutomation(yard.level),
    );
    nextResources = afterCourier;
    return { ...yard, stockpile: site.stockpile, courier: site.courier ?? null };
  });

  return { resources: nextResources, scrapYards: nextYards };
}
