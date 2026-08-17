import type { Axial } from "../engine/hexCoords";
import type { ResourceType } from "./resources";

export interface PowerStation {
  coord: Axial;
  level: number;
  /** Cumulative build + upgrade spend — refunded proportionally on demolish. */
  totalInvested: Partial<Record<ResourceType, number>>;
  /** Set when a level upgrade has been paid for but hasn't completed yet. */
  upgrade: PowerStationUpgradeInProgress | null;
  /** Cost paid for the original build only — basis for repairCost after horde capture. */
  buildCost: Partial<Record<ResourceType, number>>;
  /** True once a horde captures this tile — non-functional until reclaimed and repaired. */
  damaged: boolean;
  damageRepair?: { startedAt: number } | null;
  /** Set at build time, cleared once the construction timer elapses. */
  buildStartedAt?: number | null;
}

export interface PowerStationUpgradeInProgress {
  targetLevel: number;
  startedAt: number;
}

export const POWER_STATIONS_DB_KEY = "powerStations";
export const MAX_POWER_STATION_LEVEL = 4;
