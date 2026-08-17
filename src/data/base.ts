import type { Axial } from "../engine/hexCoords";
import type { Tweaks } from "./tweaksSchema";

/** Base level 3+ only (tweaks.jsonc base_relocation.min_base_level) — engine/base.ts:canRelocateBase. */
export interface BaseRelocationInProgress {
  destination: Axial;
  /** ms since epoch — completion is checked against this, so the timer survives being offline, same as BaseUpgradeInProgress. */
  startedAt: number;
}

/**
 * Single in-progress slot for every timed base action except relocation —
 * mirrors data/walls.ts's WallActionInProgress (level upgrade, reinforcement
 * upgrade, and reinforcement repair are mutually exclusive).
 */
export type BaseActionInProgress =
  | { kind: "level_upgrade"; targetLevel: number; startedAt: number }
  | { kind: "reinforcement_upgrade"; targetLevel: number; startedAt: number }
  | { kind: "reinforcement_repair"; startedAt: number };

/** @deprecated Legacy shape — migrated to BaseActionInProgress on load. */
export interface BaseUpgradeInProgress {
  targetLevel: number;
  startedAt: number;
}

/** @deprecated Legacy shape — migrated to BaseActionInProgress on load. */
export type BaseReinforcementAction =
  | { kind: "upgrade"; targetLevel: number; startedAt: number }
  | { kind: "repair"; startedAt: number };

export interface BaseRecord {
  level: number;
  action: BaseActionInProgress | null;
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
    action: null,
    reinforcementLevel: 0,
    currentHp: tweaks.base_reinforcement.base_hp,
    relocation: null,
  };
}
