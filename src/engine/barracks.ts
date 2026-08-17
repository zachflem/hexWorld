import type { Barracks, TrainingUnitType } from "../data/barracks";
import { MAX_BARRACKS_LEVEL } from "../data/barracks";
import type { UnitsRecord } from "../data/units";
import type { ResourceType } from "../data/resources";
import type { Tweaks } from "../data/tweaksSchema";
import { formulaACost, formulaBCost, isStructureActive } from "./formulas";
import { powerPerformanceFactor, type PowerNetworkSnapshot } from "./power";
import {
  crossBowSniperTrainDurationMs,
  junkyardKnightTrainDurationMs,
  militiaTrainDurationMs,
  resolveTrainingQueue,
} from "./units";

export function barracksBuildCost(tweaks: Tweaks, n: number): Record<string, number> {
  const cost: Record<string, number> = {};
  for (const [res, amount] of Object.entries(tweaks.barracks.build_cost_base)) {
    cost[res] = formulaACost(amount, n);
  }
  return cost;
}

/** Flat construction duration for a freshly-built (always L1) barracks — tweaks.jsonc barracks.build_time_minutes. */
export function barracksBuildDurationMs(tweaks: Tweaks): number {
  return tweaks.barracks.build_time_minutes * 60_000;
}

export function nextBarracksLevel(level: number): number | null {
  return level < MAX_BARRACKS_LEVEL ? level + 1 : null;
}

const BARRACKS_UPGRADE_PROGRESSION_KEY: Record<number, keyof Tweaks["barracks"]["upgrade_tech_progression"]> = {
  2: "L1_to_L2",
  3: "L2_to_L3",
  4: "L3_to_L4",
};

/** Same reused-baseline resolution as towers/walls: steel has no barracks base of its own, so reuse that resource's own extraction-tile upgrade base. */
export function barracksUpgradeCost(tweaks: Tweaks, targetLevel: number): Partial<Record<ResourceType, number>> {
  const progressionKey = BARRACKS_UPGRADE_PROGRESSION_KEY[targetLevel];
  const chain = tweaks.barracks.upgrade_tech_progression[progressionKey];

  const cost: Partial<Record<ResourceType, number>> = {};
  for (const resource of chain) {
    const key = resource as ResourceType;
    const baseAmount =
      tweaks.barracks.upgrade_cost_base[key] ?? tweaks.extraction_tiles[key].tier_upgrade_cost_base[key];
    cost[key] = (cost[key] ?? 0) + formulaBCost(baseAmount, targetLevel);
  }
  return cost;
}

/** barracksUpgradeDurationMs(targetLevel) = upgrade_time_minutes_base * targetLevel — tweaks.jsonc barracks. */
export function barracksUpgradeDurationMs(tweaks: Tweaks, targetLevel: number): number {
  return tweaks.barracks.upgrade_time_minutes_base * targetLevel * 60_000;
}

/** Total capacity across every barracks the player owns — each contributes per_level_value * its own level. */
export function militiaCapacity(tweaks: Tweaks, barracksList: Barracks[]): number {
  return barracksList.reduce((sum, b) => sum + tweaks.barracks.militia_capacity_per_level * b.level, 0);
}

/**
 * Unlike militiaCapacity, this unit type is level-gated — a barracks below
 * units.junkyard_knight.min_barracks_level hasn't built the wing for it yet
 * and contributes 0, not just less. A barracks that meets the gate still
 * scales by its own level, same per_level_value*level shape.
 */
export function junkyardKnightCapacity(tweaks: Tweaks, barracksList: Barracks[]): number {
  const minLevel = tweaks.units.junkyard_knight.min_barracks_level;
  return barracksList.reduce(
    (sum, b) => (b.level >= minLevel ? sum + tweaks.barracks.junkyard_knight_capacity_per_level * b.level : sum),
    0,
  );
}

/** Same level-gated shape as junkyardKnightCapacity, at units.cross_bow_sniper.min_barracks_level. */
export function crossBowSniperCapacity(tweaks: Tweaks, barracksList: Barracks[]): number {
  const minLevel = tweaks.units.cross_bow_sniper.min_barracks_level;
  return barracksList.reduce(
    (sum, b) => (b.level >= minLevel ? sum + tweaks.barracks.cross_bow_sniper_capacity_per_level * b.level : sum),
    0,
  );
}

export function trainingUnitDurationMs(tweaks: Tweaks, unitType: TrainingUnitType, barracksLevel: number): number {
  switch (unitType) {
    case "militia":
      return militiaTrainDurationMs(tweaks, barracksLevel);
    case "junkyard_knight":
      return junkyardKnightTrainDurationMs(tweaks, barracksLevel);
    case "cross_bow_sniper":
      return crossBowSniperTrainDurationMs(tweaks, barracksLevel);
  }
}

export function trainingUnitLabel(unitType: TrainingUnitType): string {
  switch (unitType) {
    case "militia":
      return "militia";
    case "junkyard_knight":
      return "junkyard knights";
    case "cross_bow_sniper":
      return "cross-bow snipers";
  }
}

/**
 * Resolves every active barracks' trainingQueue and delivers completed units
 * into the shared standing-army counts. Damaged or still-under-construction
 * barracks pause their queue (same rule as #1 — no training throughput while
 * non-functional) without discarding progress.
 */
export function advanceBarracksTraining(
  tweaks: Tweaks,
  barracksList: Barracks[],
  units: UnitsRecord,
  virtualNow: number,
  powerNetwork?: PowerNetworkSnapshot,
): { barracksList: Barracks[]; units: UnitsRecord } {
  let nextUnits = units;
  const nextBarracks = barracksList.map((barracks) => {
    const queue = barracks.trainingQueue;
    if (!queue || !isStructureActive(barracks)) return barracks;

    const powerMul = powerNetwork
      ? powerPerformanceFactor(powerNetwork, barracks.level, barracks.coord)
      : 1;
    if (powerMul <= 0) return barracks;

    const result = resolveTrainingQueue(
      queue,
      trainingUnitDurationMs(tweaks, queue.unitType, barracks.level) / powerMul,
      virtualNow,
    );
    if (result.delivered > 0) {
      switch (queue.unitType) {
        case "militia":
          nextUnits = { ...nextUnits, militiaCount: nextUnits.militiaCount + result.delivered };
          break;
        case "junkyard_knight":
          nextUnits = { ...nextUnits, junkyardKnightCount: nextUnits.junkyardKnightCount + result.delivered };
          break;
        case "cross_bow_sniper":
          nextUnits = { ...nextUnits, crossBowSniperCount: nextUnits.crossBowSniperCount + result.delivered };
          break;
      }
    }

    return result.queue === queue
      ? barracks
      : {
          ...barracks,
          trainingQueue: result.queue
            ? { unitType: queue.unitType, remaining: result.queue.remaining, currentUnitStartedAt: result.queue.currentUnitStartedAt }
            : null,
        };
  });

  return { barracksList: nextBarracks, units: nextUnits };
}
