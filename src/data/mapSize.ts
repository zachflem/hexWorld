import type { Tweaks } from "./tweaksSchema";
import type { WorldRecord } from "./world";

/** Onboarding map-size choices — 32 default quick map through 128 epic. */
export const MAP_SIZE_OPTIONS = [32, 64, 96, 128] as const;
export type MapSizeOption = (typeof MAP_SIZE_OPTIONS)[number];

export const DEFAULT_MAP_SIZE: MapSizeOption = 32;
/** Balance reference — dens count / distances in tweaks are authored for this size. */
export const REFERENCE_MAP_SIZE = 128;

export function isMapSizeOption(value: number): value is MapSizeOption {
  return (MAP_SIZE_OPTIONS as readonly number[]).includes(value);
}

/** Per-save grid width; legacy saves without the field used profile default (128). */
export function resolveWorldGridSize(world: WorldRecord, tweaks: Tweaks): number {
  return world.gridSize ?? tweaks.game.grid_size;
}

export function isProfileGridSizeLocked(tweaks: Tweaks): boolean {
  return tweaks.game.grid_size_locked === true;
}

export function isProfileSeedLocked(tweaks: Tweaks): boolean {
  return tweaks.game.world_seed != null;
}

/**
 * Map size for a new game — profile lock wins over onboarding when
 * `game.grid_size_locked` is true (scenario profiles).
 */
export function resolveGridSizeForNewGame(tweaks: Tweaks, chosenFromOnboarding: MapSizeOption): number {
  if (isProfileGridSizeLocked(tweaks)) {
    return tweaks.game.grid_size;
  }
  return chosenFromOnboarding;
}

/**
 * World seed for a new game — `game.world_seed` wins over onboarding when set
 * (scenario profiles).
 */
export function resolveSeedForNewGame(
  tweaks: Tweaks,
  chosenFromOnboarding: number | undefined,
  randomSeed: () => number,
): number {
  const fixed = tweaks.game.world_seed;
  if (fixed != null) return fixed;
  return chosenFromOnboarding ?? randomSeed();
}

/** Linear scale from the 128×128 reference — used for den distances, separation, etc. */
export function scaleToMapSize(value: number, gridSize: number, referenceSize = REFERENCE_MAP_SIZE): number {
  return Math.max(1, Math.round(value * (gridSize / referenceSize)));
}

/**
 * Base den counts per onboarding map size (#68). `createDens` then rolls
 * ±`DENS_COUNT_VARIANCE` from the seed so two 32×32 seeds can be 5–7 dens.
 * Unknown sizes (legacy saves) fall back to linear scale from the 128 value.
 */
const DENS_COUNT_BY_MAP_SIZE: Partial<Record<number, number>> = {
  32: 6,
  64: 10,
  96: 14,
  128: 18,
};

/** Midpoint den count for a map size (before per-seed ±1 variance). */
export function densCountForMapSize(gridSize: number, referenceCount: number): number {
  return DENS_COUNT_BY_MAP_SIZE[gridSize] ?? scaleToMapSize(referenceCount, gridSize);
}

const SCRAP_STASH_COUNT_BY_MAP_SIZE: Partial<Record<number, number>> = {
  32: 8,
  64: 14,
  96: 20,
  128: 28,
};

/** Midpoint scrap-stash count for a map size (before per-seed ±1 variance). */
export function scrapStashCountForMapSize(gridSize: number, referenceCount: number): number {
  return SCRAP_STASH_COUNT_BY_MAP_SIZE[gridSize] ?? scaleToMapSize(referenceCount, gridSize);
}

/**
 * World-gen tweaks for a chosen map size — grid bounds plus dens/lab/scrap
 * distances and counts so smaller maps stay paced, not just cropped.
 */
export function tweaksForMapSize(tweaks: Tweaks, gridSize: number): Tweaks {
  const scale = (n: number) => scaleToMapSize(n, gridSize);
  return {
    ...tweaks,
    game: { ...tweaks.game, grid_size: gridSize },
    dens: {
      ...tweaks.dens,
      count: densCountForMapSize(gridSize, tweaks.dens.count),
      min_distance_from_base: scale(tweaks.dens.min_distance_from_base),
      max_relevant_distance: scale(tweaks.dens.max_relevant_distance),
      level_cap_by_distance: {
        ...tweaks.dens.level_cap_by_distance,
        distance_per_level_step: scale(tweaks.dens.level_cap_by_distance.distance_per_level_step),
      },
    },
    scrap_stashes: {
      ...tweaks.scrap_stashes,
      count: scrapStashCountForMapSize(gridSize, tweaks.scrap_stashes.count),
      early_guarantee_max_distance: scale(tweaks.scrap_stashes.early_guarantee_max_distance),
    },
    lab: {
      ...tweaks.lab,
      min_distance_from_base: scale(tweaks.lab.min_distance_from_base),
    },
  };
}
