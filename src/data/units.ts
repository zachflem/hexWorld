/** A trickle-delivery training batch — units complete one at a time, not all together. */
export interface TrainingQueue {
  /** How many units are still left to deliver, including the one currently training. */
  remaining: number;
  /** When the currently-training unit's timer started. */
  currentUnitStartedAt: number;
}

export interface UnitsRecord {
  scoutStockpile: number;
  militiaCount: number;
  /** Barracks L2 unlock (units.junkyard_knight, tweaks.jsonc) — a tougher, harder-hitting melee unit, same standing-army/garrison model as militia. */
  junkyardKnightCount: number;
  /** Barracks L3 unlock (units.cross_bow_sniper, tweaks.jsonc) — the first ranged unit; garrisoned snipers add per-tick ranged damage within range_tiles (engine/hordes.ts). */
  crossBowSniperCount: number;
  scoutQueue: TrainingQueue | null;
  militiaQueue: TrainingQueue | null;
  junkyardKnightQueue: TrainingQueue | null;
  crossBowSniperQueue: TrainingQueue | null;
}

export const UNITS_DB_KEY = "units";

export function initialUnits(): UnitsRecord {
  return {
    scoutStockpile: 0,
    militiaCount: 0,
    junkyardKnightCount: 0,
    crossBowSniperCount: 0,
    scoutQueue: null,
    militiaQueue: null,
    junkyardKnightQueue: null,
    crossBowSniperQueue: null,
  };
}
