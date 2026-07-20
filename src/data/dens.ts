import { axialDistance, axialRing, isWithinMapBounds, type Axial } from "../engine/hexCoords";
import { seededRandom } from "../engine/noise";
import { terrainAt } from "../engine/terrain";
import type { Tweaks } from "./tweaksSchema";

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
 * Deterministic den placement — spirals outward from base starting at
 * min_distance_from_base, collects non-water candidate tiles, then
 * deterministically (seededRandom, no Math.random()) picks `count` of them
 * without replacement and rolls each a level within its distance-capped
 * range. Same seed always yields the same dens. Pulled forward from
 * Milestone 14 (DESIGN.md §13) — placement + level only, no growth/siege yet.
 */
export function createDens(seed: number, gridSize: number, base: Axial, tweaks: Tweaks): DensRecord {
  const { count, min_distance_from_base } = tweaks.dens;
  const maxRadius = Math.floor(gridSize / 2);

  const candidates: Axial[] = [];
  for (let radius = min_distance_from_base; radius <= maxRadius; radius++) {
    for (const coord of axialRing(base, radius)) {
      if (!isWithinMapBounds(coord, gridSize)) continue;
      if (terrainAt(seed, coord) === "water") continue;
      candidates.push(coord);
    }
    if (candidates.length >= count * 20) break;
  }

  const dens: DenRecord[] = [];
  for (let i = 0; i < count && candidates.length > 0; i++) {
    const pickIndex = Math.floor(seededRandom(seed, i * 2) * candidates.length);
    const [coord] = candidates.splice(pickIndex, 1);
    const distance = axialDistance(base, coord);
    const levelCap = levelCapForDistance(tweaks, distance);
    const level = 1 + Math.floor(seededRandom(seed, i * 2 + 1) * levelCap);
    dens.push({ id: `den-${i}`, coord, level, siege: null });
  }

  return dens;
}
