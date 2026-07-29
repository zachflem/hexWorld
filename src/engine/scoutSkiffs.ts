import type { ScoutSkiffRecord } from "../data/scoutSkiffs";
import type { Tweaks } from "../data/tweaksSchema";
import { axialKey, axialNeighbors, axialSpiral, isWithinMapBounds, type Axial } from "./hexCoords";
import { seededRandom } from "./noise";
import { terrainAt } from "./terrain";

/** A per-(skiff-position, step) deterministic index for the movement roll — varies with the tile it's standing on and how many steps it's taken, not just its id. */
function skiffRollIndex(coord: Axial, spawnedAt: number, step: number): number {
  return coord.q * 92_821 + coord.r * 68_917 + spawnedAt + step;
}

/**
 * Wanders a scout skiff randomly across its connected body of water, one
 * tile per tweaks.docks.scout_skiff.seconds_per_step. Accumulates
 * `stepProgressSeconds` across live ~1s ticks (and offline gaps) so flooring
 * a single tick's elapsedSeconds never discards progress. Water-only filtering
 * (terrainAt) naturally confines it to its own connected body of water without
 * any explicit flood-fill. Excludes the tile it just came from when another
 * option exists, so it doesn't just oscillate between two tiles forever. Each
 * new tile visited is appended to `scoutedTiles` if not already present — the
 * same reveal mechanism land Wandering Scouts use. A skiff with no water
 * neighbors at all (shouldn't happen — it spawns on its dock's own water
 * tile) simply stays put for this call (progress still carries).
 */
export type AdvanceScoutSkiffsOptions = {
  /**
   * Axial spiral radius revealed around each stepped hex (Improved Optics).
   * 0 = stepped tile only. All terrain types (including land) are revealed.
   */
  revealRadius?: number;
  /** When true (Scout to Own researched), newly-scouted tiles are also claimed. */
  claimOwnership?: boolean;
  /** Hex keys that must never be claimed (active dens + unsecured lab). */
  unclaimableKeys?: ReadonlySet<string>;
  /** Hex keys of horde-occupied tiles — never claimed. */
  hordeKeys?: ReadonlySet<string>;
};

export function advanceScoutSkiffs(
  tweaks: Tweaks,
  skiffs: ScoutSkiffRecord[],
  scoutedTiles: Axial[],
  seed: number,
  gridSize: number,
  elapsedSeconds: number,
  options?: AdvanceScoutSkiffsOptions,
): { skiffs: ScoutSkiffRecord[]; scoutedTiles: Axial[]; claimedTiles: Axial[] } {
  if (elapsedSeconds <= 0 || skiffs.length === 0) return { skiffs, scoutedTiles, claimedTiles: [] };

  const secondsPerStep = tweaks.docks.scout_skiff.seconds_per_step;
  const revealRadius = options?.revealRadius ?? 0;
  const claimOwnership = options?.claimOwnership ?? false;
  const unclaimableKeys = options?.unclaimableKeys;
  const hordeKeys = options?.hordeKeys;
  const scoutedKeys = new Set(scoutedTiles.map(axialKey));
  const newlyScouted: Axial[] = [];
  const claimedTiles: Axial[] = [];
  let anyChanged = false;

  const nextSkiffs = skiffs.map((skiff) => {
    if (skiff.buildStartedAt != null) return skiff;

    const available = (skiff.stepProgressSeconds ?? 0) + elapsedSeconds;
    const steps = Math.floor(available / secondsPerStep);
    const stepProgressSeconds = available - steps * secondsPerStep;

    let coord = skiff.coord;
    let prevCoord = skiff.prevCoord;

    for (let step = 0; step < steps; step++) {
      const prevKey = prevCoord ? axialKey(prevCoord) : null;
      let candidates = axialNeighbors(coord).filter((n) => isWithinMapBounds(n, gridSize) && terrainAt(seed, n) === "water");
      if (candidates.length > 1 && prevKey) {
        candidates = candidates.filter((n) => axialKey(n) !== prevKey);
      }
      if (candidates.length === 0) break;

      const roll = seededRandom(seed, skiffRollIndex(coord, skiff.spawnedAt, step));
      const next = candidates[Math.min(candidates.length - 1, Math.floor(roll * candidates.length))];

      prevCoord = coord;
      coord = next;

      for (const reveal of axialSpiral(coord, revealRadius)) {
        if (!isWithinMapBounds(reveal, gridSize)) continue;
        const key = axialKey(reveal);
        if (scoutedKeys.has(key)) continue;
        scoutedKeys.add(key);
        newlyScouted.push(reveal);
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
      coord === skiff.coord &&
      prevCoord === skiff.prevCoord &&
      stepProgressSeconds === (skiff.stepProgressSeconds ?? 0)
    ) {
      return skiff;
    }
    anyChanged = true;
    return { ...skiff, coord, prevCoord, stepProgressSeconds };
  });

  return {
    skiffs: anyChanged ? nextSkiffs : skiffs,
    scoutedTiles: newlyScouted.length > 0 ? [...scoutedTiles, ...newlyScouted] : scoutedTiles,
    claimedTiles,
  };
}
