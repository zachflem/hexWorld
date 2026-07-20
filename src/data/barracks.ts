import type { Axial } from "../engine/hexCoords";
import type { ResourceType } from "./resources";

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
}

export interface BarracksUpgradeInProgress {
  targetLevel: number;
  startedAt: number;
}

export const BARRACKS_DB_KEY = "barracks";
export const MAX_BARRACKS_LEVEL = 4;
