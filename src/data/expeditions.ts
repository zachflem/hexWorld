import type { Axial } from "../engine/hexCoords";

/**
 * A party dispatched to fight its way to `target`, following `path` (from
 * the origin barracks/tower/outpost that offered the cheapest route, through
 * the destination inclusive). Committed units stay counted in UnitsRecord the
 * whole time (upkeep keeps applying, matching a "provisions" framing) — an
 * Expedition only marks them unavailable (engine/garrisons.ts's
 * expedition-aware availableMilitia/availableJunkyardKnights/
 * availableCrossBowSnipers) until it resolves. Resolution
 * (engine/expeditions.ts:stepCorridorWalk, run from the tick loop EVERY tick,
 * not just once at `arriveAt`) advances `resolvedIndex` tile-by-tile in real
 * time as the party's visual position (same departedAt/arriveAt/path
 * schedule HexCanvas interpolates for the marker) reaches each tile: an
 * owned tile is free passage, an unowned one is fought immediately, claiming
 * it into territory.owned the instant it's won. A loss anywhere along the
 * way wipes the whole committed party (units debited) and leaves a tombstone
 * (data/tombstones.ts) at the death tile — everything claimed before that
 * point stays owned. Reaching the end of `path` with no loss completes the
 * expedition (party returns home, no count change, record dropped).
 */
export interface Expedition {
  id: string;
  target: Axial;
  path: Axial[];
  militiaCommitted: number;
  junkyardKnightCommitted: number;
  crossBowSniperCommitted: number;
  /** ms, against game.clock.virtualNow — not Date.now(), same as every other timer in this game. */
  departedAt: number;
  arriveAt: number;
  /** Index into `path` already resolved (fought-and-won, or free-passage because owned) — 0 at dispatch. engine/expeditions.ts:stepCorridorWalk advances this in real time; never regresses. */
  resolvedIndex: number;
}

export type ExpeditionsRecord = Expedition[];

export const EXPEDITIONS_DB_KEY = "expeditions";
