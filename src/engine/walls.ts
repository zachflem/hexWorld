import type { ResourceType } from "../data/resources";
import type { Wall, WallTier } from "../data/walls";
import type { Tweaks } from "../data/tweaksSchema";
import { formulaBCost, linearBuildCost } from "./formulas";

export const WALL_TIER_ORDER: WallTier[] = ["wood", "rock", "steel"];
export const WALL_TIER_LEVEL: Record<WallTier, number> = { wood: 1, rock: 2, steel: 3 };

/** Never actually returns "wood" — it's only ever the starting tier, not a reachable upgrade target. */
export function nextWallTier(tier: WallTier): Exclude<WallTier, "wood"> | null {
  const index = WALL_TIER_ORDER.indexOf(tier);
  return index < WALL_TIER_ORDER.length - 1 ? (WALL_TIER_ORDER[index + 1] as Exclude<WallTier, "wood">) : null;
}

export function wallBuildCost(tweaks: Tweaks, n: number): Record<string, number> {
  const cost: Record<string, number> = {};
  for (const [res, amount] of Object.entries(tweaks.walls.build_cost_base)) {
    cost[res] = linearBuildCost(amount, n);
  }
  return cost;
}

/** Flat construction duration for a freshly-built (always wood tier) wall — tweaks.jsonc walls.build_time_minutes. */
export function wallBuildDurationMs(tweaks: Tweaks): number {
  return tweaks.walls.build_time_minutes * 60_000;
}

/**
 * TWEAKS.md explicitly flags durability_hits_to_break as "descriptive
 * reference, not the live combat number." Resolved by deriving an actual HP
 * pool from existing data: maxDurability = hits_to_break * that tier's own
 * damage_taken_base_per_tier — "this many ticks of a horde hitting for its
 * own base damage would break it." First pass, untested.
 */
export function maxWallDurability(tweaks: Tweaks, tier: WallTier): number {
  return tweaks.walls.durability_hits_to_break[tier] * tweaks.walls.damage_taken_base_per_tier[tier];
}

export function wallDamagePerTick(tweaks: Tweaks, tier: WallTier, hordeSize: number): number {
  return tweaks.walls.damage_taken_base_per_tier[tier] * (hordeSize / 100);
}

const WALL_UPGRADE_PROGRESSION_KEY: Record<string, keyof Tweaks["walls"]["tier_upgrade_tech_progression"]> = {
  rock: "wood_to_rock",
  steel: "rock_to_steel",
};

/**
 * Cost to upgrade a wall to `targetTier`. tier_upgrade_cost_base only defines
 * wood, but the tech progression adds stone (wood->rock) and steel
 * (rock->steel) with no base amount of their own — resolved the same way as
 * every other tech-progression gap in this project: reuse that resource's
 * own extraction-tile upgrade base as the baseline.
 */
export function wallUpgradeCost(
  tweaks: Tweaks,
  targetTier: Exclude<WallTier, "wood">,
): Partial<Record<ResourceType, number>> {
  const targetLevel = WALL_TIER_LEVEL[targetTier];
  const chain = tweaks.walls.tier_upgrade_tech_progression[WALL_UPGRADE_PROGRESSION_KEY[targetTier]];

  const cost: Partial<Record<ResourceType, number>> = {};
  for (const resource of chain) {
    const key = resource as ResourceType;
    const baseAmount = tweaks.walls.tier_upgrade_cost_base[key] ?? tweaks.extraction_tiles[key].tier_upgrade_cost_base[key];
    cost[key] = (cost[key] ?? 0) + formulaBCost(baseAmount, targetLevel);
  }
  return cost;
}

/** wallUpgradeDurationMs(targetTier) = tier_upgrade_time_minutes_base * target_level — tweaks.jsonc walls. */
export function wallUpgradeDurationMs(tweaks: Tweaks, targetTier: Exclude<WallTier, "wood">): number {
  const targetLevel = WALL_TIER_LEVEL[targetTier];
  return tweaks.walls.tier_upgrade_time_minutes_base * targetLevel * 60_000;
}

/**
 * Repair cost is proportional to missing HP, using the wall's own cumulative
 * lifetime spend — TWEAKS.md: "includes resources of ALL tiers up to
 * current," which totalInvested already represents by construction.
 */
export function wallRepairCost(wall: Wall, maxDurability: number): Partial<Record<ResourceType, number>> {
  const missingFraction = Math.max(0, Math.min(1, (maxDurability - wall.durability) / maxDurability));
  const cost: Partial<Record<ResourceType, number>> = {};
  for (const [res, amount] of Object.entries(wall.totalInvested)) {
    cost[res as ResourceType] = (amount ?? 0) * missingFraction;
  }
  return cost;
}

/** Repair duration scales with severity, mirroring wallRepairCost — tweaks.jsonc walls.repair.seconds_per_missing_hp. */
export function wallRepairDurationMs(tweaks: Tweaks, wall: Wall, maxDurability: number): number {
  const missingHp = Math.max(0, maxDurability - wall.durability);
  return missingHp * tweaks.walls.repair.seconds_per_missing_hp * 1000;
}
