import type { WatchtowerSignal } from "../data/lab";
import type { WanderingScoutRecord } from "../data/wanderingScouts";
import type { Tweaks } from "../data/tweaksSchema";
import { bearingStepScore } from "./lab";
import { axialDistance, axialKey, axialNeighbors, isWithinMapBounds, type Axial } from "./hexCoords";
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

function pickWeightedNeighbor(
  candidates: Axial[],
  from: Axial,
  bearing: WatchtowerSignal["bearing"] | null,
  labCoord: Axial | null,
  seed: number,
  rollIndex: number,
): Axial {
  if (candidates.length === 1) return candidates[0];
  if (!bearing) {
    const roll = seededRandom(seed, rollIndex);
    return candidates[Math.min(candidates.length - 1, Math.floor(roll * candidates.length))];
  }

  // Active watchtower signal: sector bias + pull toward the true lab so guided
  // scouts are more likely to step onto it (they never award clues — dens do).
  const labKey = labCoord ? axialKey(labCoord) : null;
  const weights = candidates.map((c) => {
    let score = 2.5 * bearingStepScore(from, c, bearing);
    if (labCoord) {
      score += 3.5 * labApproachScore(from, c, labCoord);
      if (labKey && axialKey(c) === labKey) score += 4;
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
  /** Active watchtower listening focus — biases steps toward that sector + the lab. */
  signal: WatchtowerSignal | null;
  base: Axial;
  /** True lab tile — used only while a signal is active to pull scouts toward it. */
  labCoord: Axial;
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
 * is appended to `scoutedTiles` if not already present — the same reveal
 * mechanism the scout skiff uses.
 *
 * Wandering scouts never award lab clues (den clears do). An active watchtower
 * signal (#38) biases neighbor picks toward that compass sector and pulls
 * toward the lab tile so guided search is more likely to reveal it.
 */
export function advanceWanderingScouts(
  tweaks: Tweaks,
  scouts: WanderingScoutRecord[],
  scoutedTiles: Axial[],
  seed: number,
  gridSize: number,
  elapsedSeconds: number,
  options?: AdvanceWanderingScoutsOptions,
): { scouts: WanderingScoutRecord[]; scoutedTiles: Axial[]; labRevealed: boolean } {
  if (elapsedSeconds <= 0 || scouts.length === 0) {
    return { scouts, scoutedTiles, labRevealed: false };
  }

  const secondsPerStep = tweaks.units.wandering_scout.seconds_per_step;
  const signal = options?.signal ?? null;
  const labCoord = options?.labCoord ?? null;
  const labKey = labCoord ? axialKey(labCoord) : null;

  const scoutedKeys = new Set(scoutedTiles.map(axialKey));
  const labAlreadyKnown = labKey != null && scoutedKeys.has(labKey);
  const newlyScouted: Axial[] = [];
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
      );

      prevCoord = coord;
      coord = next;

      const key = axialKey(coord);
      if (!scoutedKeys.has(key)) {
        scoutedKeys.add(key);
        newlyScouted.push(coord);
        if (labKey != null && key === labKey && !labAlreadyKnown) {
          labRevealed = true;
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
  };
}
