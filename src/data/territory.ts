import { axialRing, axialSpiral, isWithinMapBounds, mapCenter, type Axial } from "../engine/hexCoords";
import { OWNED_RADIUS } from "../engine/fog";
import { terrainAt } from "../engine/terrain";

export interface TerritoryRecord {
  base: Axial;
  /** Explicit, mutable set of owned tiles (not just derived from distance —
   *  future milestones let this grow via claiming and shrink via horde capture). */
  owned: Axial[];
}

export const TERRITORY_DB_KEY = "territory";

/**
 * The geometric map center, nudged to the nearest non-water tile — terrain is
 * seed-dependent (engine/terrain.ts), so the raw center can land in the
 * middle of an ocean/lake for some seeds. Spirals outward ring by ring.
 */
function findBaseLocation(seed: number, gridSize: number): Axial {
  const center = mapCenter(gridSize);
  if (terrainAt(seed, center) !== "water") return center;

  for (let radius = 1; radius < gridSize; radius++) {
    for (const coord of axialRing(center, radius)) {
      if (!isWithinMapBounds(coord, gridSize)) continue;
      if (terrainAt(seed, coord) !== "water") return coord;
    }
  }
  return center; // Unreachable in practice — would mean the whole map is water.
}

/** Base + first two full rings (19 tiles), owned outright at game start — DESIGN.md §6. */
export function createStartingTerritory(seed: number, gridSize: number): TerritoryRecord {
  const base = findBaseLocation(seed, gridSize);
  return { base, owned: axialSpiral(base, OWNED_RADIUS) };
}
