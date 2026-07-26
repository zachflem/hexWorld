import type { Compass4, LabRecord, WatchtowerSignal } from "../data/lab";
import type { Tweaks } from "../data/tweaksSchema";
import { resolveHordeTileFight } from "./hordes";
import { axialKey, axialSpiral, axialToPixel, isWithinMapBounds, type Axial } from "./hexCoords";
import { seededRandom } from "./noise";

/** Towers below this level are combat-only — no listening / signal rolls (#38). */
export const WATCHTOWER_SIGNAL_MIN_LEVEL = 2;

/**
 * The guardian's one-shot defense check — same deterministic, no-luck shape
 * as every other fight in this game (DESIGN.md §10), but all-or-nothing like
 * a regular expedition/tile attack rather than a den assault's proportional
 * attrition: there's no siege/hold period here, just a single static
 * defender. A win is permanent (LabRecord.secured never reverts) and is the
 * entire win condition (DESIGN.md §13) — a loss leaves the lab untouched,
 * retryable any time once a stronger party is available.
 */
export function resolveLabAssault(tweaks: Tweaks, lab: LabRecord, attackPower: number): { lab: LabRecord; won: boolean } {
  if (!resolveHordeTileFight(attackPower, tweaks.lab.guardian_defense)) {
    return { lab, won: false };
  }
  return { lab: { ...lab, secured: true }, won: true };
}

const COMPASS_4: Compass4[] = ["north", "east", "south", "west"];
const COMPASS_8 = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
const COMPASS_16 = [
  "north",
  "north-north-east",
  "north-east",
  "east-north-east",
  "east",
  "east-south-east",
  "south-east",
  "south-south-east",
  "south",
  "south-south-west",
  "south-west",
  "west-south-west",
  "west",
  "west-north-west",
  "north-west",
  "north-north-west",
];

/** Unit vectors in axialToPixel space (y decreases northward). */
const COMPASS_4_VEC: Record<Compass4, { x: number; y: number }> = {
  north: { x: 0, y: -1 },
  east: { x: 1, y: 0 },
  south: { x: 0, y: 1 },
  west: { x: -1, y: 0 },
};

export function compass4Bearing(from: Axial, to: Axial): Compass4 {
  const a = axialToPixel(from, 1);
  const b = axialToPixel(to, 1);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const bearingDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const normalizedDeg = (bearingDeg + 360) % 360;
  const index = Math.round(normalizedDeg / 90) % 4;
  return COMPASS_4[index];
}

/** True when `coord` lies in the same coarse quadrant from `base` as `bearing`. */
export function coordInCompass4Sector(base: Axial, coord: Axial, bearing: Compass4): boolean {
  return compass4Bearing(base, coord) === bearing;
}

/**
 * Per-tick signal chance for an active tower. L1 → 0; L2–3 → base; L4 → base × multiplier.
 */
export function watchtowerSignalChance(tweaks: Tweaks, level: number): number {
  if (level < WATCHTOWER_SIGNAL_MIN_LEVEL) return 0;
  const { per_watchtower_tick_base_chance, watchtower_intel_tier_multiplier } = tweaks.lab_clues.passive_surfacing;
  if (level >= 4) return per_watchtower_tick_base_chance * watchtower_intel_tier_multiplier;
  return per_watchtower_tick_base_chance;
}

/**
 * Deterministic roll for whether a tower hears a distant signal over `tickCount`
 * elapsed game ticks (compounds for offline catch-up, capped).
 */
export function rollWatchtowerSignal(
  tweaks: Tweaks,
  seed: number,
  towerCoord: Axial,
  level: number,
  rollSalt: number,
  tickCount: number = 1,
): boolean {
  const p = watchtowerSignalChance(tweaks, level);
  if (p <= 0 || tickCount <= 0) return false;
  const n = Math.min(Math.max(1, Math.floor(tickCount)), 600);
  const pAny = 1 - Math.pow(1 - p, n);
  const rollIndex = towerCoord.q * 91_337 + towerCoord.r * 67_421 + rollSalt;
  return seededRandom(seed, rollIndex) < pAny;
}

export function makeWatchtowerSignal(base: Axial, labCoord: Axial, setAt: number): WatchtowerSignal {
  return { bearing: compass4Bearing(base, labCoord), setAt };
}

export function watchtowerSignalToastText(bearing: Compass4): string {
  return `We picked up a distant signal in the ${bearing}.\nWe should get the scouts to check it out.`;
}

/**
 * Compass precision widens with clues collected — 4-point for the first two
 * (a coarse quadrant, DESIGN.md §13), 8-point for the next two, 16-point for
 * the fifth and final one ("north-north-east"-style arc). Never reveals a
 * coordinate, just a bearing — recomputed live off the CURRENT base position
 * every call rather than baked in at collection time, so it stays sensible
 * even if the base later relocates (Milestone 18).
 */
export function labClueText(cluesCollected: number, base: Axial, labCoord: Axial): string | null {
  if (cluesCollected <= 0) return null;

  const from = axialToPixel(base, 1);
  const to = axialToPixel(labCoord, 1);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const bearingDeg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const normalizedDeg = (bearingDeg + 360) % 360;

  const points = cluesCollected <= 2 ? COMPASS_4 : cluesCollected <= 4 ? COMPASS_8 : COMPASS_16;
  const index = Math.round(normalizedDeg / (360 / points.length)) % points.length;
  return `Rumors point to something calling from the ${points[index]}.`;
}

/**
 * Dot-product score for stepping from `from` toward `bearing` (higher = better
 * alignment). Used to weight wandering-scout neighbor picks.
 */
export function bearingStepScore(from: Axial, to: Axial, bearing: Compass4): number {
  const a = axialToPixel(from, 1);
  const b = axialToPixel(to, 1);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const v = COMPASS_4_VEC[bearing];
  return (dx / len) * v.x + (dy / len) * v.y;
}

/**
 * The final clue's approximate search-zone marker — a deterministic jittered
 * tile within lab_clues.final_search_area_radius_tiles of the TRUE lab
 * coord, never the coord itself (DESIGN.md §13: "a small cluster of hexes
 * rather than the exact tile" — the player still has to manually scout it).
 */
export function labSearchZoneCenter(seed: number, labCoord: Axial, radius: number, gridSize: number): Axial {
  const candidates = axialSpiral(labCoord, radius).filter((coord) => isWithinMapBounds(coord, gridSize));
  if (candidates.length === 0) return labCoord;
  const pickIndex = Math.floor(seededRandom(seed, 8_888_888) * candidates.length);
  return candidates[pickIndex];
}

/**
 * Tile keys in the final-clue search cluster (DESIGN.md §13), or null when the
 * player has not yet collected every clue / already secured the lab. Center is
 * jittered so the true lab tile is inside the cluster but not marked exactly.
 *
 * `force: true` skips the clue/secured gate (dev "Show hint" preview).
 */
export function labSearchZoneTileKeys(
  seed: number,
  lab: LabRecord,
  tweaks: Tweaks,
  gridSize: number,
  options?: { force?: boolean },
): Set<string> | null {
  if (!options?.force && (lab.secured || lab.cluesCollected < tweaks.lab_clues.total_clues)) {
    return null;
  }
  const radius = tweaks.lab_clues.final_search_area_radius_tiles;
  const center = labSearchZoneCenter(seed, lab.coord, radius, gridSize);
  const keys = new Set<string>();
  for (const coord of axialSpiral(center, radius)) {
    if (isWithinMapBounds(coord, gridSize)) keys.add(axialKey(coord));
  }
  return keys;
}
