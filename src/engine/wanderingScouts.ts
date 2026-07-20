import type { WanderingScoutRecord } from "../data/wanderingScouts";
import type { Tweaks } from "../data/tweaksSchema";
import { axialKey, axialNeighbors, isWithinMapBounds, type Axial } from "./hexCoords";
import { seededRandom } from "./noise";
import { terrainAt } from "./terrain";

/** A per-(scout-position, step) deterministic index for the movement roll — varies with the tile it's standing on and how many steps it's taken, not just its id. */
function wanderingScoutRollIndex(coord: Axial, spawnedAt: number, step: number): number {
  return coord.q * 51_263 + coord.r * 37_649 + spawnedAt + step;
}

/**
 * Wanders a land-based scout randomly across connected land, one tile per
 * tweaks.units.wandering_scout.seconds_per_step — closed-form over
 * `elapsedSeconds` like every other per-tick system here (a fractional step
 * count, floored, so both live 1s ticks and multi-hour offline gaps resolve
 * the same way). Land-only filtering (terrainAt !== "water") naturally
 * confines it to reachable land without any explicit flood-fill — the exact
 * mirror of engine/scoutSkiffs.ts's water-only confinement. Excludes the
 * tile it just came from when another option exists, so it doesn't just
 * oscillate between two tiles forever. Each new tile visited is appended to
 * `scoutedTiles` if not already present — the same reveal mechanism manual
 * land scouting and the scout skiff both use.
 */
export function advanceWanderingScouts(
  tweaks: Tweaks,
  scouts: WanderingScoutRecord[],
  scoutedTiles: Axial[],
  seed: number,
  gridSize: number,
  elapsedSeconds: number,
): { scouts: WanderingScoutRecord[]; scoutedTiles: Axial[] } {
  if (elapsedSeconds <= 0 || scouts.length === 0) return { scouts, scoutedTiles };

  const steps = Math.floor(elapsedSeconds / tweaks.units.wandering_scout.seconds_per_step);
  if (steps <= 0) return { scouts, scoutedTiles };

  const scoutedKeys = new Set(scoutedTiles.map(axialKey));
  const newlyScouted: Axial[] = [];

  const nextScouts = scouts.map((scout) => {
    if (scout.buildStartedAt !== null) return scout;

    let coord = scout.coord;
    let prevCoord = scout.prevCoord;

    for (let step = 0; step < steps; step++) {
      const prevKey = prevCoord ? axialKey(prevCoord) : null;
      let candidates = axialNeighbors(coord).filter((n) => isWithinMapBounds(n, gridSize) && terrainAt(seed, n) !== "water");
      if (candidates.length > 1 && prevKey) {
        candidates = candidates.filter((n) => axialKey(n) !== prevKey);
      }
      if (candidates.length === 0) break;

      const roll = seededRandom(seed, wanderingScoutRollIndex(coord, scout.spawnedAt, step));
      const next = candidates[Math.min(candidates.length - 1, Math.floor(roll * candidates.length))];

      prevCoord = coord;
      coord = next;

      const key = axialKey(coord);
      if (!scoutedKeys.has(key)) {
        scoutedKeys.add(key);
        newlyScouted.push(coord);
      }
    }

    return coord === scout.coord && prevCoord === scout.prevCoord ? scout : { ...scout, coord, prevCoord };
  });

  return {
    scouts: nextScouts,
    scoutedTiles: newlyScouted.length > 0 ? [...scoutedTiles, ...newlyScouted] : scoutedTiles,
  };
}
