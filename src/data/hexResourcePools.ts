import { axialKey, type Axial } from "../engine/hexCoords";
import { seededRandom } from "../engine/noise";
import { terrainAt, type TerrainType } from "../engine/terrain";
import type { Tweaks } from "./tweaksSchema";

/** Sparse map: axialKey → remaining after drain. Untouched hexes recompute from seed. */
export type HexResourcePoolsRecord = Record<string, number>;

export const HEX_RESOURCE_POOLS_DB_KEY = "hexResourcePools";

/** Seed salt for per-hex tile level — keep clear of dens / scrap placement salts. */
export const HEX_TILE_LEVEL_SALT = 7_000;

export function emptyHexResourcePools(): HexResourcePoolsRecord {
  return {};
}

export function isInfiniteResources(tweaks: Tweaks): boolean {
  return tweaks.hex_resource_pools.infinite_resources;
}

function coordSalt(coord: Axial, base: number): number {
  // Stable mix of q/r into squirrel3 index space (same idea as feature placement salts).
  return base + coord.q * 73856093 + coord.r * 19349663;
}

/** Hidden world-gen richness 1…tile_level_max (deterministic). */
export function hexTileLevel(seed: number, coord: Axial, tweaks: Tweaks): number {
  const max = Math.max(1, Math.floor(tweaks.hex_resource_pools.tile_level_max));
  return 1 + Math.floor(seededRandom(seed, coordSalt(coord, HEX_TILE_LEVEL_SALT)) * max);
}

function poolBaseForTerrain(tweaks: Tweaks, terrain: TerrainType): number {
  return tweaks.hex_resource_pools.pool_by_terrain[terrain];
}

/** Initial remaining for a hex (before any drain). */
export function initialRemainingResource(seed: number, coord: Axial, tweaks: Tweaks): number {
  const terrain = terrainAt(seed, coord);
  const base = poolBaseForTerrain(tweaks, terrain);
  if (base <= 0) return 0;
  const tileLevel = hexTileLevel(seed, coord, tweaks);
  const levelMul = 1 + tweaks.hex_resource_pools.pool_per_tile_level_pct * (tileLevel - 1);
  return Math.max(1, Math.round(base * levelMul));
}

/**
 * Current remaining on a hex. When `infinite_resources`, returns +Infinity
 * (callers should use {@link formatRemainingResource} for UI).
 */
export function remainingResourceAt(
  seed: number,
  coord: Axial,
  store: HexResourcePoolsRecord,
  tweaks: Tweaks,
): number {
  if (isInfiniteResources(tweaks)) return Number.POSITIVE_INFINITY;
  const key = axialKey(coord);
  if (Object.prototype.hasOwnProperty.call(store, key)) {
    return Math.max(0, store[key]!);
  }
  return initialRemainingResource(seed, coord, tweaks);
}

/**
 * Drain up to `amount` from the hex pool. When infinite, taken = amount and
 * the store is unchanged. Otherwise clamps to available remaining.
 */
export function drainRemainingResource(
  seed: number,
  coord: Axial,
  store: HexResourcePoolsRecord,
  tweaks: Tweaks,
  amount: number,
): { store: HexResourcePoolsRecord; taken: number } {
  if (amount <= 0) return { store, taken: 0 };
  if (isInfiniteResources(tweaks)) return { store, taken: amount };

  const available = remainingResourceAt(seed, coord, store, tweaks);
  const taken = Math.min(amount, available);
  if (taken <= 0) return { store, taken: 0 };

  const nextRemaining = available - taken;
  const key = axialKey(coord);
  return {
    store: { ...store, [key]: nextRemaining },
    taken,
  };
}

/** Player-facing remaining label for structure / stash sheets. */
export function formatRemainingResource(remaining: number, tweaks: Tweaks): string {
  if (isInfiniteResources(tweaks) || !Number.isFinite(remaining)) return "Unlimited";
  if (remaining <= 0) return "Dry";
  return String(Math.floor(remaining));
}
