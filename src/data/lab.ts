import type { DenRecord } from "./dens";
import { axialKey, type Axial } from "../engine/hexCoords";
import { seededRandom } from "../engine/noise";
import type { Tweaks } from "./tweaksSchema";
import { placeFeatures } from "./featurePlacement";

/** Coarse quadrant from a watchtower "distant signal" — guides wandering scouts, does not itself award a lab clue. */
export type Compass4 = "north" | "east" | "south" | "west";

export interface WatchtowerSignal {
  bearing: Compass4;
  /** Virtual clock when the signal was set (App tick). */
  setAt: number;
}

export interface LabRecord {
  coord: Axial;
  /** True once a party has beaten the guardian (engine/lab.ts:resolveLabAssault) — permanent, this is the entire win condition (DESIGN.md §13). */
  secured: boolean;
  /**
   * 0..tweaks.lab_clues.total_clues — den-clear awards only (wandering scouts
   * never increment this). See engine/lab.ts:labClueText for directional text.
   */
  cluesCollected: number;
  /**
   * Static guardian strength for this world — rolled once at createLab from
   * tweaks.lab.guardian_defense_min..max. Absent on legacy saves (hydrate via
   * {@link ensureLabGuardianDefense}).
   */
  guardianDefense: number;
  /**
   * Active watchtower listening focus (#38). Vague 4-point bearing toward the lab;
   * biases wandering scouts. Absent/null on legacy saves.
   */
  watchtowerSignal?: WatchtowerSignal | null;
}

export const LAB_DB_KEY = "lab";

/** seed salt for placeFeatures — keep clear of dens / scrap (#36) salts. */
export const LAB_PLACEMENT_SALT = 9_999_999;

/** Separate salt for guardian defense roll — must not collide with placement picks. */
export const LAB_GUARDIAN_SALT = 9_999_991;

/**
 * Deterministic integer in inclusive [min, max] for this world seed.
 */
export function rollLabGuardianDefense(seed: number, tweaks: Tweaks): number {
  const min = Math.floor(tweaks.lab.guardian_defense_min);
  const max = Math.floor(tweaks.lab.guardian_defense_max);
  if (max <= min) return min;
  const span = max - min + 1;
  return min + Math.floor(seededRandom(seed, LAB_GUARDIAN_SALT) * span);
}

/**
 * Fill missing guardianDefense on legacy saves (same seed → same roll as createLab).
 */
export function ensureLabGuardianDefense(lab: LabRecord, seed: number, tweaks: Tweaks): LabRecord {
  if (typeof lab.guardianDefense === "number" && Number.isFinite(lab.guardianDefense)) {
    return lab;
  }
  return { ...lab, guardianDefense: rollLabGuardianDefense(seed, tweaks) };
}

/**
 * Deterministic single-tile lab placement via shared `placeFeatures` — farther
 * than dens, never on a den tile, never water. Same seed → same lab.
 */
export function createLab(seed: number, gridSize: number, base: Axial, dens: DenRecord[], tweaks: Tweaks): LabRecord {
  const { min_distance_from_base } = tweaks.lab;
  const denKeys = new Set(dens.map((d) => axialKey(d.coord)));
  const maxRadius = Math.floor(gridSize / 2);

  const [coord] = placeFeatures({
    seed,
    gridSize,
    salt: LAB_PLACEMENT_SALT,
    count: 1,
    minSeparation: 0,
    anchors: [{ coords: [base], minDistance: min_distance_from_base }],
    excludedKeys: denKeys,
  });

  const fallback = { q: base.q + maxRadius, r: base.r };
  return {
    coord: coord ?? fallback,
    secured: false,
    cluesCollected: 0,
    guardianDefense: rollLabGuardianDefense(seed, tweaks),
    watchtowerSignal: null,
  };
}
