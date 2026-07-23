export interface UnitsRecord {
  scoutStockpile: number;
  militiaCount: number;
  /** Barracks L2 unlock (units.junkyard_knight, tweaks.jsonc) — a tougher, harder-hitting melee unit, same standing-army/garrison model as militia. */
  junkyardKnightCount: number;
  /** Barracks L3 unlock (units.cross_bow_sniper, tweaks.jsonc) — the first ranged unit; garrisoned snipers add per-tick ranged damage within range_tiles (engine/hordes.ts). */
  crossBowSniperCount: number;
}

export const UNITS_DB_KEY = "units";

export function initialUnits(): UnitsRecord {
  return {
    scoutStockpile: 0,
    militiaCount: 0,
    junkyardKnightCount: 0,
    crossBowSniperCount: 0,
  };
}

/** @deprecated Pre-#5 save shape — migrated onto Barracks.trainingQueue at load. */
export interface LegacyTrainingQueue {
  remaining: number;
  currentUnitStartedAt: number;
}

/** @deprecated Pre-#5 save shape — stripped in hydrateGameState. */
export interface LegacyUnitsRecord extends UnitsRecord {
  scoutQueue?: LegacyTrainingQueue | null;
  militiaQueue?: LegacyTrainingQueue | null;
  junkyardKnightQueue?: LegacyTrainingQueue | null;
  crossBowSniperQueue?: LegacyTrainingQueue | null;
}
