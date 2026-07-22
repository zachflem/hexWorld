import type { Barracks } from "../data/barracks";
import type { OutpostsRecord } from "../data/outposts";
import type { TerritoryRecord } from "../data/territory";
import type { Tower } from "../data/towers";
import type { Tweaks } from "../data/tweaksSchema";
import { garrisonAttackPower } from "./garrisons";
import { isStructureActive } from "./formulas";
import { axialDistance, axialKey, type Axial } from "./hexCoords";
import { findExpeditionPath } from "./pathfinding";
import { resolveHordeTileFight } from "./hordes";
import { tileDefense } from "./territory";

export interface ExpeditionRoute {
  path: Axial[];
  /** Accumulated terrain cost of the route (engine/pathfinding.ts) — drives provisions/travel-time cost, not raw tile count. */
  cost: number;
  origin: Axial;
}

/**
 * Tries every active barracks or tower (engine/formulas.ts:isStructureActive
 * — none of the capacity helpers in engine/barracks.ts filter damaged/
 * under-construction barracks, so this does it explicitly) plus every
 * outpost (OutpostRecord has no damaged/under-construction concept — any
 * outpost present in the array is usable) as a candidate origin, and keeps
 * whichever produces the cheapest route by accumulated terrain cost — not
 * just the geometrically nearest structure, since a farther one might have
 * an easier path. That "cheapest accounting for terrain" standard is exactly
 * what "closest" should mean here, so widening the candidate pool to towers
 * and outposts reuses the same metric rather than introducing a second one.
 * Returns null if no candidate structure has any route to `destination`
 * through owned-or-scouted ground (including if there are no candidate
 * structures at all).
 */
export function findBestExpeditionRoute(
  tweaks: Tweaks,
  seed: number,
  barracksList: Barracks[],
  towers: Tower[],
  outposts: OutpostsRecord,
  territory: TerritoryRecord,
  scoutedTiles: Axial[],
  gridSize: number,
  destination: Axial,
): ExpeditionRoute | null {
  const allowedTiles = new Set<string>([...territory.owned, ...scoutedTiles].map(axialKey));
  const candidateOrigins: Axial[] = [
    ...barracksList.filter(isStructureActive).map((b) => b.coord),
    ...towers.filter(isStructureActive).map((t) => t.coord),
    ...outposts.map((o) => o.coord),
  ];

  let best: ExpeditionRoute | null = null;
  for (const origin of candidateOrigins) {
    const result = findExpeditionPath(tweaks, seed, origin, destination, gridSize, allowedTiles);
    if (!result) continue;
    if (!best || result.cost < best.cost) {
      best = { path: result.path, cost: result.cost, origin };
    }
  }
  return best;
}

/** Food to provision the party for the whole trip — scales with both party size and how difficult the route is (engine/pathfinding.ts's terrain cost), not just distance in tiles. */
export function expeditionProvisionsCost(tweaks: Tweaks, partySize: number, pathCost: number): number {
  return partySize * pathCost * tweaks.expeditions.provisions_food_per_unit_per_cost;
}

/**
 * Travel duration scales with route difficulty alone (party size doesn't
 * slow the whole group down further in this first pass). `speedMultiplier`
 * is the troop-movement research bonus (engine/research.ts:
 * troopSpeedMultiplier — 1.0 by default, up to 2.0x fully researched);
 * callers pass 1 to opt out.
 */
export function expeditionTravelDurationMs(tweaks: Tweaks, pathCost: number, speedMultiplier: number): number {
  return (pathCost * tweaks.expeditions.travel_seconds_per_cost * 1000) / speedMultiplier;
}

/**
 * A recalled garrison's march home — half of expeditionTravelDurationMs's
 * outbound time for the same route cost. Troops retreating through ground
 * they already hold don't need to fight their way back, so they're faster
 * than an outbound party pushing through unclaimed/hostile tiles, but it's
 * still a real march, not a teleport (App.tsx:handleRecallMilitia).
 */
export function recallDurationMs(tweaks: Tweaks, pathCost: number, speedMultiplier: number): number {
  return expeditionTravelDurationMs(tweaks, pathCost, speedMultiplier) / 2;
}

/**
 * Deterministic path index for time `now` given a fixed
 * departedAt/arriveAt/path.length schedule — the ONE formula both the tick
 * loop's incremental corridor resolution (App.tsx's runTick) and
 * HexCanvas's visual marker interpolation use, so a party's logical
 * progress and its on-screen position can never diverge. A schedule with
 * `arriveAt <= departedAt` (shouldn't happen, but matches the old
 * HexCanvas-only formula's guard) is treated as already fully arrived.
 */
export function expeditionPathIndexAt(departedAt: number, arriveAt: number, now: number, pathLength: number): number {
  const totalMs = arriveAt - departedAt;
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, (now - departedAt) / totalMs)) : 1;
  return Math.round(fraction * (pathLength - 1));
}

/** Why a party died on a corridor tile — carried onto its tombstone (data/tombstones.ts) so a click-to-inspect can explain it. */
export type TombstoneCause =
  | { kind: "horde_blocked"; hordeSize: number }
  | { kind: "tile_defense"; attackPower: number; defense: number };

export interface CorridorStepResult {
  /** Furthest index now resolved — equal to the input `resolvedIndex` if `targetIndex` granted no new progress this step. */
  resolvedIndex: number;
  /** Tiles fought-and-won this step (already-owned tiles aren't included — there's nothing to merge for those). */
  claimedTiles: Axial[];
  /** Non-null only if the party died stepping onto a specific tile this step. */
  death: { tile: Axial; cause: TombstoneCause } | null;
}

/**
 * Advances a party from `resolvedIndex` toward `targetIndex` (the caller
 * caps this at path.length-1 for a plain expedition, or at path.length-2 for
 * a den/lab assault's corridor — see App.tsx), one tile at a time, in path
 * order. This is the real-time generalization of the old whole-path,
 * resolve-once-at-arrival walk: called every tick for every in-flight party
 * (not just the ones due to arrive), so territory claims and deaths happen
 * the instant the party's visual position (expeditionPathIndexAt above)
 * reaches each tile, not all at once at the end of the trip.
 *
 * Per tile, in priority order: horde-occupied -> death (this folds what used
 * to be a separate whole-path "the road was overrun" pre-check into the same
 * per-tile loop, so a horde far ahead of the party's real position doesn't
 * prematurely wipe it, and a horde-block death gets a concrete tile for its
 * tombstone); already `owned` -> free passage, no fight; otherwise -> fight
 * the SAME resolveHordeTileFight/tileDefense formula a horde uses to advance
 * toward the base, just checked from the opposite direction (DESIGN.md §10),
 * no attrition on a win. A win claims the tile; a loss stops the walk right
 * there and reports the death tile + cause for a tombstone. Resuming from a
 * non-zero `resolvedIndex` never re-fights an already-resolved tile.
 */
export function stepCorridorWalk(
  tweaks: Tweaks,
  path: Axial[],
  resolvedIndex: number,
  targetIndex: number,
  owned: Axial[],
  base: Axial,
  attackPower: number,
  hordeSizeByKey: Map<string, number>,
): CorridorStepResult {
  const ownedKeys = new Set(owned.map(axialKey));
  const claimedTiles: Axial[] = [];

  for (let i = resolvedIndex + 1; i <= targetIndex; i++) {
    const tile = path[i];
    const key = axialKey(tile);

    const hordeSize = hordeSizeByKey.get(key);
    if (hordeSize !== undefined) {
      return { resolvedIndex: i - 1, claimedTiles, death: { tile, cause: { kind: "horde_blocked", hordeSize } } };
    }

    if (ownedKeys.has(key)) continue;

    const defense = tileDefense(tweaks, axialDistance(tile, base));
    if (!resolveHordeTileFight(attackPower, defense)) {
      return { resolvedIndex: i - 1, claimedTiles, death: { tile, cause: { kind: "tile_defense", attackPower, defense } } };
    }
    claimedTiles.push(tile);
  }
  return { resolvedIndex: targetIndex, claimedTiles, death: null };
}

/** Total combined attack power of a party's committed units — reuses garrisonAttackPower (engine/garrisons.ts), which never actually reads `coord`, rather than a second near-duplicate formula. */
export function partyAttackPower(
  tweaks: Tweaks,
  militiaCommitted: number,
  junkyardKnightCommitted: number,
  crossBowSniperCommitted: number,
): number {
  return garrisonAttackPower(tweaks, {
    coord: { q: 0, r: 0 },
    militiaCount: militiaCommitted,
    junkyardKnightCount: junkyardKnightCommitted,
    crossBowSniperCount: crossBowSniperCommitted,
  });
}
