import type { LabRecord } from "../data/lab";
import type { Tweaks } from "../data/tweaksSchema";
import { resolveHordeTileFight } from "./hordes";
import { axialSpiral, axialToPixel, isWithinMapBounds, type Axial } from "./hexCoords";
import { seededRandom } from "./noise";

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

/**
 * Passive clue roll for a single scout action (DESIGN.md §13 — "every scout
 * action... carries a small passive chance to surface a clue"). Deterministic
 * via seededRandom, same style as engine/hordes.ts:denRollIndex — the index
 * mixes the scouted coord with `scoutCount` (a running total of scout
 * actions so far) so repeat scouting of the same tile, or two different
 * players on the same seed, don't collapse onto the same roll.
 */
export function rollScoutClue(tweaks: Tweaks, seed: number, coord: Axial, scoutCount: number): boolean {
  const rollIndex = coord.q * 74_207 + coord.r * 51_991 + scoutCount;
  return seededRandom(seed, rollIndex) < tweaks.lab_clues.passive_surfacing.per_scout_action_chance;
}

const COMPASS_4 = ["north", "east", "south", "west"];
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
