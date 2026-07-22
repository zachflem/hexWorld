import { axialKey, type Axial } from "./hexCoords";
import type { ExtractionTile } from "../data/extractionTiles";
import type { PathTile } from "../data/pathTiles";
import type { ResourceAmounts } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";
import type { Tweaks } from "../data/tweaksSchema";
import { isTransitionTile, terrainAt } from "./terrain";
import { tierYieldMultiplier } from "./tiers";
import { storageCapacity } from "./storage";
import { findResourceTileConnection, throughputMultiplierForChain, transportRateMultiplier } from "./paths";
import { isStructureActive } from "./formulas";

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
 * Advances the whole economy by `elapsedSeconds`, in two stages per DESIGN.md §8:
 *  1. Each extraction tile produces yield into its own local stockpile,
 *     capped at storage.capacity_base_per_resource (flat, not storage-skill-scaled).
 *  2. Any not-yet-claimed tile path-connected to one of `hubCoords` (base
 *     first, then outposts — order matters) drains into the single shared
 *     `resources` pool, at a rate relative to the tile's own yield, capped at
 *     the shared (storage-skill-scaled) cap. A base and every outpost are
 *     just alternate entry points into the same stockpile — there's no
 *     per-hub storage anymore (engine/outposts.ts). A `claimed` set
 *     guarantees a tile only ever drains once per tick even if it happens to
 *     be connected to more than one hub. A tile connected to none of them
 *     just accumulates locally until manually collected (collectTile below).
 * A `damaged` tile (horde-captured, not yet reclaimed+repaired — DESIGN.md
 * §12) stops fully: no new yield, and no draining of whatever stockpile it
 * already had — everything freezes until it's repaired, matching the "not
 * usable until repaired" status shown in TilePopup.
 */
export function accrueResources(
  tweaks: Tweaks,
  tiles: ExtractionTile[],
  pathTiles: PathTile[],
  elapsedSeconds: number,
  seed: number,
  resources: ResourceAmounts,
  storageLevels: StorageLevels,
  hubCoords: Axial[],
): { resources: ResourceAmounts; tiles: ExtractionTile[] } {
  if (elapsedSeconds <= 0) return { resources, tiles };

  const tileStockpileCap = tweaks.storage.capacity_base_per_resource;

  let workingTiles = tiles.map((tile) => {
    if (!isStructureActive(tile)) return tile;
    const rate = yieldPerSecond(tweaks, tile, seed);
    const stockpile = Math.min(tileStockpileCap, tile.stockpile + rate * elapsedSeconds);
    return { ...tile, stockpile };
  });

  const claimed = new Set<string>();
  let nextResources = { ...resources };
  for (const hubCoord of hubCoords) {
    workingTiles = workingTiles.map((tile) => {
      if (!isStructureActive(tile)) return tile;
      const key = axialKey(tile.coord);
      if (claimed.has(key)) return tile;

      const connection = findResourceTileConnection(workingTiles, pathTiles, hubCoord, tile.coord);
      if (!connection) return tile;
      claimed.add(key);

      const rate = yieldPerSecond(tweaks, tile, seed);
      const throughput = throughputMultiplierForChain(tweaks, seed, connection.chain);
      const transportable = rate * transportRateMultiplier(tweaks, connection.tier) * throughput * elapsedSeconds;
      const hubCap = storageCapacity(tweaks, storageLevels[tile.resource]);
      const roomAtHub = Math.max(0, hubCap - nextResources[tile.resource]);
      const transferred = Math.min(tile.stockpile, transportable, roomAtHub);

      nextResources = { ...nextResources, [tile.resource]: nextResources[tile.resource] + transferred };
      return { ...tile, stockpile: tile.stockpile - transferred };
    });
  }

  return { resources: nextResources, tiles: workingTiles };
}

/**
 * Manual collection: instantly moves a tile's entire local stockpile into
 * the single shared resource pool, capped at its storage. Doesn't need to
 * know which hub (if any) the tile is path-connected to — unlike
 * accrueResources's automatic per-tick drain, a manual collect always
 * succeeds regardless of connectivity, and every hub now shares the same
 * destination pool anyway.
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
