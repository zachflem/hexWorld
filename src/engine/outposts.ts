import type { OutpostRecord } from "../data/outposts";
import type { DenRecord } from "../data/dens";
import type { Tweaks } from "../data/tweaksSchema";
import { formulaBCost } from "./formulas";

/**
 * Structurally identical to engine/base.ts's reinforcement formulas, but
 * reading a separate tweaks.outposts.reinforcement block (not shared with
 * tweaks.base_reinforcement) so outposts can be tuned weaker/cheaper
 * independently — an outpost is a real but more exposed foothold, not a
 * clone of the fortified main base.
 */
export function outpostReinforcementHp(tweaks: Tweaks, level: number): number {
  return tweaks.outposts.reinforcement.base_hp + tweaks.outposts.reinforcement.hp_gain_per_level * level;
}

/**
 * Ceiling for further handleUpgradeOutpostReinforcement investment ONLY —
 * capped by the player's one global base level, same as the main base's
 * reinforcement track. Deliberately NOT applied to the den-level-derived
 * starting grant createOutpostFromDen hands out (see its own doc comment).
 */
export function maxOutpostReinforcementLevel(baseLevel: number): number {
  return baseLevel;
}

export function outpostReinforcementUpgradeCost(tweaks: Tweaks, targetLevel: number) {
  const cost: Record<string, number> = {};
  for (const [res, amount] of Object.entries(tweaks.outposts.reinforcement.cost_base)) {
    cost[res] = formulaBCost(amount, targetLevel);
  }
  return cost;
}

/** Mirrors engine/base.ts:baseRepairCost — Formula B at the current reinforcement level, scaled by the fraction of HP actually missing. */
export function outpostRepairCost(tweaks: Tweaks, currentHp: number, maxHp: number, reinforcementLevel: number) {
  const missingFraction = Math.min(1, Math.max(0, (maxHp - currentHp) / maxHp));
  const cost: Record<string, number> = {};
  for (const [res, amount] of Object.entries(tweaks.outposts.reinforcement.cost_base)) {
    cost[res] = formulaBCost(amount, reinforcementLevel) * missingFraction;
  }
  return cost;
}

/**
 * A horde overrunning an outpost doesn't end the game (unlike the main
 * base) — it reverts to a plain hostile den instead, needing a fresh siege.
 * Punishment is one level below whatever den level it was originally
 * cleared from (floor 1): losing it is a real setback (the whole economy
 * built around it is gone), but re-clearing it isn't made harder than the
 * original siege was.
 */
export function revertOutpostToDen(outpost: OutpostRecord): DenRecord {
  return {
    id: outpost.id.replace(/^outpost-/, ""),
    coord: outpost.coord,
    level: Math.max(1, outpost.originalDenLevel - 1),
    siege: null,
  };
}
