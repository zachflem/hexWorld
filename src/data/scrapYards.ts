import type { Axial } from "../engine/hexCoords";
import type { CourierTrip } from "./couriers";
import type { ResourceType } from "./resources";

export interface ScrapYardUpgradeInProgress {
  targetLevel: number;
  startedAt: number;
}

/** Visible Scrapper haul between yard and an assigned scrap stash (Q33–Q35). */
export type ScrapperPhase = "idle" | "toStash" | "toYard";

export interface ScrapperTrip {
  assignedStashId: string | null;
  phase: ScrapperPhase;
  path: Axial[];
  departedAt: number;
  arriveAt: number;
  /** Index into `path` already walked — used for loaded-return free-claim (Q28). */
  resolvedIndex: number;
  cargo: number;
}

/**
 * Land structure that receives Scrapper hauls into a local steel stockpile,
 * then last-mile delivers to base via implied courier (Q69) and/or collect pin.
 * Unified yard/Scrapper level track (Q58) — L1–L3 ship in M26; L4/L5 later.
 */
export interface ScrapYardRecord {
  coord: Axial;
  buildStartedAt: number | null;
  stockpile: number;
  level: number;
  upgrade: ScrapYardUpgradeInProgress | null;
  courier: CourierTrip | null;
  totalInvested: Partial<Record<ResourceType, number>>;
  buildCost: Partial<Record<ResourceType, number>>;
  damaged: boolean;
  damageRepair: { startedAt: number } | null;
  /** True once the yard build timer completes (Q63 — L1 Scrapper included). */
  scrapperReady: boolean;
  /** Null until scrapperReady; then idle or in-flight haul. */
  scrapper: ScrapperTrip | null;
}

export type ScrapYardsRecord = ScrapYardRecord[];

export const SCRAP_YARDS_DB_KEY = "scrapYards";

/** Design max (Q58). */
export const MAX_SCRAP_YARD_LEVEL = 5;
/** Shipped upgrade cap until L4/L5 costs land. */
export const MAX_SCRAP_YARD_LEVEL_SHIPPED = 3;

export function idleScrapperTrip(): ScrapperTrip {
  return {
    assignedStashId: null,
    phase: "idle",
    path: [],
    departedAt: 0,
    arriveAt: 0,
    resolvedIndex: 0,
    cargo: 0,
  };
}
