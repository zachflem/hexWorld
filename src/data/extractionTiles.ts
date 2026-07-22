import type { Axial } from "../engine/hexCoords";
import type { ResourceType } from "./resources";

/** Tier is "small" at build time — Milestone 5 added mid/large upgrades in place. */
export type ExtractionTier = "small" | "mid" | "large";

export interface ExtractionTile {
  coord: Axial;
  resource: ResourceType;
  tier: ExtractionTier;
  /**
   * Resources accumulated locally at this tile, not yet moved to base storage
   * (DESIGN.md §8) — capped at storage.capacity_base_per_resource. Drains to
   * base automatically if path-connected (engine/paths.ts), otherwise only via
   * manual collection.
   */
  stockpile: number;
  /** Cumulative build + upgrade spend, resource by resource — refunded proportionally on demolish. */
  totalInvested: Partial<Record<ResourceType, number>>;
  /** Set when a tier upgrade has been paid for but hasn't completed yet — tier only changes once the timer elapses. */
  upgrade: ExtractionTileUpgradeInProgress | null;
  /** Cost paid for the original build only (never touched by upgrades) — the basis for repairCost() after horde capture. */
  buildCost: Partial<Record<ResourceType, number>>;
  /** True once a horde captures this tile (engine/hordes.ts) — non-interactive until the tile is reclaimed and repaired, DESIGN.md §12. */
  damaged: boolean;
  /** Set once a damage repair has been paid for but hasn't completed yet — `damaged` stays true until the timer elapses. Optional (not just nullable) so pre-existing object literals across the codebase don't all need updating; absent is treated the same as null. */
  damageRepair?: { startedAt: number } | null;
  /** Set at build time, cleared once the construction timer elapses — non-functional (engine/formulas.ts:isStructureActive) until then. Optional, same reasoning as damageRepair: absent means "already built," which is the correct default for every pre-existing object literal. */
  buildStartedAt?: number | null;
}

export interface ExtractionTileUpgradeInProgress {
  targetTier: ExtractionTier;
  startedAt: number;
}

export const EXTRACTION_TILES_DB_KEY = "extractionTiles";
