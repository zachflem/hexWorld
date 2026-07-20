import type { Axial } from "../engine/hexCoords";

/**
 * A garrison in transit home after being recalled (App.tsx:handleRecallMilitia)
 * — mirrors Expedition/DenAssaultRecord's shape (committed-unit counts plus
 * departedAt/arriveAt) but travels the opposite direction, at half the time
 * an outbound march to the same tile would take (engine/expeditions.ts:
 * recallDurationMs), from whatever coord the garrison was pulled off of.
 * There's no route/corridor to fight through on the way — recalled troops
 * are marching back through ground they already hold, so this is a pure
 * timer, not a fight (no committed-forces-lost-on-a-loss rule applies here).
 */
export interface GarrisonRecallRecord {
  id: string;
  coord: Axial;
  militiaCommitted: number;
  junkyardKnightCommitted: number;
  crossBowSniperCommitted: number;
  departedAt: number;
  arriveAt: number;
}

export type GarrisonRecallsRecord = GarrisonRecallRecord[];

export const GARRISON_RECALLS_DB_KEY = "garrisonRecalls";
