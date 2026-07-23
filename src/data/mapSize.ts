import type { Tweaks } from "./tweaksSchema";
import type { WorldRecord } from "./world";

/** Onboarding map-size choices — must stay in sync with ROADMAP UX #10 / #P2. */
export const MAP_SIZE_OPTIONS = [48, 96, 128] as const;
export type MapSizeOption = (typeof MAP_SIZE_OPTIONS)[number];

export const DEFAULT_MAP_SIZE: MapSizeOption = 128;
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

/** Linear scale from the 128×128 reference — used for den count, min distances, etc. */
export function scaleToMapSize(value: number, gridSize: number, referenceSize = REFERENCE_MAP_SIZE): number {
  return Math.max(1, Math.round(value * (gridSize / referenceSize)));
}

/**
 * World-gen tweaks for a chosen map size — grid bounds plus dens/lab distances
 * and count scaled so smaller maps stay paced, not just cropped.
 */
export function tweaksForMapSize(tweaks: Tweaks, gridSize: number): Tweaks {
  const scale = (n: number) => scaleToMapSize(n, gridSize);
  return {
    ...tweaks,
    game: { ...tweaks.game, grid_size: gridSize },
    dens: {
      ...tweaks.dens,
      count: scale(tweaks.dens.count),
      min_distance_from_base: scale(tweaks.dens.min_distance_from_base),
      max_relevant_distance: scale(tweaks.dens.max_relevant_distance),
      level_cap_by_distance: {
        ...tweaks.dens.level_cap_by_distance,
        distance_per_level_step: scale(tweaks.dens.level_cap_by_distance.distance_per_level_step),
      },
    },
    lab: {
      ...tweaks.lab,
      min_distance_from_base: scale(tweaks.lab.min_distance_from_base),
    },
  };
}
