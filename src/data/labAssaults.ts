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
 */
export interface LabAssaultRecord {
  id: string;
  target: Axial;
  path: Axial[];
  militiaCommitted: number;
  junkyardKnightCommitted: number;
  crossBowSniperCommitted: number;
  /** ms, against game.clock.virtualNow — not Date.now(), same as every other timer in this game. */
  departedAt: number;
  arriveAt: number;
  /** Index into `path` already resolved — 0 at dispatch. Corridor is path[0..length-2]; path[length-1] is the lab's own coord, fought separately (engine/lab.ts) once this reaches length-2. */
  resolvedIndex: number;
}

export type LabAssaultsRecord = LabAssaultRecord[];

export const LAB_ASSAULTS_DB_KEY = "labAssaults";
