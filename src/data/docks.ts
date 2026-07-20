import type { Axial } from "../engine/hexCoords";
import type { ResourceType } from "./resources";

export interface DockFishingBoatInProgress {
  startedAt: number;
}

/**
 * A water-based food building — placement (a water tile bordering land, see
 * engine/terrain.ts:isTransitionTile) and economics (deposits straight to
 * base storage each tick, no path-connection draining, no tier upgrades)
 * both differ enough from ExtractionTile that it gets its own parallel shape
 * rather than being shoehorned into that type. Immune to horde capture
 * (hordes can't reach water tiles today) — no `damaged` field, unlike every
 * land structure.
 */
export interface DockRecord {
  coord: Axial;
  /** Local food buffer, capped at storage.capacity_base_per_resource — drains straight to base storage each tick (engine/docks.ts:accrueDockResources). */
  stockpile: number;
  /** True once built — boosts this dock's yield by tweaks.docks.fishing_boat.yield_bonus_multiplier and shows a boat icon (src/render/HexCanvas.tsx). */
  fishingBoat: boolean;
  /** Set while a fishing boat build is in progress; cleared (fishingBoat flips true) once its timer elapses. */
  fishingBoatUpgrade: DockFishingBoatInProgress | null;
  /** Cumulative build spend — refunded proportionally on demolish (engine/formulas.ts:demolishRefund). */
  totalInvested: Partial<Record<ResourceType, number>>;
  /** Cost paid for the original build only. */
  buildCost: Partial<Record<ResourceType, number>>;
}

export type DocksRecord = DockRecord[];

export const DOCKS_DB_KEY = "docks";
