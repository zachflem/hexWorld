import type { ExtractionTile } from "../data/extractionTiles";
import type { PowerStation } from "../data/powerStations";
import type { Tower } from "../data/towers";
import type { Wall } from "../data/walls";
import type { Tweaks } from "../data/tweaksSchema";
import { isStructureActive } from "./formulas";
import { powerPerformanceFactor, type PowerNetworkSnapshot } from "./power";
import { TIER_ORDER } from "./tiers";
import { WALL_TIER_LEVEL } from "./walls";

export type NoiseAction = keyof Tweaks["noise"]["one_time_action_noise"];

/** floor_contribution(tile) = base * extraction_tier_noise_multiplier^tier_index — small tier is "foraging," large is "a factory farm." */
export function extractionFloorContribution(tweaks: Tweaks, tile: ExtractionTile): number {
  if (!isStructureActive(tile)) return 0;
  const base = tweaks.noise.passive_gathering_noise_floor[tile.resource];
  const tierIndex = TIER_ORDER.indexOf(tile.tier);
  return base * tweaks.noise.extraction_tier_noise_multiplier ** tierIndex;
}

/** Towers/walls are built to watch and hold ground quietly — a tiny per-level/tier floor contribution vs. an active extraction tile. A damaged (horde-captured) or still-under-construction one contributes nothing, same as everywhere else it goes non-functional (engine/formulas.ts:isStructureActive). */
export function towerFloorContribution(tweaks: Tweaks, tower: Tower): number {
  return isStructureActive(tower) ? tweaks.noise.passive_watch_noise_floor.tower_per_level * tower.level : 0;
}

export function wallFloorContribution(tweaks: Tweaks, wall: Wall): number {
  return isStructureActive(wall) ? tweaks.noise.passive_watch_noise_floor.wall_per_tier_level * WALL_TIER_LEVEL[wall.tier] : 0;
}

/**
 * An active wall (engine/formulas.ts:isStructureActive) muffles noise
 * leaking from the rest of the base, on top of its own (tiny, positive)
 * presence contribution above — tweaks.jsonc walls.noise_dampening_per_tier.
 * Subtracted from the floor in noiseFloor below; the floor's own
 * noise_floor_minimum clamp still applies afterward, so this can quiet an
 * active base down but never past the game's absolute silent floor.
 */
export function wallNoiseDampening(
  tweaks: Tweaks,
  wall: Wall,
  powerNetwork?: PowerNetworkSnapshot,
): number {
  if (!isStructureActive(wall)) return 0;
  const base = tweaks.walls.noise_dampening_per_tier[wall.tier];
  if (!powerNetwork) return base;
  return base * powerPerformanceFactor(powerNetwork, WALL_TIER_LEVEL[wall.tier], wall.coord);
}

export function powerStationFloorContribution(tweaks: Tweaks, station: PowerStation): number {
  return isStructureActive(station) ? tweaks.power.passive_noise_floor_per_level * station.level : 0;
}

/** cap(level) = cap_base + cap_per_level * (level - 1) — mirrors buildSlotCap's formula. */
export function noiseCap(tweaks: Tweaks, baseLevel: number): number {
  const { cap_base, cap_per_level } = tweaks.noise;
  return cap_base + cap_per_level * (baseLevel - 1);
}

/**
 * The steady-state noise level your current structures settle toward —
 * DESIGN.md §12. Towers/walls only ever add a sliver each
 * (passive_watch_noise_floor) — extraction tiles are the loud ones.
 * Walls additionally dampen the total (wallNoiseDampening, above) — the only
 * negative contribution in this sum. Never below noise_floor_minimum —
 * TWEAKS.md's "practically silent" floor, even with zero structures standing.
 */
export function noiseFloor(
  tweaks: Tweaks,
  extractionTiles: ExtractionTile[],
  towers: Tower[],
  walls: Wall[],
  baseLevel: number,
  powerStations: PowerStation[] = [],
  powerNetwork?: PowerNetworkSnapshot,
): number {
  const extractionTotal = extractionTiles.reduce((sum, tile) => sum + extractionFloorContribution(tweaks, tile), 0);
  const towerTotal = towers.reduce((sum, tower) => sum + towerFloorContribution(tweaks, tower), 0);
  const wallTotal = walls.reduce((sum, wall) => sum + wallFloorContribution(tweaks, wall), 0);
  const stationTotal = powerStations.reduce((sum, station) => sum + powerStationFloorContribution(tweaks, station), 0);
  const wallDampeningTotal = walls.reduce((sum, wall) => sum + wallNoiseDampening(tweaks, wall, powerNetwork), 0);
  const structureTotal = extractionTotal + towerTotal + wallTotal + stationTotal - wallDampeningTotal;
  return Math.min(noiseCap(tweaks, baseLevel), Math.max(tweaks.noise.noise_floor_minimum, structureTotal));
}

/**
 * Advances noise toward its current ambient floor over `elapsedSeconds`,
 * via exponential convergence (a closed-form solution, so it's correct
 * regardless of how long the gap has been open — e.g. reopening after an
 * hour offline lands exactly where continuous convergence would have put
 * it, not an Euler-integration approximation). A build/upgrade action spikes
 * noise above the floor (see addActionNoise); it then rolls back down. If
 * the floor ever drops (a structure lost later), noise settles down to meet it.
 */
export function accrueNoise(
  tweaks: Tweaks,
  extractionTiles: ExtractionTile[],
  towers: Tower[],
  walls: Wall[],
  noise: number,
  elapsedSeconds: number,
  baseLevel: number,
  powerStations: PowerStation[] = [],
  powerNetwork?: PowerNetworkSnapshot,
): number {
  if (elapsedSeconds <= 0) return noise;
  const floor = noiseFloor(
    tweaks,
    extractionTiles,
    towers,
    walls,
    baseLevel,
    powerStations,
    powerNetwork,
  );
  const k = Math.log(2) / tweaks.noise.floor_convergence_half_life_seconds;
  const next = floor + (noise - floor) * Math.exp(-k * elapsedSeconds);
  return Math.min(noiseCap(tweaks, baseLevel), Math.max(tweaks.noise.noise_floor_minimum, next));
}

/**
 * One-time noise spike for a discrete player action (build/upgrade/collect).
 * `multiplier` (default 1) scales the configured value — used by rush
 * training (engine/units.ts note, App.tsx:handleRushTrainScouts/Militia),
 * where each rushed unit adds its own noise rather than one flat spike per
 * action, unlike every other one-time action here.
 */
export function addActionNoise(
  tweaks: Tweaks,
  noise: number,
  action: NoiseAction,
  baseLevel: number,
  multiplier = 1,
): number {
  const spiked = noise + tweaks.noise.one_time_action_noise[action] * multiplier;
  return Math.min(noiseCap(tweaks, baseLevel), Math.max(tweaks.noise.noise_floor_minimum, spiked));
}
