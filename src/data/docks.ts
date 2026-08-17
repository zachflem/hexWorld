import type { Axial } from "../engine/hexCoords";
import type { CourierTrip } from "./couriers";
import type { ResourceType } from "./resources";

export interface DockLevelUpgradeInProgress {
  targetLevel: number;
  startedAt: number;
}

/** @deprecated Legacy in-progress fishing-boat build — resolved as L3 upgrade on tick. */
export interface DockFishingBoatInProgress {
  startedAt: number;
}

/**
 * A water-based food building — placement (a water tile bordering land, see
 * engine/terrain.ts:isTransitionTile). Milestone 26: L1 manual → L2 courier →
 * L3 production. Immune to horde capture (hordes can't reach water tiles today).
 */
export interface DockRecord {
  coord: Axial;
  /** Set at build time, cleared once the construction timer elapses. */
  buildStartedAt: number | null;
  /** Local food buffer, capped at storage.capacity_base_per_resource. */
  stockpile: number;
  /**
   * M26 structure level (1 = manual, 2 = courier, 3 = production).
   * Absent on legacy saves → infer via `dockLevel()` (fishingBoat → 3, else 1).
   */
  level?: number;
  /** In-progress level upgrade (L1→L2 or L2→L3). */
  upgrade?: DockLevelUpgradeInProgress | null;
  /** Implied courier trip (Milestone 26). */
  courier?: CourierTrip | null;
  /**
   * True at L3+ (or legacy fishing-boat builds) — boat art + yield bonus.
   * Prefer `dockLevel(dock) >= 3` for gameplay; keep flag for sprites/saves.
   */
  fishingBoat: boolean;
  /** @deprecated Prefer `upgrade` with targetLevel 3. Cleared on tick resolve. */
  fishingBoatUpgrade: DockFishingBoatInProgress | null;
  /** Cumulative build spend — refunded proportionally on demolish. */
  totalInvested: Partial<Record<ResourceType, number>>;
  /** Cost paid for the original build only. */
  buildCost: Partial<Record<ResourceType, number>>;
}

export type DocksRecord = DockRecord[];

export const DOCKS_DB_KEY = "docks";
export const MAX_DOCK_LEVEL = 3;
