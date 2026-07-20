import type { Axial } from "../engine/hexCoords";

/**
 * A party dispatched to fight its way to `target`, following `path` (from
 * the origin barracks that offered the cheapest route, through the
 * destination inclusive). Committed units stay counted in UnitsRecord the
 * whole time (upkeep keeps applying, matching a "provisions" framing) — an
 * Expedition only marks them unavailable (engine/garrisons.ts's
 * expedition-aware availableMilitia/availableJunkyardKnights/
 * availableCrossBowSnipers) until it resolves. Resolution
 * (engine/expeditions.ts:resolveExpeditionWalk, run from the tick loop once
 * `virtualNow >= arriveAt`) either claims every unowned tile up to and
 * including the target (party returns home, no count change) or claims
 * everything up to the first tile it can't beat and wipes the whole party
 * (units debited on failure) — see engine/expeditions.ts for the resolution
 * shape.
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
}

export type ExpeditionsRecord = Expedition[];

export const EXPEDITIONS_DB_KEY = "expeditions";
