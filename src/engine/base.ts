import type { BaseRelocationInProgress, BaseUpgradeInProgress } from "../data/base";
import type { ResourceType } from "../data/resources";
import type { Tweaks } from "../data/tweaksSchema";
import { formulaBCost } from "./formulas";

/** Cost to upgrade the base to `targetLevel` — Formula B applied to each cost_base resource. */
export function baseUpgradeCost(tweaks: Tweaks, targetLevel: number): Partial<Record<ResourceType, number>> {
  const cost: Partial<Record<ResourceType, number>> = {};
  for (const [res, amount] of Object.entries(tweaks.base_upgrades.cost_base)) {
    cost[res as ResourceType] = formulaBCost(amount, targetLevel);
  }
  return cost;
}

/** time(targetLevel) = first_upgrade_time_minutes * (1 + time_growth_per_level_pct/100) ^ (targetLevel - 2) — TWEAKS.md. targetLevel=2 (the L1->L2 upgrade) costs exactly first_upgrade_time_minutes. */
export function baseUpgradeTimeMinutes(tweaks: Tweaks, targetLevel: number): number {
  const { first_upgrade_time_minutes, time_growth_per_level_pct } = tweaks.base_upgrades;
  const growth = 1 + time_growth_per_level_pct / 100;
  return first_upgrade_time_minutes * growth ** (targetLevel - 2);
}

export function baseUpgradeDurationMs(tweaks: Tweaks, targetLevel: number): number {
  return baseUpgradeTimeMinutes(tweaks, targetLevel) * 60 * 1000;
}

/** Timer runs even while offline — TWEAKS.md — so this is just a threshold check against wall-clock time. */
export function isBaseUpgradeComplete(tweaks: Tweaks, upgrade: BaseUpgradeInProgress, now: number): boolean {
  return now - upgrade.startedAt >= baseUpgradeDurationMs(tweaks, upgrade.targetLevel);
}

/**
 * attackableRadius(level) = attack_radius_cap_base + attack_radius_cap_per_level * (level - 1)
 * — an outer ceiling on attack range, independent of owned-territory radius
 * (OWNED_RADIUS, engine/fog.ts) or fog-of-war visibility. Deliberately
 * generous so adjacency to owned territory (engine/territory.ts) — not this
 * ceiling — is normally the binding constraint. TWEAKS.md.
 */
export function attackableRadius(tweaks: Tweaks, baseLevel: number): number {
  const { attack_radius_cap_base, attack_radius_cap_per_level } = tweaks.base_upgrades;
  return attack_radius_cap_base + attack_radius_cap_per_level * (baseLevel - 1);
}

/**
 * Max HP the base's reinforcement track allows at `reinforcementLevel` —
 * DESIGN.md §9/§13. `base.currentHp` (data/base.ts) is the actual persisted
 * value, which can sit below this after repelling a horde
 * (engine/hordes.ts:advanceHordes) until repaired (baseRepairCost below) or
 * reinforcement is upgraded again (which fully restores it). The live
 * defense a horde's attack is checked against is `base.currentHp` plus any
 * garrison stationed at the base (engine/garrisons.ts), same as a tower/wall
 * would stack on any other tile.
 */
export function baseReinforcementHp(tweaks: Tweaks, reinforcementLevel: number): number {
  return tweaks.base_reinforcement.base_hp + tweaks.base_reinforcement.hp_gain_per_level * reinforcementLevel;
}

/** Reinforcement is capped by base level — tweaks.jsonc base_reinforcement.max_reinforcement_level_equals_base_level is the only behavior ever defined for that flag. */
export function maxReinforcementLevel(baseLevel: number): number {
  return baseLevel;
}

/**
 * Cost to upgrade reinforcement to `targetLevel` — Formula B, same shape as
 * baseUpgradeCost.
 */
export function reinforcementUpgradeCost(tweaks: Tweaks, targetLevel: number): Partial<Record<ResourceType, number>> {
  const cost: Partial<Record<ResourceType, number>> = {};
  for (const [res, amount] of Object.entries(tweaks.base_reinforcement.cost_base)) {
    cost[res as ResourceType] = formulaBCost(amount, targetLevel);
  }
  return cost;
}

/** time(targetLevel) = upgrade_time_minutes_base * targetLevel — same shape as barracksUpgradeDurationMs/towerUpgradeDurationMs. */
export function baseReinforcementUpgradeDurationMs(tweaks: Tweaks, targetLevel: number): number {
  return tweaks.base_reinforcement.upgrade_time_minutes_base * targetLevel * 60 * 1000;
}

/**
 * Cost to fully heal base.currentHp back to maxHp, scaled by how much is
 * missing (mirrors engine/walls.ts:wallRepairCost's missingFraction shape)
 * against the same cost_base Formula B uses for reinforcement upgrades at
 * the base's current reinforcementLevel — a more-invested base costs more to
 * fully patch back up. First pass, untested.
 */
export function baseRepairCost(
  tweaks: Tweaks,
  currentHp: number,
  maxHp: number,
  reinforcementLevel: number,
): Partial<Record<ResourceType, number>> {
  const missingFraction = maxHp > 0 ? Math.max(0, Math.min(1, (maxHp - currentHp) / maxHp)) : 0;
  const cost: Partial<Record<ResourceType, number>> = {};
  for (const [res, amount] of Object.entries(tweaks.base_reinforcement.cost_base)) {
    cost[res as ResourceType] = formulaBCost(amount, reinforcementLevel) * missingFraction;
  }
  return cost;
}

/** Repair duration scales with severity, mirroring wallRepairDurationMs — tweaks.jsonc base_reinforcement.seconds_per_missing_hp. */
export function baseReinforcementRepairDurationMs(tweaks: Tweaks, currentHp: number, maxHp: number): number {
  const missingHp = Math.max(0, maxHp - currentHp);
  return missingHp * tweaks.base_reinforcement.seconds_per_missing_hp * 1000;
}

/** Relocation is gated behind a minimum base level (tweaks.jsonc base_relocation.min_base_level), per explicit design request. */
export function canRelocateBase(tweaks: Tweaks, baseLevel: number): boolean {
  return baseLevel >= tweaks.base_relocation.min_base_level;
}

/**
 * Cost scales linearly with straight-line hex distance to the destination
 * (caller-computed, e.g. axialDistance(territory.base, destination)) — a
 * short defensive shuffle is cheap, a cross-map move is a major undertaking,
 * per tweaks.jsonc base_relocation._note.
 */
export function baseRelocationCost(tweaks: Tweaks, distanceTiles: number): Partial<Record<ResourceType, number>> {
  const cost: Partial<Record<ResourceType, number>> = {};
  for (const [res, amount] of Object.entries(tweaks.base_relocation.cost_per_tile_distance)) {
    cost[res as ResourceType] = amount * distanceTiles;
  }
  return cost;
}

/**
 * Countdown duration, same distance scaling as cost — this is the anti-abuse
 * mechanism that keeps relocation from being usable to instantly dodge an
 * oncoming horde (explicit design request).
 */
export function baseRelocationDurationMs(tweaks: Tweaks, distanceTiles: number): number {
  return distanceTiles * tweaks.base_relocation.seconds_per_tile_distance * 1000;
}

/** Timer runs even while offline, same virtual-clock-threshold pattern as isBaseUpgradeComplete. */
export function isBaseRelocationComplete(
  tweaks: Tweaks,
  relocation: BaseRelocationInProgress,
  distanceTiles: number,
  now: number,
): boolean {
  return now - relocation.startedAt >= baseRelocationDurationMs(tweaks, distanceTiles);
}
