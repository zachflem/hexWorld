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
  relocation: BaseRelocationInProgress | null;
}

export const BASE_DB_KEY = "base";

export function initialBase(tweaks: Tweaks): BaseRecord {
  return {
    level: 1,
    upgrade: null,
    reinforcementLevel: 0,
    currentHp: tweaks.base_reinforcement.base_hp,
    relocation: null,
  };
}
