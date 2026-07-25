import type { ResourceType } from "../data/resources";
import { MAX_TOWER_LEVEL } from "../data/towers";
import type { Tweaks } from "../data/tweaksSchema";
import { formulaACost, formulaBCost } from "./formulas";

export function towerBuildCost(tweaks: Tweaks, n: number): Record<string, number> {
  const cost: Record<string, number> = {};
  for (const [res, amount] of Object.entries(tweaks.towers.build_cost_base)) {
    cost[res] = formulaACost(amount, n);
  }
  return cost;
}

/** Flat construction duration for a freshly-built (always L1) tower — tweaks.jsonc towers.build_time_minutes. */
export function towerBuildDurationMs(tweaks: Tweaks): number {
  return tweaks.towers.build_time_minutes * 60_000;
}

export function towerRange(tweaks: Tweaks, level: number): number {
  return tweaks.towers.base_range_tiles + tweaks.towers.range_per_level * (level - 1);
}

/** dmg(L) = dmg(L-1) * (1 + 0.1*L), cumulative from base_damage at L1. */
export function towerDamage(tweaks: Tweaks, level: number): number {
  let dmg = tweaks.towers.base_damage;
  for (let l = 2; l <= level; l++) {
    dmg *= 1 + 0.1 * l;
  }
  return dmg;
}

/** `garrisonBonusDamage` — a garrisoned militia's attack power added straight onto the tower's own damage (DESIGN.md/TWEAKS.md), before the horde-size percentage scaling. Defaults to 0 for an ungarrisoned tower. */
export function zombiesKilledPerTick(tweaks: Tweaks, level: number, hordeSize: number, garrisonBonusDamage = 0): number {
  return (towerDamage(tweaks, level) + garrisonBonusDamage) * (hordeSize / 100);
}

export function nextTowerLevel(level: number): number | null {
  return level < MAX_TOWER_LEVEL ? level + 1 : null;
}

const TOWER_UPGRADE_PROGRESSION_KEY: Record<number, keyof Tweaks["towers"]["upgrade_tech_progression"]> = {
  2: "L1_to_L2",
  3: "L2_to_L3",
  4: "L3_to_L4",
};

/**
 * Cost to upgrade a tower to `targetLevel`. upgrade_cost_base only defines
 * wood+stone, but upgrade_tech_progression lists steel (L2->L3 / L3->L4)
 * with no base amount of its own — resolved the same way as extraction
 * tiers/paths (engine/tiers.ts, engine/paths.ts): reuse that resource's own
 * extraction-tile upgrade base as the baseline.
 */
export function towerUpgradeCost(tweaks: Tweaks, targetLevel: number): Partial<Record<ResourceType, number>> {
  const progressionKey = TOWER_UPGRADE_PROGRESSION_KEY[targetLevel];
  const chain = tweaks.towers.upgrade_tech_progression[progressionKey];

  const cost: Partial<Record<ResourceType, number>> = {};
  for (const resource of chain) {
    const key = resource as ResourceType;
    const baseAmount = tweaks.towers.upgrade_cost_base[key] ?? tweaks.extraction_tiles[key].tier_upgrade_cost_base[key];
    cost[key] = (cost[key] ?? 0) + formulaBCost(baseAmount, targetLevel);
  }
  return cost;
}

/** towerUpgradeDurationMs(targetLevel) = upgrade_time_minutes_base * targetLevel — tweaks.jsonc towers. */
export function towerUpgradeDurationMs(tweaks: Tweaks, targetLevel: number): number {
  return tweaks.towers.upgrade_time_minutes_base * targetLevel * 60_000;
}
