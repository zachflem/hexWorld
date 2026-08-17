import { axialDistance, type Axial } from "../engine/hexCoords";
import { seededRandom } from "../engine/noise";
import type { Tweaks } from "./tweaksSchema";
import { placeFeatures } from "./featurePlacement";
import { scaleToMapSize } from "./mapSize";

export interface DenRecord {
  id: string;
  coord: Axial;
  /** Fixed for good — a den's level is rolled once at world-gen (levelCapForDistance below) and never changes; there's no in-fiction reason for a horde den to grow on its own, unlike the player's own noise-driven risk. */
  level: number;
  /** Non-null while under siege (won the initial assault, surviving the hold period) — null the rest of the time, including after a failed hold reverts it to hostile. */
  siege: DenSiegeState | null;
}

/** engine/dens.ts:resolveHoldPeriod owns advancing this each tick. */
export interface DenSiegeState {
  /** ms, virtualNow — when the hold period began. */
  startedAt: number;
  /** ms, virtualNow — when the last last-stand wave was rolled. */
  lastWaveAt: number;
  /** Waves survived so far this siege — drives wave-size escalation. */
  waveIndex: number;
}

export type DensRecord = DenRecord[];

export const DENS_DB_KEY = "dens";

/** seed salt for placeFeatures — keep clear of lab / scrap (#36) salts. */
export const DENS_PLACEMENT_SALT = 1_000;
/** Separate salt for the ±1 den-count roll (must not collide with placement indices). */
export const DENS_COUNT_SALT = 1_001;
/** Per-seed variance around `tweaks.dens.count` — e.g. 32×32 base 6 → 5–7 dens. */
export const DENS_COUNT_VARIANCE = 1;

/**
 * Reference (128×128) min axial gap between dens. Scaled with map size so large
 * maps stay sparse enough to explore; small maps still separate dens.
 */
const REFERENCE_DEN_MIN_SEPARATION = 6;

/** Deterministic den count: base from map size ± variance (same seed → same count). */
export function rollDensCount(
  seed: number,
  baseCount: number,
  variance: number = DENS_COUNT_VARIANCE,
): number {
  const span = 2 * variance + 1;
  const roll = Math.floor(seededRandom(seed, DENS_COUNT_SALT) * span) - variance;
  return Math.max(1, baseCount + roll);
}

/** Migration for pre-siege saves — spreads the new `siege` field over an older DenRecord missing it. */
export function resolveDen(den: DenRecord): DenRecord {
  return { ...den, siege: den.siege ?? null };
}

/**
 * cap(distance) = clamp(1 + floor((distance - min_distance_from_base) / distance_per_level_step), 1, max_level)
 * — tweaks.jsonc dens.level_cap_by_distance._formula.
 */
function levelCapForDistance(tweaks: Tweaks, distance: number): number {
  const { min_distance_from_base, max_level, level_cap_by_distance } = tweaks.dens;
  const steps = Math.floor((distance - min_distance_from_base) / level_cap_by_distance.distance_per_level_step);
  return Math.min(max_level, Math.max(1, 1 + steps));
}

/**
 * Deterministic den placement via shared `placeFeatures` (full-map pool +
 * seeded picks + min separation) — not an early-stopped ring spiral. Same
 * seed always yields the same dens.
 */
export function createDens(seed: number, gridSize: number, base: Axial, tweaks: Tweaks): DensRecord {
  const { min_distance_from_base } = tweaks.dens;
  const count = rollDensCount(seed, tweaks.dens.count);
  const minSeparation = scaleToMapSize(REFERENCE_DEN_MIN_SEPARATION, gridSize);

  const coords = placeFeatures({
    seed,
    gridSize,
    salt: DENS_PLACEMENT_SALT,
    count,
    minSeparation,
    anchors: [{ coords: [base], minDistance: min_distance_from_base }],
  });

  return coords.map((coord, i) => {
    const distance = axialDistance(base, coord);
    const levelCap = levelCapForDistance(tweaks, distance);
    const level = 1 + Math.floor(seededRandom(seed, DENS_PLACEMENT_SALT + i * 2 + 1) * levelCap);
    return { id: `den-${i}`, coord, level, siege: null };
  });
}
