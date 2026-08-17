import { axialDistance, axialKey, axialRing, axialSpiral, isWithinMapBounds, mapCenter, type Axial } from "../engine/hexCoords";
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

/** Owned ring (19 tiles) must stay mostly dry land — shore-heavy starts stay playable. */
const MIN_DRY_LAND_IN_OWNED = 15;
/** Fixed index for seededRandom spawn pick (same style as dens/lab salts). */
const SPAWN_PICK_INDEX = 7_777_777;
/**
 * How far below the best biome score a candidate may sit and still compete.
 * Wider slack → more geographic variety (corners/edges) while still preferring
 * mixed biomes over pure grassland.
 */
const SPAWN_SCORE_SLACK = 15;
/**
 * Seeded samples across the full map (plus map center). Keeps spawn cheap on
 * 128² while still reaching corners.
 */
const SPAWN_SAMPLE_COUNT = 120;

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

/** Uniform seeded pick of a map tile (odd-r rectangle). */
function sampleMapCoord(seed: number, gridSize: number, index: number): Axial {
  const r = Math.floor(seededRandom(seed, index) * gridSize);
  const col = Math.floor(seededRandom(seed, index + 10_000) * gridSize);
  return { q: col - Math.floor(r / 2), r };
}

/**
 * Pick a base from seeded full-map samples (including corners/edges), preferring
 * competitive biome scores. Deterministic from seed.
 */
function findBaseLocation(seed: number, gridSize: number): Axial {
  const center = mapCenter(gridSize);
  const seen = new Set<string>();
  const candidates: Axial[] = [];

  const tryAdd = (coord: Axial) => {
    const key = axialKey(coord);
    if (seen.has(key)) return;
    if (!isValidSpawnCandidate(seed, coord, gridSize)) return;
    seen.add(key);
    candidates.push(coord);
  };

  tryAdd(center);

  for (let i = 0; i < SPAWN_SAMPLE_COUNT * 4 && candidates.length < SPAWN_SAMPLE_COUNT; i++) {
    tryAdd(sampleMapCoord(seed, gridSize, SPAWN_PICK_INDEX + 1 + i * 2));
  }

  if (candidates.length === 0) {
    return nearestNonWaterToCenter(seed, gridSize);
  }

  let bestScore = -Infinity;
  const scores = new Map<string, number>();
  for (const candidate of candidates) {
    const score = scoreSpawnCandidate(seed, candidate);
    scores.set(axialKey(candidate), score);
    if (score > bestScore) bestScore = score;
  }

  const competitive = candidates.filter(
    (c) => (scores.get(axialKey(c)) ?? -Infinity) >= bestScore - SPAWN_SCORE_SLACK,
  );
  const pickIndex = Math.floor(seededRandom(seed, SPAWN_PICK_INDEX) * competitive.length);
  return competitive[Math.min(pickIndex, competitive.length - 1)]!;
}

/** Base + first two full rings (≤19 tiles), owned outright at game start — DESIGN.md §6. */
export function createStartingTerritory(seed: number, gridSize: number): TerritoryRecord {
  const base = findBaseLocation(seed, gridSize);
  const owned = ownedRing(base).filter((coord) => isWithinMapBounds(coord, gridSize));
  return { base, owned };
}

/** Axial distance from map center — used by tests / diagnostics for spawn spread. */
export function spawnDistanceFromCenter(base: Axial, gridSize: number): number {
  return axialDistance(base, mapCenter(gridSize));
}
