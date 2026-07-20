import type { Axial } from "../engine/hexCoords";

export interface HordeRecord {
  id: string;
  originDenId: string;
  size: number;
  /** Full path from spawn tile to base, computed once at spawn — terrain-only cost, so it stays valid for the horde's whole lifetime. */
  path: Axial[];
  /** Index into `path` of the tile the horde currently holds. */
  pathIndex: number;
  /** 0..1 fractional progress toward path[pathIndex + 1]. */
  progress: number;
  spawnedAt: number;
  /**
   * Both captured once at spawn from the player's noise level at that moment
   * (engine/hordes.ts:checkHordeSpawns) and held fixed for the horde's whole
   * lifetime — same reasoning as `size` and `path` already being spawn-time
   * snapshots, so a horde's behavior doesn't flicker if noise later drifts.
   * A quiet spawn means slow (speedFactor < 1) and quick to disperse (high
   * decayPct); a loud one means fast (speedFactor near 1) and persistent
   * (low decayPct) — tweaks.jsonc horde.speed_factor_at_*_noise /
   * size_decay_pct_per_tile_at_*_noise.
   */
  speedFactor: number;
  decayPct: number;
}

export type HordesRecord = HordeRecord[];

export const HORDES_DB_KEY = "hordes";
