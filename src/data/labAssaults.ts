import type { Axial } from "../engine/hexCoords";

/**
 * A party dispatched to secure the hidden lab — mirrors DenAssaultRecord's
 * shape and resolution lifecycle exactly (committed units stay counted in
 * UnitsRecord until resolution, tracked as unavailable via
 * engine/garrisons.ts's assault-aware availability helpers, corridor resolves
 * tile-by-tile in real time via engine/expeditions.ts:stepCorridorWalk, a
 * corridor loss leaves a tombstone at the death tile), but resolves simpler:
 * there's only ever one lab and no siege/hold period, so a win just flips
 * LabRecord.secured and the party returns home intact (all-or-nothing, same
 * shape as a regular expedition — see engine/lab.ts:resolveLabAssault),
 * triggered once `resolvedIndex` reaches the corridor's end (path.length-2).
 * Mid-march cancel recalls to `origin` (ScrapperEconomy Q42–Q44); no redeploy.
 */
export interface LabAssaultRecord {
  id: string;
  /** Dispatch hub — home for cancel/recall (Q43). */
  origin: Axial;
  target: Axial;
  path: Axial[];
  militiaCommitted: number;
  junkyardKnightCommitted: number;
  crossBowSniperCommitted: number;
  /** ms, against game.clock.virtualNow — not Date.now(), same as every other timer in this game. */
  departedAt: number;
  arriveAt: number;
  /** Index into `path` already resolved — 0 at dispatch. Outbound corridor is path[0..length-2]; path[length-1] is the lab. Recalling walks the full home path. */
  resolvedIndex: number;
  /** `marching` outbound; `recalling` after mid-march cancel (Q42). */
  phase: "marching" | "recalling";
}

export type LabAssaultsRecord = LabAssaultRecord[];

export const LAB_ASSAULTS_DB_KEY = "labAssaults";

/** Backfill origin/phase for saves from before Q42–Q44. */
export function normalizeLabAssault(assault: LabAssaultRecord): LabAssaultRecord {
  return {
    ...assault,
    resolvedIndex: assault.resolvedIndex ?? 0,
    origin: assault.origin ?? assault.path[0] ?? assault.target,
    phase: assault.phase ?? "marching",
  };
}
