import type { Axial } from "../engine/hexCoords";

/**
 * Lifecycle of a territory expedition (den/lab assaults use their own records).
 * - marching — outbound (or post-redeploy) corridor walk
 * - awaitingOrders — reached destination; player may redeploy / reinforce / recall
 * - recalling — marching home to origin
 * - reinforcing — inbound detachment joining an awaitingOrders expedition
 */
export type ExpeditionPhase = "marching" | "awaitingOrders" | "recalling" | "reinforcing";

/**
 * A party dispatched to claim tiles along `path` (from the origin
 * barracks/tower/outpost that offered the cheapest owned-preferring route,
 * through the destination inclusive). Committed units stay counted in
 * UnitsRecord the whole time (upkeep keeps applying) — an Expedition only
 * marks them unavailable until it resolves.
 *
 * Corridor resolution (engine/expeditions.ts:stepCorridorWalk) advances
 * `resolvedIndex` tile-by-tile: owned/scouted ground is free passage with
 * auto-claim on unowned scouted tiles; hordes are fought (win = clear, no
 * losses; lose = wipe + tombstone). On arrival the party waits for orders
 * (redeploy / reinforce / recall) instead of instantly dissolving.
 */
export interface Expedition {
  id: string;
  target: Axial;
  /** Dispatch origin (barracks/tower/outpost) — recall marches back here. */
  origin: Axial;
  path: Axial[];
  militiaCommitted: number;
  junkyardKnightCommitted: number;
  crossBowSniperCommitted: number;
  /** ms, against game.clock.virtualNow — not Date.now(), same as every other timer in this game. */
  departedAt: number;
  arriveAt: number;
  /** Index into `path` already resolved — 0 at dispatch. Never regresses on a given leg. */
  resolvedIndex: number;
  phase: ExpeditionPhase;
  /** Food paid for the current outbound (or reinforce) leg — used for pro-rata refunds. */
  provisionsPaid: number;
  /** Outbound hop count at dispatch of this leg (`path.length - 1`) — refund denominator. */
  outboundTileCount: number;
  /** When `awaitingOrders`, auto-recall if the player has not chosen by this virtual time. */
  decisionDeadlineAt: number | null;
  /** When `reinforcing`, the awaitingOrders expedition this detachment merges into. */
  joinExpeditionId: string | null;
}

export type ExpeditionsRecord = Expedition[];

export const EXPEDITIONS_DB_KEY = "expeditions";
