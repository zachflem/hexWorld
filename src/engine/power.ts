import type { Barracks } from "../data/barracks";
import type { DockRecord } from "../data/docks";
import type { ExtractionTile } from "../data/extractionTiles";
import type { PathTile } from "../data/pathTiles";
import { MAX_POWER_STATION_LEVEL, type PowerStation } from "../data/powerStations";
import type { ResourceType } from "../data/resources";
import type { Tower } from "../data/towers";
import type { Tweaks } from "../data/tweaksSchema";
import type { Wall } from "../data/walls";
import { formulaACost, formulaBCost, isStructureActive } from "./formulas";
import { axialKey, axialSpiral, type Axial } from "./hexCoords";
import { PATH_TIER_LEVEL } from "./paths";
import { extractionTierLevel } from "./tiers";
import { WALL_TIER_LEVEL } from "./walls";

export type PowerConsumerKind = "extraction" | "path" | "tower" | "wall" | "barracks" | "dock";

export type StructurePowerState = "exempt" | "full" | "degraded" | "offline";

export type PowerNetworkSnapshot = {
  poweredTiles: Set<string>;
  totalCapacity: number;
  totalDraw: number;
  factor: number;
  cutoff: number;
};

export function powerStationCapacity(tweaks: Tweaks, level: number): number {
  const { capacity_base, capacity_per_level } = tweaks.power;
  return capacity_base + capacity_per_level * (level - 1);
}

export function powerStationAoeRadius(tweaks: Tweaks, level: number): number {
  const { aoe_base_tiles, aoe_per_level } = tweaks.power;
  return aoe_base_tiles + aoe_per_level * (level - 1);
}

export function powerStationBuildCost(tweaks: Tweaks, n: number): Record<string, number> {
  const cost: Record<string, number> = {};
  for (const [res, amount] of Object.entries(tweaks.power.build_cost_base)) {
    cost[res] = formulaACost(amount, n);
  }
  return cost;
}

export function powerStationBuildDurationMs(tweaks: Tweaks): number {
  return tweaks.power.build_time_minutes * 60_000;
}

export function nextPowerStationLevel(level: number): number | null {
  return level < MAX_POWER_STATION_LEVEL ? level + 1 : null;
}

export function powerStationUpgradeCost(
  tweaks: Tweaks,
  targetLevel: number,
): Partial<Record<ResourceType, number>> {
  const cost: Partial<Record<ResourceType, number>> = {};
  for (const [res, amount] of Object.entries(tweaks.power.upgrade_cost_base)) {
    const key = res as ResourceType;
    cost[key] = (cost[key] ?? 0) + formulaBCost(amount, targetLevel);
  }
  return cost;
}

export function powerStationUpgradeDurationMs(tweaks: Tweaks, targetLevel: number): number {
  return tweaks.power.upgrade_time_minutes_base * targetLevel * 60_000;
}

/** Active stations only — damaged / under construction contribute neither capacity nor AoE. */
export function poweredTiles(stations: PowerStation[], tweaks: Tweaks): Set<string> {
  const keys = new Set<string>();
  for (const station of stations) {
    if (!isStructureActive(station)) continue;
    const radius = powerStationAoeRadius(tweaks, station.level);
    for (const coord of axialSpiral(station.coord, radius)) {
      keys.add(axialKey(coord));
    }
  }
  return keys;
}

export function totalPowerCapacity(stations: PowerStation[], tweaks: Tweaks): number {
  return stations.reduce(
    (sum, station) => (isStructureActive(station) ? sum + powerStationCapacity(tweaks, station.level) : sum),
    0,
  );
}

export function consumerDraw(tweaks: Tweaks, kind: PowerConsumerKind, level: number): number {
  return tweaks.power.draw_base[kind] * level;
}

/**
 * Draw only from active L2+ consumers currently on a powered tile.
 * Unpowered / inactive / L1 structures contribute 0 (offline or exempt).
 */
export function totalPowerDraw(
  tweaks: Tweaks,
  powered: Set<string>,
  extractionTiles: ExtractionTile[],
  pathTiles: PathTile[],
  towers: Tower[],
  walls: Wall[],
  barracksList: Barracks[],
  _docks: DockRecord[],
): number {
  let draw = 0;

  for (const tile of extractionTiles) {
    if (!isStructureActive(tile)) continue;
    const level = extractionTierLevel(tile.tier);
    if (level < 2 || !powered.has(axialKey(tile.coord))) continue;
    draw += consumerDraw(tweaks, "extraction", level);
  }
  for (const tile of pathTiles) {
    if (!isStructureActive(tile)) continue;
    const level = PATH_TIER_LEVEL[tile.tier];
    if (level < 2 || !powered.has(axialKey(tile.coord))) continue;
    draw += consumerDraw(tweaks, "path", level);
  }
  for (const tower of towers) {
    if (!isStructureActive(tower)) continue;
    if (tower.level < 2 || !powered.has(axialKey(tower.coord))) continue;
    draw += consumerDraw(tweaks, "tower", tower.level);
  }
  for (const wall of walls) {
    if (!isStructureActive(wall)) continue;
    const level = WALL_TIER_LEVEL[wall.tier];
    if (level < 2 || !powered.has(axialKey(wall.coord))) continue;
    draw += consumerDraw(tweaks, "wall", level);
  }
  for (const barracks of barracksList) {
    if (!isStructureActive(barracks)) continue;
    if (barracks.level < 2 || !powered.has(axialKey(barracks.coord))) continue;
    draw += consumerDraw(tweaks, "barracks", barracks.level);
  }
  // Docks have no level/tier upgrades today — always L1 (exempt, no draw).

  return draw;
}

export function powerFactor(capacity: number, draw: number): number {
  if (draw <= 0) return 1;
  return Math.min(1, Math.max(0, capacity / draw));
}

export function computePowerNetwork(
  tweaks: Tweaks,
  stations: PowerStation[],
  extractionTiles: ExtractionTile[],
  pathTiles: PathTile[],
  towers: Tower[],
  walls: Wall[],
  barracksList: Barracks[],
  docks: DockRecord[],
): PowerNetworkSnapshot {
  const powered = poweredTiles(stations, tweaks);
  const capacity = totalPowerCapacity(stations, tweaks);
  const draw = totalPowerDraw(tweaks, powered, extractionTiles, pathTiles, towers, walls, barracksList, docks);
  const cutoff = tweaks.power.cutoff_factor;
  return {
    poweredTiles: powered,
    totalCapacity: capacity,
    totalDraw: draw,
    factor: powerFactor(capacity, draw),
    cutoff,
  };
}

export function structurePowerState(network: PowerNetworkSnapshot, level: number, coord: Axial): StructurePowerState {
  if (level < 2) return "exempt";
  if (!network.poweredTiles.has(axialKey(coord))) return "offline";
  if (network.factor >= 1) return "full";
  if (network.factor >= network.cutoff) return "degraded";
  return "offline";
}

/**
 * Continuous performance multiplier for degradable effects.
 * L1 / exempt → 1; full → 1; degraded → factor; offline / cut-off → 0.
 */
export function powerPerformanceFactor(network: PowerNetworkSnapshot, level: number, coord: Axial): number {
  const state = structurePowerState(network, level, coord);
  if (state === "exempt" || state === "full") return 1;
  if (state === "degraded") return network.factor;
  return 0;
}

export function powerStateLabel(state: StructurePowerState): string | null {
  switch (state) {
    case "exempt":
    case "full":
      return null;
    case "degraded":
      return "Brownout — underpowered";
    case "offline":
      return "No power";
  }
}
