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
function dijkstraCore(
  tweaks: Tweaks,
  seed: number,
  from: Axial,
  to: Axial,
  gridSize: number,
  isAllowed: (coord: Axial) => boolean,
): PathResult | null {
  const startKey = axialKey(from);
  const goalKey = axialKey(to);

  const dist = new Map<string, number>([[startKey, 0]]);
  const prev = new Map<string, Axial>();
  const visited = new Set<string>();
  const frontier: Axial[] = [from];

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

    if (currentKey === goalKey) break;

    for (const neighbor of axialNeighbors(current)) {
      if (!isWithinMapBounds(neighbor, gridSize)) continue;
      const neighborKey = axialKey(neighbor);
      if (visited.has(neighborKey)) continue;
      if (!isAllowed(neighbor)) continue;

      const cost = terrainCost(tweaks, terrainAt(seed, neighbor));
      if (cost === null) continue;

      const candidateDist = bestDist + cost;
      if (candidateDist < (dist.get(neighborKey) ?? Infinity)) {
        dist.set(neighborKey, candidateDist);
        prev.set(neighborKey, current);
        frontier.push(neighbor);
      }
    }
  }

  const goalDist = dist.get(goalKey);
  if (goalDist === undefined) return null;

  const path: Axial[] = [to];
  let cursor = to;
  while (axialKey(cursor) !== startKey) {
    const previous = prev.get(axialKey(cursor));
    if (!previous) return null; // unreachable in practice — dist.has(goalKey) already guards this
    path.push(previous);
    cursor = previous;
  }
  return { path: path.reverse(), cost: goalDist };
}

/** Unrestricted by ownership — see dijkstraCore's doc comment. Unchanged behavior/signature from before the dijkstraCore extraction. */
export function findHordePath(tweaks: Tweaks, seed: number, from: Axial, to: Axial, gridSize: number): Axial[] | null {
  return dijkstraCore(tweaks, seed, from, to, gridSize, () => true)?.path ?? null;
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
 */
export function findExpeditionPath(
  tweaks: Tweaks,
  seed: number,
  from: Axial,
  to: Axial,
  gridSize: number,
  allowedTiles: Set<string>,
): PathResult | null {
  return dijkstraCore(tweaks, seed, from, to, gridSize, (coord) => allowedTiles.has(axialKey(coord)));
}
