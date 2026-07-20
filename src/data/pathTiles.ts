import type { Axial } from "../engine/hexCoords";
import type { ResourceType } from "./resources";

export type PathTier = "goat_track" | "stone_road" | "highway";

export interface PathTile {
  coord: Axial;
  tier: PathTier;
  /** Cumulative build + upgrade spend, resource by resource — refunded proportionally on demolish. */
  totalInvested: Partial<Record<ResourceType, number>>;
  /** Set when a tier upgrade has been paid for but hasn't completed yet — tier only changes once the timer elapses. */
  upgrade: PathTileUpgradeInProgress | null;
  /** Cost paid for the original build only (never touched by upgrades) — the basis for repairCost() after horde capture. */
  buildCost: Partial<Record<ResourceType, number>>;
  /** True once a horde captures this tile (engine/hordes.ts) — non-interactive until the tile is reclaimed and repaired, DESIGN.md §12. */
  damaged: boolean;
}

export interface PathTileUpgradeInProgress {
  targetTier: Exclude<PathTier, "goat_track">;
  startedAt: number;
}

export const PATH_TILES_DB_KEY = "pathTiles";
