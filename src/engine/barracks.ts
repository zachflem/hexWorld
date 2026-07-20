import type { Barracks } from "../data/barracks";
import { MAX_BARRACKS_LEVEL } from "../data/barracks";
import type { ResourceType } from "../data/resources";
import type { Tweaks } from "../data/tweaksSchema";
import { formulaACost, formulaBCost } from "./formulas";

export function barracksBuildCost(tweaks: Tweaks, n: number): Record<string, number> {
  const cost: Record<string, number> = {};
  for (const [res, amount] of Object.entries(tweaks.barracks.build_cost_base)) {
    cost[res] = formulaACost(amount, n);
  }
  return cost;
}

export function nextBarracksLevel(level: number): number | null {
  return level < MAX_BARRACKS_LEVEL ? level + 1 : null;
}

const BARRACKS_UPGRADE_PROGRESSION_KEY: Record<number, keyof Tweaks["barracks"]["upgrade_tech_progression"]> = {
  2: "L1_to_L2",
  3: "L2_to_L3",
  4: "L3_to_L4",
};

/** Same reused-baseline resolution as towers/walls: steel/power have no base of their own, so reuse that resource's own extraction-tile upgrade base. */
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

export function scoutCapacity(tweaks: Tweaks, barracksList: Barracks[]): number {
  return barracksList.reduce((sum, b) => sum + tweaks.barracks.scout_capacity_per_level * b.level, 0);
}

/**
 * Unlike militiaCapacity/scoutCapacity, this unit type is level-gated — a
 * barracks below units.junkyard_knight.min_barracks_level hasn't built the
 * wing for it yet and contributes 0, not just less. A barracks that meets
 * the gate still scales by its own level, same per_level_value*level shape.
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

/**
 * Training-throughput weight: each non-damaged barracks contributes its own
 * level, not just a flat "1" per barracks — a lone L4 barracks trains 4x as
 * fast as a lone L1, the same "per level, summed across barracks" pattern
 * militiaCapacity/scoutCapacity already use for standing capacity above.
 * Damaged barracks contribute nothing, same rule as everywhere else a
 * horde-captured structure goes non-functional.
 */
export function barracksTrainingCapacity(barracksList: Barracks[]): number {
  return barracksList.reduce((sum, b) => (b.damaged ? sum : sum + b.level), 0);
}
