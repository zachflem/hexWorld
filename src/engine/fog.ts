// Fog-of-war tiers, per DESIGN.md §6. Owned and scouted tiles behave
// identically as fog-clearing centers: each radiates a capped heavy/light
// roll-off around itself, never a fully-clear plateau bleeding onto
// neighbors that aren't themselves owned/scouted. Only ground truth (a tile
// actually being in the owned or scouted set) ever gets the fully-clear
// "owned" or the "scouted" tier — being merely adjacent to (and attackable
// from) owned territory is not visibility, so "attack blind" really means
// blind: it stays capped at heavy/light/hidden like everything else outside
// your actual footprint, until separately scouted.

import { axialDistance, axialKey, axialSpiral, type Axial } from "./hexCoords";

/** Base tile + first two full rings = 19 tiles, owned outright at game start. */
export const OWNED_RADIUS = 2;
export const HEAVY_FOG_RADIUS = 3;
export const LIGHT_FOG_RADIUS = 4;

export type FogTier = "owned" | "heavy" | "light" | "scouted" | "hidden";

/** Lower rank = clearer. Used to pick the best tier when two centers' halos overlap. */
const FOG_TIER_RANK: Record<FogTier, number> = { owned: 0, heavy: 1, light: 2, scouted: 3, hidden: 4 };

export function fogTierForDistance(distance: number): FogTier {
  if (distance <= OWNED_RADIUS) return "owned";
  if (distance === HEAVY_FOG_RADIUS) return "heavy";
  if (distance === LIGHT_FOG_RADIUS) return "light";
  return "hidden";
}

/**
 * Per-center halo, per DESIGN.md §6: "fog of war begins exactly one ring
 * past owned territory" — one ring heavy, the next ring light, regardless of
 * OWNED_RADIUS. This is intentionally NOT derived from fogTierForDistance:
 * that function's `distance <= OWNED_RADIUS` branch describes ground truth
 * around a single point, and reusing it here for every owned/scouted tile's
 * halo would let each tile re-claim a radius-OWNED_RADIUS "owned" zone of
 * its own (capped to heavy) on top of its actual heavy/light ring, stacking
 * extra rings of heavy fog onto any multi-tile blob (e.g. the 19-tile
 * starting territory) or even a single isolated scouted tile.
 */
const HALO_HEAVY_RADIUS = 1;
const HALO_LIGHT_RADIUS = 2;

function fogRolloffTierForDistance(distance: number): FogTier {
  if (distance <= HALO_HEAVY_RADIUS) return "heavy";
  if (distance <= HALO_LIGHT_RADIUS) return "light";
  return "hidden";
}

/**
 * Precomputes fog tier for every tile within HALO_LIGHT_RADIUS of any owned
 * or scouted tile. Both kinds of center radiate the identical capped
 * roll-off (fogRolloffTierForDistance) — no free clear plateau leaking onto
 * non-owned, non-scouted neighbors, even for a solid contiguous blob like
 * the starting territory (each tile in it would otherwise radiate its own
 * plateau and inflate the visible area far past the blob's true edge).
 * Ground truth is applied last and wins over any radiated halo: a tile
 * that's actually owned or scouted always shows its real tier, regardless
 * of what the roll-off painted underneath — owned beats scouted on conflict.
 */
export function computeFogTiers(owned: Axial[], scouted: Axial[]): Map<string, FogTier> {
  const tiers = new Map<string, FogTier>();

  function paintAround(center: Axial) {
    for (const coord of axialSpiral(center, HALO_LIGHT_RADIUS)) {
      const key = axialKey(coord);
      const tier = fogRolloffTierForDistance(axialDistance(center, coord));
      const existing = tiers.get(key);
      if (!existing || FOG_TIER_RANK[tier] < FOG_TIER_RANK[existing]) tiers.set(key, tier);
    }
  }

  for (const coord of owned) paintAround(coord);
  for (const coord of scouted) paintAround(coord);

  for (const coord of scouted) tiers.set(axialKey(coord), "scouted");
  for (const coord of owned) tiers.set(axialKey(coord), "owned");

  return tiers;
}

export function fogTierFor(coord: Axial, fogTiers: Map<string, FogTier>): FogTier {
  return fogTiers.get(axialKey(coord)) ?? "hidden";
}
