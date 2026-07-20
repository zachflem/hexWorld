import type { Axial } from "../engine/hexCoords";
import type { ResourceType } from "./resources";

export type WallTier = "wood" | "rock" | "steel";

export interface Wall {
  coord: Axial;
  tier: WallTier;
  durability: number;
  /** Cumulative build + upgrade + repair spend, resource by resource — refunded proportionally on demolish. */
  totalInvested: Partial<Record<ResourceType, number>>;
  /** Set when an upgrade or repair has been paid for but hasn't completed yet — mutually exclusive, so one field covers both. */
  action: WallActionInProgress | null;
  /** Cost paid for the original build only (never touched by upgrades/repairs) — the basis for repairCost() after horde capture. */
  buildCost: Partial<Record<ResourceType, number>>;
  /** True once a horde captures this tile (engine/hordes.ts) — non-interactive (including as horde defense) until the tile is reclaimed and repaired, DESIGN.md §12. Independent of `durability`/`action`, which track the pre-existing HP-repair mechanic. */
  damaged: boolean;
}

export type WallActionInProgress =
  | { kind: "upgrade"; targetTier: Exclude<WallTier, "wood">; startedAt: number }
  | { kind: "repair"; startedAt: number };

export const WALLS_DB_KEY = "walls";
