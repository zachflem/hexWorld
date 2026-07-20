import type { Axial } from "../engine/hexCoords";
import type { ResourceType } from "./resources";

export interface Tower {
  coord: Axial;
  level: number;
  /** Cumulative build + upgrade spend, resource by resource — refunded proportionally on demolish. */
  totalInvested: Partial<Record<ResourceType, number>>;
  /** Set when a level upgrade has been paid for but hasn't completed yet — level only changes once the timer elapses. */
  upgrade: TowerUpgradeInProgress | null;
  /** Cost paid for the original build only (never touched by upgrades) — the basis for repairCost() after horde capture. */
  buildCost: Partial<Record<ResourceType, number>>;
  /** True once a horde captures this tile (engine/hordes.ts) — non-interactive (including as horde defense) until the tile is reclaimed and repaired, DESIGN.md §12. */
  damaged: boolean;
}

export interface TowerUpgradeInProgress {
  targetLevel: number;
  startedAt: number;
}

export const TOWERS_DB_KEY = "towers";
export const MAX_TOWER_LEVEL = 4;
