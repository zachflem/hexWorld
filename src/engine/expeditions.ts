import type { Barracks } from "../data/barracks";
import type { Expedition, ExpeditionsRecord } from "../data/expeditions";
import type { GarrisonsRecord } from "../data/garrisons";
import type { OutpostsRecord } from "../data/outposts";
import type { TerritoryRecord } from "../data/territory";
import type { Tower } from "../data/towers";
import type { Tweaks } from "../data/tweaksSchema";
import { garrisonAttackPower, mergeIntoGarrison } from "./garrisons";
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

/** Corridor rules — territory expeditions free-claim; den/lab assaults keep legacy tile fights. */
export interface CorridorWalkOptions {
  /** When true, unowned tiles are claimed without a tileDefense fight (territory expeditions). */
  freeClaimUnowned: boolean;
  /** When true, party fights hordes (win clears, lose wipes). When false, any horde wipes (legacy assaults). */
  engageHordes: boolean;
}

export const TERRITORY_CORRIDOR: CorridorWalkOptions = { freeClaimUnowned: true, engageHordes: true };
export const ASSAULT_CORRIDOR: CorridorWalkOptions = { freeClaimUnowned: false, engageHordes: false };

/**
 * Tries every active barracks or tower plus every outpost as a candidate
 * origin, and keeps whichever produces the cheapest route by accumulated
 * terrain cost — with owned-preferring path weights so longer owned
 * corridors beat short scouted-unowned cuts when possible.
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
  const ownedKeys = new Set(territory.owned.map(axialKey));
  const allowedTiles = new Set<string>([...territory.owned, ...scoutedTiles].map(axialKey));
  const candidateOrigins: Axial[] = [
    ...barracksList.filter(isStructureActive).map((b) => b.coord),
    ...towers.filter(isStructureActive).map((t) => t.coord),
    ...outposts.map((o) => o.coord),
  ];
  const penalty = tweaks.expeditions.unowned_path_penalty;

  let best: ExpeditionRoute | null = null;
  for (const origin of candidateOrigins) {
    const result = findExpeditionPath(
      tweaks,
      seed,
      origin,
      destination,
      gridSize,
      allowedTiles,
      ownedKeys,
      penalty,
    );
    if (!result) continue;
    if (!best || result.cost < best.cost) {
      best = { path: result.path, cost: result.cost, origin };
    }
  }
  return best;
}

/**
 * Route from an arbitrary current hex (redeploy / reinforce join target) through
 * owned ∪ scouted, with the same owned-preferring weights as dispatch.
 */
export function findExpeditionRouteFrom(
  tweaks: Tweaks,
  seed: number,
  from: Axial,
  destination: Axial,
  territory: TerritoryRecord,
  scoutedTiles: Axial[],
  gridSize: number,
): ExpeditionRoute | null {
  const ownedKeys = new Set(territory.owned.map(axialKey));
  const allowedTiles = new Set<string>([...territory.owned, ...scoutedTiles].map(axialKey));
  const result = findExpeditionPath(
    tweaks,
    seed,
    from,
    destination,
    gridSize,
    allowedTiles,
    ownedKeys,
    tweaks.expeditions.unowned_path_penalty,
  );
  if (!result) return null;
  return { path: result.path, cost: result.cost, origin: from };
}

/** Food to provision the party for the whole trip — scales with party size and route terrain cost. */
export function expeditionProvisionsCost(tweaks: Tweaks, partySize: number, pathCost: number): number {
  return partySize * pathCost * tweaks.expeditions.provisions_food_per_unit_per_cost;
}

/** Reinforce detachments pay a fraction of normal provisions (path already known/cleared). */
export function reinforceProvisionsCost(tweaks: Tweaks, partySize: number, pathCost: number): number {
  return expeditionProvisionsCost(tweaks, partySize, pathCost) * tweaks.expeditions.reinforce_cost_multiplier;
}

export function expeditionTravelDurationMs(tweaks: Tweaks, pathCost: number, speedMultiplier: number): number {
  return (pathCost * tweaks.expeditions.travel_seconds_per_cost * 1000) / speedMultiplier;
}

/** Reinforce travel time — same fraction as cost. */
export function reinforceTravelDurationMs(tweaks: Tweaks, pathCost: number, speedMultiplier: number): number {
  return expeditionTravelDurationMs(tweaks, pathCost, speedMultiplier) * tweaks.expeditions.reinforce_cost_multiplier;
}

/**
 * A recalled garrison's march home — half of expeditionTravelDurationMs's
 * outbound time for the same route cost.
 */
export function recallDurationMs(tweaks: Tweaks, pathCost: number, speedMultiplier: number): number {
  return expeditionTravelDurationMs(tweaks, pathCost, speedMultiplier) / 2;
}

/** Pro-rata food refund for mid-march cancel: paid × (tiles remaining / outbound total). */
export function provisionsRefund(paid: number, tilesResolved: number, outboundTileCount: number): number {
  if (outboundTileCount <= 0 || paid <= 0) return 0;
  const remaining = Math.max(0, outboundTileCount - tilesResolved);
  return paid * (remaining / outboundTileCount);
}

export function expeditionPathIndexAt(departedAt: number, arriveAt: number, now: number, pathLength: number): number {
  const totalMs = arriveAt - departedAt;
  const fraction = totalMs > 0 ? Math.min(1, Math.max(0, (now - departedAt) / totalMs)) : 1;
  return Math.round(fraction * (pathLength - 1));
}

/** Why a party died on a corridor tile — carried onto its tombstone. */
export type TombstoneCause =
  | { kind: "horde_blocked"; hordeSize: number }
  | { kind: "tile_defense"; attackPower: number; defense: number };

export interface CorridorStepResult {
  resolvedIndex: number;
  claimedTiles: Axial[];
  death: { tile: Axial; cause: TombstoneCause } | null;
  /** Horde tile keys cleared this step when engageHordes won the fight. */
  clearedHordeKeys: string[];
}

/**
 * Advances a party from `resolvedIndex` toward `targetIndex`.
 *
 * Territory mode (`TERRITORY_CORRIDOR`): horde fight-or-wipe; unowned tiles
 * free-claim. Assault mode (`ASSAULT_CORRIDOR`): any horde wipes; unowned
 * tiles still require beating tileDefense (legacy den/lab corridor).
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
  options: CorridorWalkOptions = ASSAULT_CORRIDOR,
): CorridorStepResult {
  const ownedKeys = new Set(owned.map(axialKey));
  const claimedTiles: Axial[] = [];
  const clearedHordeKeys: string[] = [];
  const remainingHordes = new Map(hordeSizeByKey);

  for (let i = resolvedIndex + 1; i <= targetIndex; i++) {
    const tile = path[i];
    const key = axialKey(tile);

    const hordeSize = remainingHordes.get(key);
    if (hordeSize !== undefined) {
      if (!options.engageHordes || !resolveHordeTileFight(attackPower, hordeSize)) {
        return {
          resolvedIndex: i - 1,
          claimedTiles,
          death: { tile, cause: { kind: "horde_blocked", hordeSize } },
          clearedHordeKeys,
        };
      }
      clearedHordeKeys.push(key);
      remainingHordes.delete(key);
    }

    if (ownedKeys.has(key)) continue;

    if (!options.freeClaimUnowned) {
      const defense = tileDefense(tweaks, axialDistance(tile, base));
      if (!resolveHordeTileFight(attackPower, defense)) {
        return {
          resolvedIndex: i - 1,
          claimedTiles,
          death: { tile, cause: { kind: "tile_defense", attackPower, defense } },
          clearedHordeKeys,
        };
      }
    }

    claimedTiles.push(tile);
    ownedKeys.add(key);
  }
  return { resolvedIndex: targetIndex, claimedTiles, death: null, clearedHordeKeys };
}

/** Strongest known path horde that outguns the party, if any — for pre-dispatch wipe-risk UI. */
export function pathHordeWipeRisk(
  path: Axial[],
  attackPower: number,
  hordeSizeByKey: Map<string, number>,
): { hordeSize: number; tile: Axial } | null {
  let worst: { hordeSize: number; tile: Axial } | null = null;
  for (const tile of path) {
    const hordeSize = hordeSizeByKey.get(axialKey(tile));
    if (hordeSize === undefined) continue;
    if (resolveHordeTileFight(attackPower, hordeSize)) continue;
    if (!worst || hordeSize > worst.hordeSize) worst = { hordeSize, tile };
  }
  return worst;
}

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

/** Current hex for an in-flight / waiting party (path clamp). */
export function expeditionCurrentTile(expedition: {
  path: Axial[];
  resolvedIndex: number;
  phase?: string;
  departedAt: number;
  arriveAt: number;
}, now: number): Axial {
  if (expedition.phase === "awaitingOrders") {
    return expedition.path[expedition.path.length - 1]!;
  }
  const index = expeditionPathIndexAt(
    expedition.departedAt,
    expedition.arriveAt,
    now,
    expedition.path.length,
  );
  return expedition.path[Math.min(index, expedition.path.length - 1)]!;
}

/** Marker index for canvas — awaiting parties sit on the destination hex. */
export function expeditionMarkerIndex(
  expedition: { path: Axial[]; phase?: string; departedAt: number; arriveAt: number },
  now: number,
): number {
  if (expedition.phase === "awaitingOrders") return expedition.path.length - 1;
  return expeditionPathIndexAt(expedition.departedAt, expedition.arriveAt, now, expedition.path.length);
}

export interface HomeRecallPlan {
  /** Null when the party is already at origin (or no route) and should dissolve into the standing army. */
  next: {
    path: Axial[];
    target: Axial;
    departedAt: number;
    arriveAt: number;
    resolvedIndex: number;
    phase: "recalling";
    provisionsPaid: number;
    outboundTileCount: number;
    decisionDeadlineAt: null;
    joinExpeditionId: null;
  } | null;
  foodRefund: number;
}

/**
 * Station an awaitingOrders party's committed units on their destination hex
 * and drop the expedition. Callers validate ownership / land / hostiles first.
 * No food refund — return provisions were prepaid at dispatch (same as arrival recall).
 */
export function stationExpeditionAsGarrison(
  expedition: Expedition,
  garrisons: GarrisonsRecord,
  expeditions: ExpeditionsRecord,
): { garrisons: GarrisonsRecord; expeditions: ExpeditionsRecord; coord: Axial } {
  const coord = expedition.path[expedition.path.length - 1] ?? expedition.target;
  return {
    coord,
    garrisons: mergeIntoGarrison(
      garrisons,
      coord,
      expedition.militiaCommitted,
      expedition.junkyardKnightCommitted,
      expedition.crossBowSniperCommitted,
    ),
    expeditions: expeditions.filter((e) => e.id !== expedition.id),
  };
}

/**
 * Plan a march home to `origin`. Mid-march cancel sets `applyRefund`; arrival
 * auto-return / recall after destination does not (return already prepaid).
 */
export function planHomeRecall(
  tweaks: Tweaks,
  seed: number,
  expedition: {
    origin: Axial;
    path: Axial[];
    resolvedIndex: number;
    provisionsPaid: number;
    outboundTileCount: number;
    phase?: string;
    departedAt: number;
    arriveAt: number;
  },
  territory: TerritoryRecord,
  scoutedTiles: Axial[],
  gridSize: number,
  speedMultiplier: number,
  now: number,
  applyRefund: boolean,
): HomeRecallPlan {
  const foodRefund = applyRefund
    ? provisionsRefund(expedition.provisionsPaid, expedition.resolvedIndex, expedition.outboundTileCount)
    : 0;
  const current = expeditionCurrentTile(expedition, now);
  if (axialKey(current) === axialKey(expedition.origin)) {
    return { next: null, foodRefund };
  }
  const route = findExpeditionRouteFrom(
    tweaks,
    seed,
    current,
    expedition.origin,
    territory,
    scoutedTiles,
    gridSize,
  );
  if (!route) {
    return { next: null, foodRefund };
  }
  return {
    next: {
      path: route.path,
      target: expedition.origin,
      departedAt: now,
      arriveAt: now + recallDurationMs(tweaks, route.cost, speedMultiplier),
      resolvedIndex: 0,
      phase: "recalling",
      provisionsPaid: 0,
      outboundTileCount: Math.max(0, route.path.length - 1),
      decisionDeadlineAt: null,
      joinExpeditionId: null,
    },
    foodRefund,
  };
}
