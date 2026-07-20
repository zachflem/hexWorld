import type { Barracks } from "../data/barracks";
import type { TerritoryRecord } from "../data/territory";
import type { Tweaks } from "../data/tweaksSchema";
import { garrisonAttackPower } from "./garrisons";
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
 * Tries every non-damaged barracks as a candidate origin (none of the
 * capacity helpers in engine/barracks.ts filter damaged barracks, so this
 * does it explicitly) and keeps whichever produces the cheapest route by
 * accumulated terrain cost — not just the geometrically nearest barracks,
 * since a farther one might have an easier path. Returns null if no
 * non-damaged barracks has any route to `destination` through owned-or-
 * scouted ground (including if there are no barracks at all).
 */
export function findBestExpeditionRoute(
  tweaks: Tweaks,
  seed: number,
  barracksList: Barracks[],
  territory: TerritoryRecord,
  scoutedTiles: Axial[],
  gridSize: number,
  destination: Axial,
): ExpeditionRoute | null {
  const allowedTiles = new Set<string>([...territory.owned, ...scoutedTiles].map(axialKey));

  let best: ExpeditionRoute | null = null;
  for (const barracks of barracksList) {
    if (barracks.damaged) continue;
    const result = findExpeditionPath(tweaks, seed, barracks.coord, destination, gridSize, allowedTiles);
    if (!result) continue;
    if (!best || result.cost < best.cost) {
      best = { path: result.path, cost: result.cost, origin: barracks.coord };
    }
  }
  return best;
}

/** Food to provision the party for the whole trip — scales with both party size and how difficult the route is (engine/pathfinding.ts's terrain cost), not just distance in tiles. */
export function expeditionProvisionsCost(tweaks: Tweaks, partySize: number, pathCost: number): number {
  return partySize * pathCost * tweaks.expeditions.provisions_food_per_unit_per_cost;
}

/** Travel duration scales with route difficulty alone (party size doesn't slow the whole group down further in this first pass). */
export function expeditionTravelDurationMs(tweaks: Tweaks, pathCost: number): number {
  return pathCost * tweaks.expeditions.travel_seconds_per_cost * 1000;
}

/**
 * A recalled garrison's march home — half of expeditionTravelDurationMs's
 * outbound time for the same route cost. Troops retreating through ground
 * they already hold don't need to fight their way back, so they're faster
 * than an outbound party pushing through unclaimed/hostile tiles, but it's
 * still a real march, not a teleport (App.tsx:handleRecallMilitia).
 */
export function recallDurationMs(tweaks: Tweaks, pathCost: number): number {
  return expeditionTravelDurationMs(tweaks, pathCost) / 2;
}

/**
 * Walks `path` in order (origin barracks tile first, destination last),
 * skipping any tile already in `owned` (free passage — it's already yours).
 * Every unowned tile is fought with the SAME resolveHordeTileFight/
 * tileDefense formula a horde uses to advance toward the base — same
 * deterministic, no-partial-damage shape (DESIGN.md §10), just checked from
 * the opposite direction. No attrition on a successful check: the party
 * fights every unowned tile at full committed strength, so the real
 * constraint is whether it can beat the single hardest (usually farthest)
 * tile along the corridor, not accumulated wear. A win claims every unowned
 * tile on the path and the party returns home intact (no unit-count change —
 * see engine/expeditions.ts's caller in App.tsx). A loss claims everything
 * beaten before the failure point and wipes the whole committed party.
 */
export function resolveExpeditionWalk(
  tweaks: Tweaks,
  path: Axial[],
  owned: Axial[],
  base: Axial,
  attackPower: number,
): { claimedTiles: Axial[]; survived: boolean } {
  const ownedKeys = new Set(owned.map(axialKey));
  const claimedTiles: Axial[] = [];

  for (const tile of path) {
    if (ownedKeys.has(axialKey(tile))) continue;
    const defense = tileDefense(tweaks, axialDistance(tile, base));
    if (!resolveHordeTileFight(attackPower, defense)) {
      return { claimedTiles, survived: false };
    }
    claimedTiles.push(tile);
  }
  return { claimedTiles, survived: true };
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
