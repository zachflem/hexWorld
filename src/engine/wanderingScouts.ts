import type { WatchtowerSignal } from "../data/lab";
import type { WanderingScoutRecord } from "../data/wanderingScouts";
import type { Tweaks } from "../data/tweaksSchema";
import { bearingStepScore, rollScoutClue } from "./lab";
import { axialKey, axialNeighbors, isWithinMapBounds, type Axial } from "./hexCoords";
import { seededRandom } from "./noise";
import { terrainAt } from "./terrain";

/** A per-(scout-position, step) deterministic index for the movement roll — varies with the tile it's standing on and how many steps it's taken, not just its id. */
function wanderingScoutRollIndex(coord: Axial, spawnedAt: number, step: number): number {
  return coord.q * 51_263 + coord.r * 37_649 + spawnedAt + step;
}

function pickWeightedNeighbor(
  candidates: Axial[],
  from: Axial,
  bearing: WatchtowerSignal["bearing"] | null,
  seed: number,
  rollIndex: number,
): Axial {
  if (candidates.length === 1) return candidates[0];
  if (!bearing) {
    const roll = seededRandom(seed, rollIndex);
    return candidates[Math.min(candidates.length - 1, Math.floor(roll * candidates.length))];
  }

  // Soft-but-noticeable bias: score ∈ [-1, 1] → weight via exp so aligned
  // steps dominate without zeroing opposite neighbors.
  const weights = candidates.map((c) => Math.exp(2.5 * bearingStepScore(from, c, bearing)));
  const total = weights.reduce((sum, w) => sum + w, 0);
  let cursor = seededRandom(seed, rollIndex) * total;
  for (let i = 0; i < candidates.length; i++) {
    cursor -= weights[i];
    if (cursor <= 0) return candidates[i];
  }
  return candidates[candidates.length - 1];
}

export type AdvanceWanderingScoutsOptions = {
  /** Active watchtower listening focus — biases steps toward that sector. */
  signal: WatchtowerSignal | null;
  base: Axial;
  /** Current lab clue count — passive rolls stop once at the cap. */
  cluesCollected: number;
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
 * Newly scouted tiles roll a passive lab clue (`per_scout_action_chance`);
 * at most one clue per advance. An active watchtower signal (#38) only biases
 * neighbor picks toward that compass sector (it does not gate the clue roll).
 */
export function advanceWanderingScouts(
  tweaks: Tweaks,
  scouts: WanderingScoutRecord[],
  scoutedTiles: Axial[],
  seed: number,
  gridSize: number,
  elapsedSeconds: number,
  options?: AdvanceWanderingScoutsOptions,
): { scouts: WanderingScoutRecord[]; scoutedTiles: Axial[]; clueAwarded: boolean } {
  if (elapsedSeconds <= 0 || scouts.length === 0) {
    return { scouts, scoutedTiles, clueAwarded: false };
  }

  const secondsPerStep = tweaks.units.wandering_scout.seconds_per_step;
  const signal = options?.signal ?? null;
  const cluesCollected = options?.cluesCollected ?? 0;
  const canRollClue = cluesCollected < tweaks.lab_clues.total_clues;

  const scoutedKeys = new Set(scoutedTiles.map(axialKey));
  const newlyScouted: Axial[] = [];
  let clueAwarded = false;
  let scoutCount = scoutedTiles.length;
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
        seed,
        wanderingScoutRollIndex(coord, scout.spawnedAt, step),
      );

      prevCoord = coord;
      coord = next;

      const key = axialKey(coord);
      if (!scoutedKeys.has(key)) {
        scoutedKeys.add(key);
        newlyScouted.push(coord);
        scoutCount += 1;

        if (canRollClue && !clueAwarded && rollScoutClue(tweaks, seed, coord, scoutCount)) {
          clueAwarded = true;
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
    clueAwarded,
  };
}
