import type { TrainingQueue, UnitsRecord } from "../data/units";
import type { Tweaks } from "../data/tweaksSchema";

export function scoutTrainCost(tweaks: Tweaks): Record<string, number> {
  return tweaks.units.scout.train_cost;
}

export function militiaTrainCost(tweaks: Tweaks): Record<string, number> {
  return tweaks.units.militia.train_cost;
}

export function junkyardKnightTrainCost(tweaks: Tweaks): Record<string, number> {
  return tweaks.units.junkyard_knight.train_cost;
}

export function crossBowSniperTrainCost(tweaks: Tweaks): Record<string, number> {
  return tweaks.units.cross_bow_sniper.train_cost;
}

/**
 * More (non-damaged) barracks means more training capacity, not just more
 * standing-army capacity — 2 L1 barracks train at 2x the pace of 1, scaling
 * the per-unit duration down rather than giving each barracks its own
 * separate queue (the simpler of the two options discussed, and
 * `units.scoutQueue`/`militiaQueue` staying singular — one shared,
 * player-wide queue — matches how capacity already pools across barracks,
 * TWEAKS.md). `trainingCapacity` (engine/barracks.ts:barracksTrainingCapacity)
 * is a level-weighted sum, not a raw barracks count, so a higher-level
 * barracks also trains faster on its own — a lone L4 barracks matches the
 * throughput of 4 L1s. Floored at 1 so a momentarily-barracks-less state
 * (e.g. mid-demolish) can't divide by zero or speed training up.
 */
export function scoutTrainDurationMs(tweaks: Tweaks, trainingCapacity: number): number {
  return (tweaks.units.scout.train_time_seconds * 1000) / Math.max(1, trainingCapacity);
}

export function militiaTrainDurationMs(tweaks: Tweaks, trainingCapacity: number): number {
  return (tweaks.units.militia.train_time_seconds * 1000) / Math.max(1, trainingCapacity);
}

export function junkyardKnightTrainDurationMs(tweaks: Tweaks, trainingCapacity: number): number {
  return (tweaks.units.junkyard_knight.train_time_seconds * 1000) / Math.max(1, trainingCapacity);
}

export function crossBowSniperTrainDurationMs(tweaks: Tweaks, trainingCapacity: number): number {
  return (tweaks.units.cross_bow_sniper.train_time_seconds * 1000) / Math.max(1, trainingCapacity);
}

/**
 * Closed-form trickle delivery: given how much time has passed, work out how
 * many whole units have completed and roll the queue's clock forward by
 * exactly that many durations (not reset to `now`) so partial progress
 * toward the next unit survives. Correct across an arbitrarily long offline
 * gap in one calculation, the same way engine/hordes.ts's advanceHordes
 * resolves multi-tile movement rather than simulating tick by tick.
 */
export function resolveTrainingQueue(
  queue: TrainingQueue | null,
  perUnitDurationMs: number,
  now: number,
): { queue: TrainingQueue | null; delivered: number } {
  if (!queue) return { queue: null, delivered: 0 };

  const wholeUnits = Math.floor((now - queue.currentUnitStartedAt) / perUnitDurationMs);
  const delivered = Math.max(0, Math.min(wholeUnits, queue.remaining));
  if (delivered <= 0) return { queue, delivered: 0 };

  const remaining = queue.remaining - delivered;
  if (remaining <= 0) return { queue: null, delivered };

  return {
    queue: { remaining, currentUnitStartedAt: queue.currentUnitStartedAt + delivered * perUnitDurationMs },
    delivered,
  };
}

export function militiaAttackPower(tweaks: Tweaks, militiaCount: number): number {
  return militiaCount * tweaks.units.militia.attack_per_unit;
}

export function militiaDefensePower(tweaks: Tweaks, militiaCount: number): number {
  return militiaCount * tweaks.units.militia.defense_per_unit;
}

export function junkyardKnightAttackPower(tweaks: Tweaks, count: number): number {
  return count * tweaks.units.junkyard_knight.attack_per_unit;
}

export function junkyardKnightDefensePower(tweaks: Tweaks, count: number): number {
  return count * tweaks.units.junkyard_knight.defense_per_unit;
}

export function crossBowSniperAttackPower(tweaks: Tweaks, count: number): number {
  return count * tweaks.units.cross_bow_sniper.attack_per_unit;
}

export function crossBowSniperDefensePower(tweaks: Tweaks, count: number): number {
  return count * tweaks.units.cross_bow_sniper.defense_per_unit;
}

function totalUpkeepPerSecond(tweaks: Tweaks, units: UnitsRecord): number {
  const scoutPerMin = units.scoutStockpile * tweaks.units.scout.upkeep_food_per_min;
  const militiaPerMin = units.militiaCount * tweaks.units.militia.upkeep_food_per_min;
  const junkyardKnightPerMin = units.junkyardKnightCount * tweaks.units.junkyard_knight.upkeep_food_per_min;
  const crossBowSniperPerMin = units.crossBowSniperCount * tweaks.units.cross_bow_sniper.upkeep_food_per_min;
  return (scoutPerMin + militiaPerMin + junkyardKnightPerMin + crossBowSniperPerMin) / 60;
}

/**
 * Advances food upkeep for stockpiled scouts and every standing unit type by
 * `elapsedSeconds`. If food can't cover the full upkeep, food is clamped at 0
 * and exactly one unit deserts — cheapest/most-replaceable first (militia,
 * then junkyard knight, then cross-bow sniper, then finally a scout, since
 * scouts are the rarer/costlier investment to lose) — a simple first-pass
 * penalty, not proportional to the shortfall size.
 */
export function applyUpkeepTick(
  tweaks: Tweaks,
  units: UnitsRecord,
  food: number,
  elapsedSeconds: number,
): { food: number; units: UnitsRecord } {
  if (elapsedSeconds <= 0) return { food, units };

  const upkeep = totalUpkeepPerSecond(tweaks, units) * elapsedSeconds;
  if (food >= upkeep) {
    return { food: food - upkeep, units };
  }

  const nextUnits = { ...units };
  if (nextUnits.militiaCount > 0) {
    nextUnits.militiaCount -= 1;
  } else if (nextUnits.junkyardKnightCount > 0) {
    nextUnits.junkyardKnightCount -= 1;
  } else if (nextUnits.crossBowSniperCount > 0) {
    nextUnits.crossBowSniperCount -= 1;
  } else if (nextUnits.scoutStockpile > 0) {
    nextUnits.scoutStockpile -= 1;
  }
  return { food: 0, units: nextUnits };
}
