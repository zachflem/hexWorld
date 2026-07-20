import type { Axial } from "../engine/hexCoords";

/**
 * Units stationed on a tile — a mobile, repositionable defense that stacks
 * additively with any tower/wall already there (engine/hordes.ts:hordeTileDefense)
 * and can proactively attack a horde on its own tile or an adjacent one
 * (engine/hordes.ts:resolveHordeAttack). Unlike towers/walls/etc, a garrison
 * is not a "structure" — it never occupies a build slot and never blocks
 * building something else on the same tile. junkyardKnightCount/crossBowSniperCount
 * (barracks L2/L3 unlocks) stack alongside militiaCount, same attack/defense
 * shape — a cross-bow sniper garrison additionally deals ranged per-tick
 * damage within range_tiles (engine/hordes.ts), on top of this.
 */
export interface Garrison {
  coord: Axial;
  militiaCount: number;
  junkyardKnightCount: number;
  crossBowSniperCount: number;
}

export type GarrisonsRecord = Garrison[];

export const GARRISONS_DB_KEY = "garrisons";
