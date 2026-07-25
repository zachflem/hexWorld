import type { DenRecord, DenSiegeState } from "../data/dens";
import type { GarrisonsRecord } from "../data/garrisons";
import type { Tower } from "../data/towers";
import type { Tweaks } from "../data/tweaksSchema";
import type { Wall } from "../data/walls";
import { garrisonDefense } from "./garrisons";
import { isStructureActive } from "./formulas";
import { axialKey, axialNeighbors, type Axial } from "./hexCoords";
import { resolveHordeTileFight, towersInRange } from "./hordes";
import { towerDamage } from "./towers";

/** A den's one-shot defense value against an assault — same deterministic, no-luck shape as every other combat resolution (DESIGN.md §10). */
export function denDefense(tweaks: Tweaks, level: number): number {
  const { den_defense_base, den_defense_per_level } = tweaks.dens.siege;
  return den_defense_base + den_defense_per_level * (level - 1);
}

/**
 * The den-assault equivalent of stepCorridorWalk's final tile fight —
 * checked separately from the corridor walk leading up to the den (see
 * App.tsx's den-assault resolution), since a den isn't an ordinary map tile
 * and uses its own defense formula (denDefense above), not tileDefense.
 * Win starts the hold period (DenSiegeState, zeroed); loss leaves the den
 * untouched (App.tsx debits the committed party, same as a lost expedition).
 */
export function resolveDenAssault(
  tweaks: Tweaks,
  den: DenRecord,
  attackPower: number,
  virtualNow: number,
): { den: DenRecord; won: boolean } {
  if (!resolveHordeTileFight(attackPower, denDefense(tweaks, den.level))) {
    return { den, won: false };
  }
  const siege: DenSiegeState = { startedAt: virtualNow, lastWaveAt: virtualNow, waveIndex: 0 };
  return { den: { ...den, siege }, won: true };
}

/**
 * Troops that make it through a WON den assault and immediately garrison the
 * den (App.tsx merges these straight into a garrison there, instead of the
 * whole party "returning home" the way a regular expedition's committed
 * party does — a den assault is the one fight in this game with attrition
 * rather than an all-or-nothing outcome). The den's own defense is
 * subtracted from the party's total attack power, and whatever attack-power
 * fraction survives is applied uniformly across every committed unit type,
 * floored to a whole troop count — still deterministic, no RNG (DESIGN.md
 * §10's house rule), just a proportional loss here instead of a binary one.
 * Only meaningful once resolveDenAssault has already confirmed
 * attackPower >= defense (a loss wipes the whole party, unchanged), so the
 * survival fraction is always in [0, 1) — an exact-margin win
 * (attackPower === defense) deliberately leaves 0 survivors, rewarding
 * overcommitting rather than cutting it close.
 */
export function denAssaultSurvivors(
  attackPower: number,
  defense: number,
  militiaCommitted: number,
  junkyardKnightCommitted: number,
  crossBowSniperCommitted: number,
): { militia: number; junkyardKnight: number; crossBowSniper: number } {
  const survivalFraction = attackPower > 0 ? Math.max(0, (attackPower - defense) / attackPower) : 0;
  return {
    militia: Math.floor(militiaCommitted * survivalFraction),
    junkyardKnight: Math.floor(junkyardKnightCommitted * survivalFraction),
    crossBowSniper: Math.floor(crossBowSniperCommitted * survivalFraction),
  };
}

/**
 * What's currently defending a den's core during its hold period — the
 * player's answer to "build towers/walls/garrison here to survive the
 * siege." A garrison stationed directly on the den's own coord (owned the
 * moment the assault succeeds, engine/dens.ts is not itself responsible for
 * that claim — see App.tsx) stacks with every active tower whose range
 * reaches the den (towersInRange, same reach a tower defends/claims with
 * elsewhere) and every active wall (engine/formulas.ts:isStructureActive)
 * built on one of the den's immediate neighbors — the den's own coord can't
 * host a structure directly (mirrors
 * the main base tile's exclusion), so walls necessarily ring it rather than
 * sit on it.
 */
export function holdDefenseAt(
  tweaks: Tweaks,
  coord: Axial,
  towers: Tower[],
  walls: Wall[],
  garrisons: GarrisonsRecord,
  seed: number,
): number {
  const towerTotal = towersInRange(tweaks, towers, coord, seed).reduce((sum, t) => sum + towerDamage(tweaks, t.level), 0);
  const neighborKeys = new Set(axialNeighbors(coord).map(axialKey));
  const wallTotal = walls.reduce(
    (sum, w) => (isStructureActive(w) && neighborKeys.has(axialKey(w.coord)) ? sum + w.durability : sum),
    0,
  );
  return garrisonDefense(tweaks, garrisons, coord) + towerTotal + wallTotal;
}

/**
 * A last-stand wave's attack size — weaker than a full noise-scaled horde
 * (DESIGN.md §12's "weaker last-stand defenders": this is the den's own
 * dying effort, not another horde), escalating each wave so a static
 * set-and-forget defense isn't enough to coast through the whole hold.
 */
export function lastStandWaveSize(tweaks: Tweaks, denLevel: number, waveIndex: number): number {
  const { wave_base, wave_per_level, wave_escalation_per_wave, wave_cap } = tweaks.dens.siege;
  return Math.min(wave_cap, wave_base + wave_per_level * (denLevel - 1) + wave_escalation_per_wave * waveIndex);
}

/**
 * Advances a besieged den by one tick. Three outcomes, checked in order:
 *  - the hold duration has fully elapsed with no successful wave against it
 *    -> "converted" (App.tsx hands this off to createOutpostFromDen);
 *  - a wave interval has elapsed since the last wave -> roll it against the
 *    current holdDefenseAt: repelled keeps the siege going (escalate
 *    waveIndex), beaten -> "failed" (siege collapses, den reverts to
 *    hostile at its own unchanged level — App.tsx also wipes any garrison
 *    stationed at the den's coord, same "committed forces lost on a loss"
 *    rule as everywhere else);
 *  - otherwise nothing changed yet this tick -> "ongoing".
 * Deterministic, no RNG — same house rule as every other fight in this game.
 */
export function resolveHoldPeriod(
  tweaks: Tweaks,
  den: DenRecord,
  holdDefense: number,
  virtualNow: number,
): { den: DenRecord; outcome: "ongoing" | "failed" | "converted" } {
  const siege = den.siege;
  if (!siege) return { den, outcome: "ongoing" };

  const holdDurationMs = tweaks.dens.siege.hold_duration_minutes * 60_000;
  if (virtualNow - siege.startedAt >= holdDurationMs) {
    return { den, outcome: "converted" };
  }

  const waveIntervalMs = tweaks.dens.siege.wave_interval_minutes * 60_000;
  if (virtualNow - siege.lastWaveAt < waveIntervalMs) {
    return { den, outcome: "ongoing" };
  }

  const waveSize = lastStandWaveSize(tweaks, den.level, siege.waveIndex);
  if (resolveHordeTileFight(waveSize, holdDefense)) {
    return { den: { ...den, siege: null }, outcome: "failed" };
  }

  const nextSiege: DenSiegeState = { ...siege, waveIndex: siege.waveIndex + 1, lastWaveAt: virtualNow };
  return { den: { ...den, siege: nextSiege }, outcome: "ongoing" };
}
