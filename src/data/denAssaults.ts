import type { Axial } from "../engine/hexCoords";

/**
 * A party dispatched to assault a den — deliberately a separate record from
 * Expedition (data/expeditions.ts), not an overload of it: on success this
 * mutates the target den's own state (starts its siege hold) rather than
 * claiming the target tile as owned territory, so keeping the two systems
 * apart avoids any risk of the working expedition system regressing.
 * Otherwise mirrors Expedition's shape and resolution lifecycle exactly —
 * committed units stay counted in UnitsRecord (upkeep keeps applying) until
 * resolution, tracked as unavailable via engine/garrisons.ts's
 * denAssault-aware availableMilitia/availableJunkyardKnights/
 * availableCrossBowSnipers. The corridor up to (but excluding) the den's own
 * coord resolves tile-by-tile in real time every tick, same as an
 * Expedition (engine/expeditions.ts:stepCorridorWalk) — a corridor loss
 * leaves a tombstone (data/tombstones.ts) at the death tile. Once
 * `resolvedIndex` reaches the corridor's end, the den-specific final fight
 * (engine/dens.ts) resolves immediately, not gated on `arriveAt` directly
 * (though the two normally coincide). Mid-march cancel recalls to `origin`
 * (ScrapperEconomy Q42–Q44); no mid-march redeploy to a different den.
 */
export interface DenAssaultRecord {
  id: string;
  denId: string;
  /** Dispatch hub (barracks / tower / outpost) — home for cancel/recall (Q43). */
  origin: Axial;
  target: Axial;
  path: Axial[];
  militiaCommitted: number;
  junkyardKnightCommitted: number;
  crossBowSniperCommitted: number;
  /** ms, against game.clock.virtualNow — not Date.now(), same as every other timer in this game. */
  departedAt: number;
  arriveAt: number;
  /** Index into `path` already resolved — 0 at dispatch. Outbound corridor is path[0..length-2]; path[length-1] is the den. Recalling walks the full home path. */
  resolvedIndex: number;
  /** `marching` outbound; `recalling` after mid-march cancel (Q42). */
  phase: "marching" | "recalling";
}

export type DenAssaultsRecord = DenAssaultRecord[];

export const DEN_ASSAULTS_DB_KEY = "denAssaults";

/** Backfill origin/phase for saves from before Q42–Q44. */
export function normalizeDenAssault(assault: DenAssaultRecord): DenAssaultRecord {
  return {
    ...assault,
    resolvedIndex: assault.resolvedIndex ?? 0,
    origin: assault.origin ?? assault.path[0] ?? assault.target,
    phase: assault.phase ?? "marching",
  };
}
