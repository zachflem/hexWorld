import type { Tweaks } from "../data/tweaksSchema";
import { axialKey, axialNeighbors, isWithinMapBounds, type Axial } from "./hexCoords";
import { terrainAt, type TerrainType } from "./terrain";

/** Per-tile traversal cost for pathfinding — tweaks.jsonc horde.pathfinding.terrain_cost. null = impassable. */
export function terrainCost(tweaks: Tweaks, terrain: TerrainType): number | null {
  return tweaks.horde.pathfinding.terrain_cost[terrain];
}

export interface PathResult {
  path: Axial[];
  /** Total accumulated terrain cost along the route (sum of terrainCost per tile entered, not raw tile count). */
  cost: number;
}

/**
 * Weighted shortest path from `from` to `to`, terrain costs only, plus an
 * `isAllowed` gate a caller can use to additionally restrict which tiles the
 * search may ever step onto (e.g. "only owned or scouted ground" for a
 * player expedition — see findExpeditionPath below). `findHordePath` passes
 * an always-true gate, so it never factors in tile ownership (see
 * src/data/hordes.ts for why that matters for offline-gap correctness).
 * Dijkstra over the hex grid; array-based priority queue with lazy deletion
 * is plenty given the grid is at most 128x128 and the search terminates as
 * soon as the goal is popped (explored in increasing-distance order), so it
 * never has to touch the whole map for a den anywhere near base. Returns
 * null if no route exists within the allowed set (e.g. a den fully
 * water-locked from base, or a destination not yet reachable through known
 * territory).
 */
/**
 * Same search as the single-goal version, generalized to stop at whichever
 * of `goalKeys` is popped first — since the frontier is explored in
 * increasing-distance order, that's guaranteed to be the nearest goal
 * reachable, not just *a* reachable one. The single-goal `dijkstraCore`
 * below is just this with a one-element goal set.
 */
function dijkstraCoreMultiGoal(
  tweaks: Tweaks,
  seed: number,
  from: Axial,
  goalKeys: Set<string>,
  gridSize: number,
  isAllowed: (coord: Axial) => boolean,
  /** Extra pathfinding weight when *entering* a tile (does not change reported terrain-only cost). */
  edgeExtraCost: (coord: Axial) => number = () => 0,
): (PathResult & { reachedKey: string }) | null {
  const startKey = axialKey(from);

  const dist = new Map<string, number>([[startKey, 0]]);
  const prev = new Map<string, Axial>();
  const visited = new Set<string>();
  const frontier: Axial[] = [from];

  let reachedKey: string | null = null;
  let reachedNode: Axial | null = null;

  while (frontier.length > 0) {
    let bestIndex = -1;
    let bestDist = Infinity;
    for (let i = 0; i < frontier.length; i++) {
      const d = dist.get(axialKey(frontier[i])) ?? Infinity;
      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    }
    if (bestIndex === -1) break;

    const [current] = frontier.splice(bestIndex, 1);
    const currentKey = axialKey(current);
    if (visited.has(currentKey)) continue;
    visited.add(currentKey);

    if (goalKeys.has(currentKey)) {
      reachedKey = currentKey;
      reachedNode = current;
      break;
    }

    for (const neighbor of axialNeighbors(current)) {
      if (!isWithinMapBounds(neighbor, gridSize)) continue;
      const neighborKey = axialKey(neighbor);
      if (visited.has(neighborKey)) continue;
      if (!isAllowed(neighbor)) continue;

      const cost = terrainCost(tweaks, terrainAt(seed, neighbor));
      if (cost === null) continue;

      const candidateDist = bestDist + cost + edgeExtraCost(neighbor);
      if (candidateDist < (dist.get(neighborKey) ?? Infinity)) {
        dist.set(neighborKey, candidateDist);
        prev.set(neighborKey, current);
        frontier.push(neighbor);
      }
    }
  }

  if (reachedKey === null || reachedNode === null) return null;

  const path: Axial[] = [reachedNode];
  let cursor = reachedNode;
  while (axialKey(cursor) !== startKey) {
    const previous = prev.get(axialKey(cursor));
    if (!previous) return null; // unreachable in practice — dist.has(reachedKey) already guards this
    path.push(previous);
    cursor = previous;
  }
  const reversed = path.reverse();
  // Provisions/travel use pure terrain cost; edgeExtraCost only steered the route.
  let terrainOnlyCost = 0;
  for (let i = 1; i < reversed.length; i++) {
    const stepCost = terrainCost(tweaks, terrainAt(seed, reversed[i]));
    if (stepCost === null) return null;
    terrainOnlyCost += stepCost;
  }
  return { path: reversed, cost: terrainOnlyCost, reachedKey };
}

function dijkstraCore(
  tweaks: Tweaks,
  seed: number,
  from: Axial,
  to: Axial,
  gridSize: number,
  isAllowed: (coord: Axial) => boolean,
  edgeExtraCost: (coord: Axial) => number = () => 0,
): PathResult | null {
  const result = dijkstraCoreMultiGoal(tweaks, seed, from, new Set([axialKey(to)]), gridSize, isAllowed, edgeExtraCost);
  return result ? { path: result.path, cost: result.cost } : null;
}

/** Unrestricted by ownership — see dijkstraCore's doc comment. Unchanged behavior/signature from before the dijkstraCore extraction. */
export function findHordePath(tweaks: Tweaks, seed: number, from: Axial, to: Axial, gridSize: number): Axial[] | null {
  return dijkstraCore(tweaks, seed, from, to, gridSize, () => true)?.path ?? null;
}

/**
 * Like findHordePath, but instead of one fixed destination takes a list of
 * candidate hub coordinates (the main base plus every live outpost) and
 * paths to whichever one is nearest by accumulated terrain cost — used at
 * horde spawn time (engine/hordes.ts:checkHordeSpawns) so a horde attacks
 * the closest player structure instead of always beelining for the base.
 * Same "fixed path for the horde's whole lifetime" behavior as
 * findHordePath — this only changes which target that fixed path is
 * computed toward, not when it's recomputed. Returns null if none of the
 * candidates are reachable at all.
 */
export function findNearestHordeTarget(
  tweaks: Tweaks,
  seed: number,
  from: Axial,
  candidates: Axial[],
  gridSize: number,
): { path: Axial[]; target: Axial } | null {
  const goalKeys = new Set(candidates.map(axialKey));
  const result = dijkstraCoreMultiGoal(tweaks, seed, from, goalKeys, gridSize, () => true);
  if (!result) return null;
  const target = candidates.find((c) => axialKey(c) === result.reachedKey);
  if (!target) return null;
  return { path: result.path, target };
}

/**
 * Same terrain-cost Dijkstra as findHordePath, additionally restricted to
 * `allowedTiles` (typically owned ∪ scouted, as axialKey strings) — used for
 * routing a player expedition, which should never cut through fog. Since the
 * destination itself must pass this same gate to ever be reached, requiring
 * a scouted-or-owned target falls out automatically: an unscouted `to`
 * simply can't be reached, returning null. Also returns the accumulated
 * terrain cost of the winning route (engine/expeditions.ts scales resource/
 * time cost off this), which findHordePath's callers don't need and so don't
 * get.
 *
 * When `ownedTiles` is provided, non-owned allowed tiles get
 * `unownedPathPenalty` added during search so longer owned corridors beat
 * short scouted-unowned cuts; the returned `cost` is still pure terrain.
 */
export function findExpeditionPath(
  tweaks: Tweaks,
  seed: number,
  from: Axial,
  to: Axial,
  gridSize: number,
  allowedTiles: Set<string>,
  ownedTiles?: Set<string>,
  unownedPathPenalty = 0,
): PathResult | null {
  const edgeExtraCost =
    ownedTiles && unownedPathPenalty > 0
      ? (coord: Axial) => (ownedTiles.has(axialKey(coord)) ? 0 : unownedPathPenalty)
      : () => 0;
  return dijkstraCore(
    tweaks,
    seed,
    from,
    to,
    gridSize,
    (coord) => allowedTiles.has(axialKey(coord)),
    edgeExtraCost,
  );
}
