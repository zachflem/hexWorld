import type { Axial } from "../engine/hexCoords";
import type { Tweaks } from "./tweaksSchema";

export interface BaseUpgradeInProgress {
  targetLevel: number;
  /** ms since epoch — completion is checked against this, so the timer survives being offline. */
  startedAt: number;
}

/** Base level 3+ only (tweaks.jsonc base_relocation.min_base_level) — engine/base.ts:canRelocateBase. */
export interface BaseRelocationInProgress {
  destination: Axial;
  /** ms since epoch — completion is checked against this, so the timer survives being offline, same as BaseUpgradeInProgress. */
  startedAt: number;
}

/**
 * Single in-progress slot for the reinforcement track — mirrors data/walls.ts's
 * WallActionInProgress (upgrade and repair share one slot, so only one can run
 * at a time, and a repair mid-upgrade or vice versa is simply blocked).
 */
export type BaseReinforcementAction =
  | { kind: "upgrade"; targetLevel: number; startedAt: number }
  | { kind: "repair"; startedAt: number };

export interface BaseRecord {
  level: number;
  upgrade: BaseUpgradeInProgress | null;
  /** Base reinforcement track (DESIGN.md §9) — separate from base level, capped by it. 0 = no investment yet, just the flat baseline HP. */
  reinforcementLevel: number;
  /**
   * Persistent HP the base has left, out of engine/base.ts:baseReinforcementHp
   * (the max for the current reinforcementLevel). A horde that fails to
   * overrun the base still costs it HP equal to its own size
   * (engine/hordes.ts:advanceHordes) — repaired via engine/base.ts:baseRepairCost,
   * or fully restored whenever reinforcement is upgraded.
   */
  currentHp: number;
  /** Set once a reinforcement upgrade or repair has been paid for but hasn't completed yet. */
  reinforcementAction: BaseReinforcementAction | null;
  relocation: BaseRelocationInProgress | null;
}

export const BASE_DB_KEY = "base";

export function initialBase(tweaks: Tweaks): BaseRecord {
  return {
    level: 1,
    upgrade: null,
    reinforcementLevel: 0,
    currentHp: tweaks.base_reinforcement.base_hp,
    reinforcementAction: null,
    relocation: null,
  };
}
