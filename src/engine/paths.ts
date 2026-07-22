import type { ExtractionTile } from "../data/extractionTiles";
import type { PathTier, PathTile } from "../data/pathTiles";
import type { ResourceType } from "../data/resources";
import type { Tweaks } from "../data/tweaksSchema";
import { formulaBCost, isStructureActive } from "./formulas";
import { axialDistance, axialKey, axialNeighbors, type Axial } from "./hexCoords";
import { terrainAt } from "./terrain";

export const PATH_TIER_ORDER: PathTier[] = ["goat_track", "stone_road", "highway"];

/** 1-based, matching Formula B's "target_level" semantics. */
const PATH_TIER_LEVEL: Record<PathTier, number> = { goat_track: 1, stone_road: 2, highway: 3 };

/** Never actually returns "goat_track" — it's only ever the starting tier, not a reachable upgrade target. */
export function nextPathTier(tier: PathTier): Exclude<PathTier, "goat_track"> | null {
  const index = PATH_TIER_ORDER.indexOf(tier);
  return index < PATH_TIER_ORDER.length - 1
    ? (PATH_TIER_ORDER[index + 1] as Exclude<PathTier, "goat_track">)
    : null;
}

/**
 * Flat cost to build a goat track (the only path tier that's "built" rather
 * than "upgraded") — no build-count scaling at all, not even the linear
 * variant walls use. CORRECTION (2026-07-21, playtesting feedback): even
 * linear per-additional-tile growth fights infrastructure_paths.slot_cost's
 * whole point, which is to make long connected path chains (potentially
 * dozens of tiles) viable — a network you're meant to build in bulk
 * shouldn't get steadily more expensive per tile just for existing. See
 * TWEAKS.md.
 */
export function pathBuildCost(tweaks: Tweaks): Record<string, number> {
  return { ...tweaks.infrastructure_paths.goat_track.build_cost_base };
}

/** Flat construction duration for a freshly-built goat_track — tweaks.jsonc infrastructure_paths.goat_track.build_time_minutes, distinct from upgrade_time_minutes_base. */
export function pathBuildDurationMs(tweaks: Tweaks): number {
  return tweaks.infrastructure_paths.goat_track.build_time_minutes * 60_000;
}

/**
 * Cost to upgrade a path to `targetTier` (stone_road or highway). Both tiers'
 * upgrade_cost_base only define a "food" amount, but upgrade_resources lists
 * additional resources (stone, steel) with no base amount of their own —
 * resolved the same way as extraction tier upgrades (engine/tiers.ts): reuse
 * that resource's own extraction-tile upgrade base as the baseline.
 */
export function pathUpgradeCost(
  tweaks: Tweaks,
  targetTier: "stone_road" | "highway",
): Partial<Record<ResourceType, number>> {
  const targetLevel = PATH_TIER_LEVEL[targetTier];
  const config = tweaks.infrastructure_paths[targetTier];

  const cost: Partial<Record<ResourceType, number>> = {};
  for (const [res, amount] of Object.entries(config.upgrade_cost_base)) {
    const key = res as ResourceType;
    cost[key] = (cost[key] ?? 0) + formulaBCost(amount, targetLevel);
  }
  for (const resource of config.upgrade_resources) {
    const key = resource as ResourceType;
    if (key in cost) continue; // the primary resource, already handled above
    const baseAmount = tweaks.extraction_tiles[key].tier_upgrade_cost_base[key];
    cost[key] = (cost[key] ?? 0) + formulaBCost(baseAmount, targetLevel);
  }
  return cost;
}

/** pathUpgradeDurationMs(targetTier) = upgrade_time_minutes_base * target_level — tweaks.jsonc infrastructure_paths. */
export function pathUpgradeDurationMs(tweaks: Tweaks, targetTier: "stone_road" | "highway"): number {
  const targetLevel = PATH_TIER_LEVEL[targetTier];
  return tweaks.infrastructure_paths.upgrade_time_minutes_base * targetLevel * 60_000;
}

/** How much faster than the tile's own yield rate its stockpile drains to base, per tier. */
export function transportRateMultiplier(tweaks: Tweaks, tier: PathTier): number {
  const { transport } = tweaks.infrastructure_paths;
  switch (tier) {
    case "goat_track":
      return transport.goat_track_rate_multiplier;
    case "stone_road":
      return transport.stone_road_rate_multiplier;
    case "highway":
      return transport.highway_rate_multiplier;
  }
}

/**
 * Shortest chain of path-tile hexes from `coord` (which must itself have a
 * path tile) to a hex adjacent to `base` (base itself never hosts a path tile
 * — nothing can be built there). Returns null if no such chain exists. A
 * `damaged` path tile (horde-captured, not yet repaired) is excluded
 * entirely — it can't carry a chain through it, same as if no path were
 * there, per DESIGN.md §12's "not usable until repaired."
 */
function findPathChainToBase(pathTiles: PathTile[], base: Axial, coord: Axial): Axial[] | null {
  const pathTilesByKey = new Map(pathTiles.filter(isStructureActive).map((tile) => [axialKey(tile.coord), tile]));
  if (!pathTilesByKey.has(axialKey(coord))) return null;

  const cameFrom = new Map<string, Axial>();
  const visited = new Set<string>([axialKey(coord)]);
  const queue: Axial[] = [coord];

  while (queue.length > 0) {
    const current = queue.shift() as Axial;
    if (axialDistance(current, base) === 1) {
      const chain: Axial[] = [current];
      let key = axialKey(current);
      while (cameFrom.has(key)) {
        const parent = cameFrom.get(key) as Axial;
        chain.unshift(parent);
        key = axialKey(parent);
      }
      return chain;
    }
    for (const neighbor of axialNeighbors(current)) {
      const key = axialKey(neighbor);
      if (visited.has(key) || !pathTilesByKey.has(key)) continue;
      visited.add(key);
      cameFrom.set(key, current);
      queue.push(neighbor);
    }
  }
  return null;
}

/** 0.75^(mountain path tiles in the chain) — TWEAKS.md's per-tile compounding mountain penalty. */
export function throughputMultiplierForChain(tweaks: Tweaks, seed: number, chain: Axial[]): number {
  const penalty = 1 - tweaks.infrastructure_paths.terrain_rules.mountain_throughput_penalty_pct / 100;
  const mountainCount = chain.filter((coord) => terrainAt(seed, coord) === "mountain").length;
  return penalty ** mountainCount;
}

export interface ResourceTileConnection {
  tier: PathTier;
  chain: Axial[];
}

/**
 * Whether an extraction tile auto-flows to base — and if so, through which
 * path tier and chain (for computing rate + mountain penalty). A tile is
 * connected if:
 *  - it (or a same-resource cluster member, see below) is directly adjacent
 *    to base — no path tile required for that first hop, treated as the
 *    best possible connection (tier "highway", empty chain — nothing to
 *    apply a mountain penalty to), OR
 *  - any of its own neighboring hexes has a path tile chained back to base, OR
 *  - it belongs to a contiguous cluster of same-resource extraction tiles
 *    where at least one member satisfies either of the above (a hex can
 *    never host both a path and an extraction tile, so this is how adjacent
 *    same-type tiles "share" a single connected neighbor's road access, or
 *    a single member's direct base adjacency).
 * If multiple connections are reachable, the first one found (by BFS order)
 * is used — not necessarily the fastest; a first-pass simplification.
 *
 * A non-functional tile (engine/formulas.ts:isStructureActive — damaged and
 * not yet repaired, OR still under construction) — the start tile itself, a
 * path tile in the chain, or a cluster member — never connects or
 * propagates through, per DESIGN.md §12: captured-but-unrepaired ground
 * carries nothing, and neither does ground that isn't finished being built.
 */
export function findResourceTileConnection(
  extractionTiles: ExtractionTile[],
  pathTiles: PathTile[],
  base: Axial,
  coord: Axial,
): ResourceTileConnection | null {
  const extractionTilesByKey = new Map(extractionTiles.map((tile) => [axialKey(tile.coord), tile]));
  const pathTilesByKey = new Map(pathTiles.filter(isStructureActive).map((tile) => [axialKey(tile.coord), tile]));
  const startTile = extractionTilesByKey.get(axialKey(coord));
  if (!startTile || !isStructureActive(startTile)) return null;

  const visited = new Set<string>([axialKey(coord)]);
  const queue: Axial[] = [coord];

  while (queue.length > 0) {
    const current = queue.shift() as Axial;

    if (axialDistance(current, base) === 1) return { tier: "highway", chain: [] };

    for (const neighbor of axialNeighbors(current)) {
      const pathTile = pathTilesByKey.get(axialKey(neighbor));
      if (!pathTile) continue;
      const chain = findPathChainToBase(pathTiles, base, neighbor);
      if (chain) return { tier: pathTile.tier, chain };
    }

    for (const neighbor of axialNeighbors(current)) {
      const key = axialKey(neighbor);
      if (visited.has(key)) continue;
      const neighborTile = extractionTilesByKey.get(key);
      if (!neighborTile || !isStructureActive(neighborTile) || neighborTile.resource !== startTile.resource) continue;
      visited.add(key);
      queue.push(neighbor);
    }
  }
  return null;
}
