import type { Axial } from "../engine/hexCoords";
import type { ResourceType } from "./resources";

export type TrainingUnitType = "scout" | "militia" | "junkyard_knight" | "cross_bow_sniper";

/** One trickle-delivery batch at a single barracks — any unit type, one queue per barracks. */
export interface BarracksTrainingQueue {
  unitType: TrainingUnitType;
  /** How many units are still left to deliver, including the one currently training. */
  remaining: number;
  /** When the currently-training unit's timer started. */
  currentUnitStartedAt: number;
}

export interface Barracks {
  coord: Axial;
  level: number;
  totalInvested: Partial<Record<ResourceType, number>>;
  /** Set when a level upgrade has been paid for but hasn't completed yet — level only changes once the timer elapses. */
  upgrade: BarracksUpgradeInProgress | null;
  /** Cost paid for the original build only (never touched by upgrades) — the basis for repairCost() after horde capture. */
  buildCost: Partial<Record<ResourceType, number>>;
  /** True once a horde captures this tile (engine/hordes.ts) — non-interactive until the tile is reclaimed and repaired, DESIGN.md §12. */
  damaged: boolean;
  /** Set once a damage repair has been paid for but hasn't completed yet — `damaged` stays true until the timer elapses. Optional (not just nullable) so pre-existing object literals across the codebase don't all need updating; absent is treated the same as null. */
  damageRepair?: { startedAt: number } | null;
  /** Set at build time, cleared once the construction timer elapses — non-functional (engine/formulas.ts:isStructureActive) until then. Optional, same reasoning as damageRepair. */
  buildStartedAt?: number | null;
  /** At most one training batch at a time — any unit type. Optional; absent means idle. Pauses while damaged or under construction (engine/barracks.ts:advanceBarracksTraining). */
  trainingQueue?: BarracksTrainingQueue | null;
}

export interface BarracksUpgradeInProgress {
  targetLevel: number;
  startedAt: number;
}

export const BARRACKS_DB_KEY = "barracks";
export const MAX_BARRACKS_LEVEL = 4;
