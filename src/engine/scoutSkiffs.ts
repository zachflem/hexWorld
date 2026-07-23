import type { ScoutSkiffRecord } from "../data/scoutSkiffs";
import type { Tweaks } from "../data/tweaksSchema";
import { axialKey, axialNeighbors, isWithinMapBounds, type Axial } from "./hexCoords";
import { seededRandom } from "./noise";
import { terrainAt } from "./terrain";

/** A per-(skiff-position, step) deterministic index for the movement roll — varies with the tile it's standing on and how many steps it's taken, not just its id. */
function skiffRollIndex(coord: Axial, spawnedAt: number, step: number): number {
  return coord.q * 92_821 + coord.r * 68_917 + spawnedAt + step;
}

/**
 * Wanders a scout skiff randomly across its connected body of water, one
 * tile per tweaks.docks.scout_skiff.seconds_per_step — closed-form over
 * `elapsedSeconds` like every other per-tick system here (a fractional step
 * count, floored, so both live 1s ticks and multi-hour offline gaps resolve
 * the same way). Water-only filtering (terrainAt) naturally confines it to
 * its own connected body of water without any explicit flood-fill. Excludes
 * the tile it just came from when another option exists, so it doesn't just
 * oscillate between two tiles forever. Each new tile visited is appended to
 * `scoutedTiles` if not already present — the same reveal mechanism manual
 * land scouting uses (App.tsx:handleScoutTile). A skiff with no water
 * neighbors at all (shouldn't happen — it spawns on its dock's own water
 * tile) simply stays put for this call.
 */
export function advanceScoutSkiffs(
  tweaks: Tweaks,
  skiffs: ScoutSkiffRecord[],
  scoutedTiles: Axial[],
  seed: number,
  gridSize: number,
  elapsedSeconds: number,
): { skiffs: ScoutSkiffRecord[]; scoutedTiles: Axial[] } {
  if (elapsedSeconds <= 0 || skiffs.length === 0) return { skiffs, scoutedTiles };

  const steps = Math.floor(elapsedSeconds / tweaks.docks.scout_skiff.seconds_per_step);
  if (steps <= 0) return { skiffs, scoutedTiles };

  const scoutedKeys = new Set(scoutedTiles.map(axialKey));
  const newlyScouted: Axial[] = [];

  const nextSkiffs = skiffs.map((skiff) => {
    if (skiff.buildStartedAt != null) return skiff;

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

      const key = axialKey(coord);
      if (!scoutedKeys.has(key)) {
        scoutedKeys.add(key);
        newlyScouted.push(coord);
      }
    }

    return coord === skiff.coord && prevCoord === skiff.prevCoord ? skiff : { ...skiff, coord, prevCoord };
  });

  return {
    skiffs: nextSkiffs,
    scoutedTiles: newlyScouted.length > 0 ? [...scoutedTiles, ...newlyScouted] : scoutedTiles,
  };
}
