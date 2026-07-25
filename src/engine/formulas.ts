import type { ResourceType } from "../data/resources";
import type { Tweaks } from "../data/tweaksSchema";

/**
 * A structure counts as functional (yields resources, defends, trains,
 * claims viewshed, contributes noise, ...) only once it's both been
 * reclaimed/repaired after horde capture (`damaged`) AND finished its
 * initial construction timer (`buildStartedAt`) — the exact same "present on
 * the tile but not doing anything yet" shape either way. Shared by every
 * engine function that used to gate on `damaged` alone; each of those sites
 * now checks this instead, so a not-yet-built structure behaves identically
 * to a damaged one everywhere that mattered before construction timers
 * existed. Deliberately NOT used by markCapturedStructuresDamaged
 * (engine/hordes.ts, unrelated to construction) or the damage-repair gate in
 * App.tsx:handleRepairStructure (checks `damaged` alone — a mid-construction
 * structure that gets horde-captured still needs repairing, not rebuilding).
 */
export function isStructureActive(structure: { damaged: boolean; buildStartedAt?: number | null }): boolean {
  return !structure.damaged && structure.buildStartedAt == null;
}

/**
 * Formula A — "Build Count Scaling" (TWEAKS.md).
 * Cost of the Nth structure of a kind: cost_1 = base, cost_n = cost_(n-1) * (1 + 0.1*(n-1)).
 */
export function formulaACost(baseCost: number, n: number): number {
  let cost = baseCost;
  for (let k = 2; k <= n; k++) {
    cost *= 1 + 0.1 * (k - 1);
  }
  return cost;
}

/** Scales every resource in a cost map by Formula A for the Nth structure of that kind. */
export function scaledCostMap(baseCostMap: Record<string, number>, n: number): Record<string, number> {
  const scaled: Record<string, number> = {};
  for (const [resource, base] of Object.entries(baseCostMap)) {
    scaled[resource] = formulaACost(base, n);
  }
  return scaled;
}

/**
 * Linear build-count scaling — walls only (TWEAKS.md). Same 10%-per-wall
 * growth rate as Formula A, but against the base cost each time rather than
 * compounding onto the previous wall's already-scaled cost, which let Formula
 * A's wall cost hit ~10x base by the 8th wall — directly at odds with
 * walls.slot_cost existing specifically to make dense wall lines viable.
 *   cost_n = base_cost * (1 + 0.1 * (n-1))
 */
export function linearBuildCost(baseCost: number, n: number): number {
  return baseCost * (1 + 0.1 * (n - 1));
}

/**
 * Formula B — "Tier Upgrade Scaling" (TWEAKS.md).
 * cost(target_level) = (base_cost * 0.5) * (1.0 + 0.1 * target_level)
 */
export function formulaBCost(baseCost: number, targetLevel: number): number {
  return baseCost * 0.5 * (1 + 0.1 * targetLevel);
}

/**
 * Total structures (of any kind) allowed to stand at once — DESIGN.md §9.
 * `baseLevel` is always 1 until base-level upgrades are implemented.
 */
export function buildSlotCap(tweaks: Tweaks, baseLevel: number): number {
  const { build_slot_cap_base, build_slot_cap_per_level } = tweaks.base_upgrades;
  return build_slot_cap_base + build_slot_cap_per_level * (baseLevel - 1);
}

/**
 * Total structures (of any kind) currently standing, counted against
 * buildSlotCap — DESIGN.md §9. Docks count too, despite being water-based —
 * same shared budget as every other structure. Walls and paths count at a
 * steep fractional discount (tweaks.jsonc walls.slot_cost/infrastructure_paths.slot_cost,
 * both 0.1 as of the 2026-07-20 balance pass) — everything else counts as a
 * full slot each, unchanged.
 */
export function totalStructureCount(
  tweaks: Tweaks,
  extractionTiles: unknown[],
  pathTiles: unknown[],
  towers: unknown[],
  walls: unknown[],
  barracksList: unknown[],
  docks: unknown[],
  powerStations: unknown[] = [],
): number {
  return (
    extractionTiles.length +
    pathTiles.length * tweaks.infrastructure_paths.slot_cost +
    towers.length +
    walls.length * tweaks.walls.slot_cost +
    barracksList.length +
    docks.length +
    powerStations.length
  );
}

/** Accumulates a newly-paid cost into a structure's running lifetime investment (for demolish refunds). */
export function addToInvestment(
  invested: Partial<Record<ResourceType, number>>,
  cost: Partial<Record<ResourceType, number>>,
): Partial<Record<ResourceType, number>> {
  const next = { ...invested };
  for (const [res, amount] of Object.entries(cost)) {
    const key = res as ResourceType;
    next[key] = (next[key] ?? 0) + (amount ?? 0);
  }
  return next;
}

/** Demolishing any structure returns a fixed percentage of everything ever spent on it — DESIGN.md §10. */
export function demolishRefund(
  tweaks: Tweaks,
  totalInvested: Partial<Record<ResourceType, number>>,
): Partial<Record<ResourceType, number>> {
  const refund: Partial<Record<ResourceType, number>> = {};
  for (const [res, amount] of Object.entries(totalInvested)) {
    refund[res as ResourceType] = (amount ?? 0) * (tweaks.demolish.refund_pct / 100);
  }
  return refund;
}

/**
 * Cost to repair a structure a horde captured (and the player has since
 * reclaimed) — a fixed percentage of its ORIGINAL build cost only, per
 * DESIGN.md §12 / TWEAKS.md ("50% of their original build cost"). Deliberately
 * based on `buildCost` (a one-time snapshot taken at construction, never
 * touched by later upgrades) rather than the cumulative `totalInvested` used
 * by demolishRefund above — a heavily-upgraded structure shouldn't cost more
 * to patch back up than a fresh one of the same kind did to build.
 */
export function repairCost(
  tweaks: Tweaks,
  buildCost: Partial<Record<ResourceType, number>>,
): Partial<Record<ResourceType, number>> {
  const pct = tweaks.horde.territory_disconnection.repair_cost_pct_of_original_build / 100;
  const cost: Partial<Record<ResourceType, number>> = {};
  for (const [res, amount] of Object.entries(buildCost)) {
    cost[res as ResourceType] = (amount ?? 0) * pct;
  }
  return cost;
}

/**
 * Flat repair duration for a horde-captured structure (extraction tile,
 * path, tower, wall, or barracks) — unlike wallRepairDurationMs's
 * missing-HP scaling, the `damaged` flag this clears is boolean, not
 * graded, so there's no severity to scale against.
 */
export function structureRepairDurationMs(tweaks: Tweaks): number {
  return tweaks.horde.territory_disconnection.repair_time_minutes * 60 * 1000;
}

/**
 * Generic "combat HP" for a structure with no combat stat of its own
 * (extraction tiles, path tiles, barracks — towers/walls keep their own,
 * separate damage/durability stats and don't use this) — DESIGN.md gives a
 * horde nothing to push through on those tiles today, which this closes:
 * every non-military structure still offers SOME resistance, proportional to
 * everything invested in it (tweaks.jsonc horde.structure_hp_per_invested_resource),
 * so heavier investment (including upgrades) makes it tougher without a
 * separate per-type formula table.
 */
export function structureHp(tweaks: Tweaks, totalInvested: Partial<Record<ResourceType, number>>): number {
  const invested = Object.values(totalInvested).reduce((sum: number, amount) => sum + (amount ?? 0), 0);
  return invested * tweaks.horde.structure_hp_per_invested_resource;
}
