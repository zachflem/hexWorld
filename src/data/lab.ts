import type { DenRecord } from "./dens";
import { axialKey, axialRing, isWithinMapBounds, type Axial } from "../engine/hexCoords";
import { seededRandom } from "../engine/noise";
import { terrainAt } from "../engine/terrain";
import type { Tweaks } from "./tweaksSchema";

export interface LabRecord {
  coord: Axial;
  /** True once a party has beaten the guardian (engine/lab.ts:resolveLabAssault) — permanent, this is the entire win condition (DESIGN.md §13). */
  secured: boolean;
  /** 0..tweaks.lab_clues.total_clues — see engine/lab.ts:labClueText for how this turns into a directional hint. */
  cluesCollected: number;
}

export const LAB_DB_KEY = "lab";

/**
 * Deterministic single-tile placement — same spiral-candidate-then-pick
 * shape as data/dens.ts:createDens (seededRandom, no Math.random(), so the
 * same world seed always yields the same lab tile), starting the search at
 * lab.min_distance_from_base rather than dens' own (shorter) floor, and
 * excluding every den tile so the lab never doubles up with one. A distinct
 * seed offset (index 9_999_999 range) keeps this pick independent of
 * createDens's own seededRandom calls for the same seed.
 */
export function createLab(seed: number, gridSize: number, base: Axial, dens: DenRecord[], tweaks: Tweaks): LabRecord {
  const { min_distance_from_base } = tweaks.lab;
  const maxRadius = Math.floor(gridSize / 2);
  const denKeys = new Set(dens.map((d) => axialKey(d.coord)));

  const candidates: Axial[] = [];
  for (let radius = min_distance_from_base; radius <= maxRadius; radius++) {
    for (const coord of axialRing(base, radius)) {
      if (!isWithinMapBounds(coord, gridSize)) continue;
      if (terrainAt(seed, coord) === "water") continue;
      if (denKeys.has(axialKey(coord))) continue;
      candidates.push(coord);
    }
    if (candidates.length >= 20) break;
  }

  const fallback = { q: base.q + maxRadius, r: base.r };
  const pickIndex = candidates.length > 0 ? Math.floor(seededRandom(seed, 9_999_999) * candidates.length) : 0;
  const coord = candidates[pickIndex] ?? fallback;

  return { coord, secured: false, cluesCollected: 0 };
}
