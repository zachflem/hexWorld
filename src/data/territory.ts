import { axialRing, axialSpiral, isWithinMapBounds, mapCenter, type Axial } from "../engine/hexCoords";
import { OWNED_RADIUS } from "../engine/fog";
import { seededRandom } from "../engine/noise";
import { terrainAt, type TerrainType } from "../engine/terrain";

export interface TerritoryRecord {
  base: Axial;
  /** Explicit, mutable set of owned tiles (not just derived from distance —
   *  future milestones let this grow via claiming and shrink via horde capture). */
  owned: Axial[];
}

export const TERRITORY_DB_KEY = "territory";

/** Cap how far spawn can drift from map center so dens/lab still have runway. */
const SPAWN_SEARCH_RADIUS_CAP = 24;
/** Owned ring (19 tiles) must stay mostly dry land — shore-heavy starts stay playable. */
const MIN_DRY_LAND_IN_OWNED = 15;
/** Fixed index for seededRandom spawn tie-break (same style as dens/lab picks). */
const SPAWN_PICK_INDEX = 7_777_777;

/**
 * Geometric map center → nearest non-water tile. Used only as fallback when
 * no scored candidate passes filters.
 */
function nearestNonWaterToCenter(seed: number, gridSize: number): Axial {
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

function ownedRing(base: Axial): Axial[] {
  return axialSpiral(base, OWNED_RADIUS);
}

function isValidSpawnCandidate(seed: number, base: Axial, gridSize: number): boolean {
  if (terrainAt(seed, base) === "water") return false;

  const ring = ownedRing(base);
  let dry = 0;
  for (const coord of ring) {
    if (!isWithinMapBounds(coord, gridSize)) return false;
    if (terrainAt(seed, coord) !== "water") dry++;
  }
  return dry >= MIN_DRY_LAND_IN_OWNED;
}

/** Distinct non-water terrains in the starting owned footprint. */
export function startingBiomeDiversity(seed: number, base: Axial): number {
  const types = new Set<TerrainType>();
  for (const coord of ownedRing(base)) {
    const terrain = terrainAt(seed, coord);
    if (terrain !== "water") types.add(terrain);
  }
  return types.size;
}

/**
 * Higher = better starting view. Prefers mixed biomes in the owned ring;
 * harder local starts (forest/mountain/shore under the base) are rewarded.
 */
function scoreSpawnCandidate(seed: number, base: Axial): number {
  const types = new Set<TerrainType>();
  for (const coord of ownedRing(base)) {
    const terrain = terrainAt(seed, coord);
    if (terrain !== "water") types.add(terrain);
  }

  let score = types.size * 10;

  const baseTerrain = terrainAt(seed, base);
  if (baseTerrain === "forest" || baseTerrain === "mountain" || baseTerrain === "shore") {
    score += 5;
  }

  if (types.size === 1 && types.has("grassland")) {
    score -= 15;
  }

  return score;
}

/**
 * Pick a base near map center that maximizes starting-biome mix (deterministic
 * from seed). Falls back to nearest non-water center tile if nothing scores.
 */
function findBaseLocation(seed: number, gridSize: number): Axial {
  const center = mapCenter(gridSize);
  const maxSearch = Math.min(SPAWN_SEARCH_RADIUS_CAP, Math.floor(gridSize / 4));

  const candidates: Axial[] = [];
  for (let radius = 0; radius <= maxSearch; radius++) {
    const ring = radius === 0 ? [center] : axialRing(center, radius);
    for (const coord of ring) {
      if (!isWithinMapBounds(coord, gridSize)) continue;
      if (!isValidSpawnCandidate(seed, coord, gridSize)) continue;
      candidates.push(coord);
    }
  }

  if (candidates.length === 0) {
    return nearestNonWaterToCenter(seed, gridSize);
  }

  let bestScore = -Infinity;
  for (const candidate of candidates) {
    const score = scoreSpawnCandidate(seed, candidate);
    if (score > bestScore) bestScore = score;
  }

  const top = candidates.filter((c) => scoreSpawnCandidate(seed, c) === bestScore);
  const pickIndex = Math.floor(seededRandom(seed, SPAWN_PICK_INDEX) * top.length);
  return top[Math.min(pickIndex, top.length - 1)];
}

/** Base + first two full rings (≤19 tiles), owned outright at game start — DESIGN.md §6. */
export function createStartingTerritory(seed: number, gridSize: number): TerritoryRecord {
  const base = findBaseLocation(seed, gridSize);
  const owned = ownedRing(base).filter((coord) => isWithinMapBounds(coord, gridSize));
  return { base, owned };
}
