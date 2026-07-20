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
 * availableCrossBowSnipers. Resolved from the tick loop once
 * `virtualNow >= arriveAt` (App.tsx), same as an Expedition.
 */
export interface DenAssaultRecord {
  id: string;
  denId: string;
  target: Axial;
  path: Axial[];
  militiaCommitted: number;
  junkyardKnightCommitted: number;
  crossBowSniperCommitted: number;
  /** ms, against game.clock.virtualNow — not Date.now(), same as every other timer in this game. */
  departedAt: number;
  arriveAt: number;
}

export type DenAssaultsRecord = DenAssaultRecord[];

export const DEN_ASSAULTS_DB_KEY = "denAssaults";
