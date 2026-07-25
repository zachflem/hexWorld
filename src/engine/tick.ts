import type { ExtractionTile } from "../data/extractionTiles";
import type { ResourceAmounts } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";
import type { TerritoryRecord } from "../data/territory";
import type { Tweaks } from "../data/tweaksSchema";
import { isTransitionTile, terrainAt } from "./terrain";
import { extractionTierLevel, tierYieldMultiplier } from "./tiers";
import { storageCapacity } from "./storage";
import { isStructureActive } from "./formulas";
import { powerPerformanceFactor, type PowerNetworkSnapshot } from "./power";
import { advanceCourierSite, structureHasCourierAutomation } from "./couriers";
import type { Axial } from "./hexCoords";

/**
 * Resource units generated per real second by one extraction tile, given its
 * tier and terrain. `terrainMultiplier` (tweaks.extraction_tiles.terrain_yield_multiplier)
 * rewards placing a resource on its natural terrain (food on grassland, wood
 * on forest, stone on mountain) and penalizes the opposite — stacks
 * multiplicatively with tier/transition-tile the same way they stack with
 * each other.
 */
export function yieldPerSecond(tweaks: Tweaks, tile: ExtractionTile, seed: number): number {
  const config = tweaks.extraction_tiles[tile.resource];
  const base = config.small_yield_per_tick / tweaks.game.tick_interval_seconds;
  const tierMultiplier = tierYieldMultiplier(tweaks, tile.tier);
  const transitionMultiplier = isTransitionTile(seed, tile.coord) ? tweaks.transition_tiles.yield_multiplier : 1;
  const terrainMultiplier = tweaks.extraction_tiles.terrain_yield_multiplier[tile.resource][terrainAt(seed, tile.coord)];
  return base * tierMultiplier * transitionMultiplier * terrainMultiplier;
}

/**
 * Advances the economy by `elapsedSeconds` (Milestone 26):
 *  1. Each extraction tile produces yield into its local stockpile (power-gated).
 *  2. L2+ tiles (mid/large) run an implied courier to base using expedition
 *     route timing (`travel_seconds_per_cost`). L1 stays manual-collect only.
 * Path-tile auto-flow is retired.
 */
export function accrueResources(
  tweaks: Tweaks,
  tiles: ExtractionTile[],
  elapsedSeconds: number,
  seed: number,
  resources: ResourceAmounts,
  storageLevels: StorageLevels,
  powerNetwork: PowerNetworkSnapshot,
  now: number,
  baseCoord: Axial,
  territory: TerritoryRecord,
  scoutedTiles: Axial[],
  gridSize: number,
): { resources: ResourceAmounts; tiles: ExtractionTile[] } {
  if (elapsedSeconds <= 0) return { resources, tiles };

  const tileStockpileCap = tweaks.storage.capacity_base_per_resource;

  let workingTiles = tiles.map((tile) => {
    if (!isStructureActive(tile)) return tile;
    const powerMul = powerPerformanceFactor(powerNetwork, extractionTierLevel(tile.tier), tile.coord);
    if (powerMul <= 0) return tile;
    const rate = yieldPerSecond(tweaks, tile, seed) * powerMul;
    const stockpile = Math.min(tileStockpileCap, tile.stockpile + rate * elapsedSeconds);
    return { ...tile, stockpile };
  });

  let nextResources = { ...resources };
  workingTiles = workingTiles.map((tile) => {
    if (!isStructureActive(tile)) return tile;
    const powerMul = powerPerformanceFactor(powerNetwork, extractionTierLevel(tile.tier), tile.coord);
    if (powerMul <= 0) return { ...tile, courier: null };

    const level = extractionTierLevel(tile.tier);
    const { site, resources: afterCourier } = advanceCourierSite(
      tweaks,
      seed,
      tile.coord,
      tile.resource,
      { stockpile: tile.stockpile, courier: tile.courier },
      nextResources,
      storageLevels,
      now,
      baseCoord,
      territory,
      scoutedTiles,
      gridSize,
      structureHasCourierAutomation(level),
    );
    nextResources = afterCourier;
    return { ...tile, stockpile: site.stockpile, courier: site.courier };
  });

  return { resources: nextResources, tiles: workingTiles };
}

/**
 * Manual collection: instantly moves a tile's entire local stockpile into
 * the shared resource pool, capped at storage. Always available regardless of
 * courier state (cargo already picked up stays with the courier until delivery).
 */
export function collectTile(
  tweaks: Tweaks,
  tile: ExtractionTile,
  resources: ResourceAmounts,
  storageLevels: StorageLevels,
): { resources: ResourceAmounts; tile: ExtractionTile } {
  const hubCap = storageCapacity(tweaks, storageLevels[tile.resource]);
  const roomAtHub = Math.max(0, hubCap - resources[tile.resource]);
  const transferred = Math.min(tile.stockpile, roomAtHub);

  return {
    resources: { ...resources, [tile.resource]: resources[tile.resource] + transferred },
    tile: { ...tile, stockpile: tile.stockpile - transferred },
  };
}
