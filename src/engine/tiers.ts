import type { ExtractionTier } from "../data/extractionTiles";
import type { ResourceType } from "../data/resources";
import type { Tweaks } from "../data/tweaksSchema";
import { formulaBCost } from "./formulas";

export const TIER_ORDER: ExtractionTier[] = ["small", "mid", "large"];

/** 1-based, matching Formula B's "target_level" semantics (as used by towers' L1-L4). */
const TIER_LEVEL: Record<ExtractionTier, number> = { small: 1, mid: 2, large: 3 };

export function nextTier(tier: ExtractionTier): ExtractionTier | null {
  const index = TIER_ORDER.indexOf(tier);
  return index < TIER_ORDER.length - 1 ? TIER_ORDER[index + 1] : null;
}

/** yield(tier) = small_yield * tier_multiplier^tier_index (small=0, mid=1, large=2). */
export function tierYieldMultiplier(tweaks: Tweaks, tier: ExtractionTier): number {
  const tierIndex = TIER_ORDER.indexOf(tier);
  return tweaks.extraction_tiles.yield_scaling.tier_multiplier ** tierIndex;
}

/**
 * Cost to upgrade an extraction tile to `targetTier`, combining Formula B with
 * the tech-progression resource chain (TWEAKS.md's "Technology Progression").
 *
 * tweaks.jsonc only defines a single base cost per resource's own tile (e.g.
 * food's is wood-only) — when the tech progression adds another resource
 * (e.g. "stone" for a mid->large upgrade), there's no separate base amount
 * specified anywhere for that add-on. Resolved here by reusing that other
 * resource's *own* tier_upgrade_cost_base as the baseline for its
 * contribution — reuses existing numbers rather than inventing new ones,
 * first-pass/untested like the rest of the tuning file.
 */
export function tierUpgradeCost(
  tweaks: Tweaks,
  resource: ResourceType,
  targetTier: ExtractionTier,
): Partial<Record<ResourceType, number>> {
  const targetLevel = TIER_LEVEL[targetTier];
  const progressionKey = targetTier === "mid" ? "small_to_mid" : "mid_to_large";
  const chain = tweaks.extraction_tiles.tech_progression[progressionKey];

  const cost: Partial<Record<ResourceType, number>> = {};
  for (const step of chain) {
    const sourceResource = step === "base_resource" ? resource : (step as ResourceType);
    const baseCostMap = tweaks.extraction_tiles[sourceResource].tier_upgrade_cost_base;
    for (const [res, amount] of Object.entries(baseCostMap)) {
      const key = res as ResourceType;
      cost[key] = (cost[key] ?? 0) + formulaBCost(amount, targetLevel);
    }
  }
  return cost;
}

/** tierUpgradeDurationMs(targetTier) = tier_upgrade_time_minutes_base * target_level — tweaks.jsonc extraction_tiles. */
export function tierUpgradeDurationMs(tweaks: Tweaks, targetTier: ExtractionTier): number {
  const targetLevel = TIER_LEVEL[targetTier];
  return tweaks.extraction_tiles.tier_upgrade_time_minutes_base * targetLevel * 60_000;
}
