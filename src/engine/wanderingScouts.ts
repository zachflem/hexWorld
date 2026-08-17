import type { WatchtowerSignal } from "../data/lab";
import type { WanderingScoutRecord } from "../data/wanderingScouts";
import type { Tweaks } from "../data/tweaksSchema";
import { bearingStepScore } from "./lab";
import { axialDistance, axialKey, axialNeighbors, axialSpiral, isWithinMapBounds, type Axial } from "./hexCoords";
import { seededRandom } from "./noise";
import { terrainAt } from "./terrain";

/** A per-(scout-position, step) deterministic index for the movement roll — varies with the tile it's standing on and how many steps it's taken, not just its id. */
function wanderingScoutRollIndex(coord: Axial, spawnedAt: number, step: number): number {
  return coord.q * 51_263 + coord.r * 37_649 + spawnedAt + step;
}

/** +1 when stepping closer to lab, 0 equal, -1 farther — neighbors only change distance by at most 1. */
function labApproachScore(from: Axial, to: Axial, lab: Axial): number {
  return axialDistance(from, lab) - axialDistance(to, lab);
}

type SignalGuidanceWeights = {
  bearingWeight: number;
  labApproachWeight: number;
  labTileBonus: number;
};

function pickWeightedNeighbor(
  candidates: Axial[],
  from: Axial,
  bearing: WatchtowerSignal["bearing"] | null,
  labCoord: Axial | null,
  seed: number,
  rollIndex: number,
  guidance: SignalGuidanceWeights,
): Axial {
  if (candidates.length === 1) return candidates[0];
  if (!bearing) {
    const roll = seededRandom(seed, rollIndex);
    return candidates[Math.min(candidates.length - 1, Math.floor(roll * candidates.length))];
  }

  // Active watchtower signal: sector bias (+ optional lab magnetism if weights > 0).
  // Scouts never award clues — dens do; this only nudges exploration.
  const labKey = labCoord ? axialKey(labCoord) : null;
  const weights = candidates.map((c) => {
    let score = guidance.bearingWeight * bearingStepScore(from, c, bearing);
    if (labCoord) {
      score += guidance.labApproachWeight * labApproachScore(from, c, labCoord);
      if (labKey && axialKey(c) === labKey) score += guidance.labTileBonus;
    }
    return Math.exp(score);
  });
  const total = weights.reduce((sum, w) => sum + w, 0);
  let cursor = seededRandom(seed, rollIndex) * total;
  for (let i = 0; i < candidates.length; i++) {
    cursor -= weights[i];
    if (cursor <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

export type AdvanceWanderingScoutsOptions = {
  /** Active watchtower listening focus — soft compass-sector bias only (lab magnetism is tweakable, default off). */
  signal: WatchtowerSignal | null;
  base: Axial;
  /** True lab tile — only used when signal_lab_* weights are non-zero (default 0 = vague bearing only). */
  labCoord: Axial;
  /**
   * Axial spiral radius revealed around each stepped hex (Improved Optics).
   * 0 = stepped tile only. All terrain types (including water) are revealed.
   */
  revealRadius?: number;
  /** When true (Scout to Own researched), newly-scouted tiles are also claimed. */
  claimOwnership?: boolean;
  /** Hex keys that must never be claimed (active dens + unsecured lab). */
  unclaimableKeys?: ReadonlySet<string>;
  /** Hex keys of horde-occupied tiles — never claimed. */
  hordeKeys?: ReadonlySet<string>;
};

/**
 * Wanders a land-based scout randomly across connected land, one tile per
 * tweaks.units.wandering_scout.seconds_per_step. Accumulates
 * `stepProgressSeconds` across live ~1s ticks (and offline gaps) so flooring
 * a single tick's elapsedSeconds never discards progress. Land-only filtering
 * (terrainAt !== "water") naturally confines it to reachable land without any
 * explicit flood-fill — the exact mirror of engine/scoutSkiffs.ts's water-only
 * confinement. Excludes the tile it just came from when another option exists,
 * so it doesn't just oscillate between two tiles forever. Each new tile visited
 * (plus an optional reveal disk from Improved Optics) is appended to
 * `scoutedTiles` if not already present — the same reveal mechanism the scout
 * skiff uses.
 *
 * Wandering scouts never award lab clues (den clears do). An active watchtower
 * signal (#38) softly biases neighbor picks toward that compass sector
 * (`signal_bearing_weight`). Lab approach / tile bonuses exist in tweaks but
 * default to 0 so signals stay vague — not a bee-line.
 */
export function advanceWanderingScouts(
  tweaks: Tweaks,
  scouts: WanderingScoutRecord[],
  scoutedTiles: Axial[],
  seed: number,
  gridSize: number,
  elapsedSeconds: number,
  options?: AdvanceWanderingScoutsOptions,
): { scouts: WanderingScoutRecord[]; scoutedTiles: Axial[]; labRevealed: boolean; claimedTiles: Axial[] } {
  if (elapsedSeconds <= 0 || scouts.length === 0) {
    return { scouts, scoutedTiles, labRevealed: false, claimedTiles: [] };
  }

  const secondsPerStep = tweaks.units.wandering_scout.seconds_per_step;
  const surfacing = tweaks.lab_clues.passive_surfacing;
  const guidance: SignalGuidanceWeights = {
    bearingWeight: surfacing.signal_bearing_weight,
    labApproachWeight: surfacing.signal_lab_approach_weight,
    labTileBonus: surfacing.signal_lab_tile_bonus,
  };
  const signal = options?.signal ?? null;
  const labCoord = options?.labCoord ?? null;
  const labKey = labCoord ? axialKey(labCoord) : null;
  const revealRadius = options?.revealRadius ?? 0;
  const claimOwnership = options?.claimOwnership ?? false;
  const unclaimableKeys = options?.unclaimableKeys;
  const hordeKeys = options?.hordeKeys;

  const scoutedKeys = new Set(scoutedTiles.map(axialKey));
  const labAlreadyKnown = labKey != null && scoutedKeys.has(labKey);
  const newlyScouted: Axial[] = [];
  const claimedTiles: Axial[] = [];
  let labRevealed = false;
  let anyChanged = false;

  const nextScouts = scouts.map((scout) => {
    if (scout.buildStartedAt != null) return scout;

    const available = (scout.stepProgressSeconds ?? 0) + elapsedSeconds;
    const steps = Math.floor(available / secondsPerStep);
    const stepProgressSeconds = available - steps * secondsPerStep;

    let coord = scout.coord;
    let prevCoord = scout.prevCoord;

    for (let step = 0; step < steps; step++) {
      const prevKey = prevCoord ? axialKey(prevCoord) : null;
      let candidates = axialNeighbors(coord).filter((n) => isWithinMapBounds(n, gridSize) && terrainAt(seed, n) !== "water");
      if (candidates.length > 1 && prevKey) {
        candidates = candidates.filter((n) => axialKey(n) !== prevKey);
      }
      if (candidates.length === 0) break;

      const next = pickWeightedNeighbor(
        candidates,
        coord,
        signal?.bearing ?? null,
        signal && labCoord ? labCoord : null,
        seed,
        wanderingScoutRollIndex(coord, scout.spawnedAt, step),
        guidance,
      );

      prevCoord = coord;
      coord = next;

      for (const reveal of axialSpiral(coord, revealRadius)) {
        if (!isWithinMapBounds(reveal, gridSize)) continue;
        const key = axialKey(reveal);
        if (scoutedKeys.has(key)) continue;
        scoutedKeys.add(key);
        newlyScouted.push(reveal);
        if (labKey != null && key === labKey && !labAlreadyKnown) {
          labRevealed = true;
        }
      }
      if (claimOwnership) {
        for (const reveal of axialSpiral(coord, revealRadius)) {
          if (!isWithinMapBounds(reveal, gridSize)) continue;
          const key = axialKey(reveal);
          if (unclaimableKeys?.has(key) || hordeKeys?.has(key)) continue;
          claimedTiles.push(reveal);
        }
      }
    }

    if (
      coord === scout.coord &&
      prevCoord === scout.prevCoord &&
      stepProgressSeconds === (scout.stepProgressSeconds ?? 0)
    ) {
      return scout;
    }
    anyChanged = true;
    return { ...scout, coord, prevCoord, stepProgressSeconds };
  });

  return {
    scouts: anyChanged ? nextScouts : scouts,
    scoutedTiles: newlyScouted.length > 0 ? [...scoutedTiles, ...newlyScouted] : scoutedTiles,
    labRevealed,
    claimedTiles,
  };
}
