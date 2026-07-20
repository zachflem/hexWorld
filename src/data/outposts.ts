import type { Axial } from "../engine/hexCoords";
import { outpostReinforcementHp } from "../engine/outposts";
import type { DenRecord } from "./dens";
import type { Tweaks } from "./tweaksSchema";

/**
 * A second economic foothold the player establishes by clearing a zombie
 * den's siege (engine/dens.ts:resolveHoldPeriod's "converted" outcome) and
 * its own upgradeable reinforcement HP. Its connected extraction tiles feed
 * the player's single shared resource pool exactly like the base's do
 * (engine/tick.ts:accrueResources) — an outpost isn't a separate economy,
 * just another entry point into the same one. Unlike the main base, a horde
 * depleting it doesn't end the game — it reverts to a hostile den instead
 * (engine/outposts.ts:revertOutpostToDen) and must be re-sieged. Structures
 * built on an outpost's own claimed territory still share the player's one
 * global base level as their upgrade ceiling — an outpost doesn't get
 * independent level progression, only its own HP.
 */
export interface OutpostRecord {
  id: string;
  coord: Axial;
  reinforcementLevel: number;
  currentHp: number;
  convertedAt: number;
  /** The den's own level at the moment it was cleared — revertOutpostToDen's punishment is derived from this, not from whatever (unchanging) level the den happened to have. */
  originalDenLevel: number;
}

export type OutpostsRecord = OutpostRecord[];

export const OUTPOSTS_DB_KEY = "outposts";

/**
 * Starting HP scales with the den's own level, not a flat baseline — the
 * tougher the den cleared, the stronger an outpost handed over, as a reward
 * for the conquest. Deliberately NOT capped by maxOutpostReinforcementLevel
 * (engine/outposts.ts) — that cap only gates further upgrades, so a
 * high-level den can hand a low-base-level player an outpost stronger than
 * their base level would otherwise let them build.
 */
export function createOutpostFromDen(tweaks: Tweaks, den: DenRecord, virtualNow: number): OutpostRecord {
  const reinforcementLevel = Math.max(0, den.level - 1);
  return {
    id: `outpost-${den.id}`,
    coord: den.coord,
    reinforcementLevel,
    currentHp: outpostReinforcementHp(tweaks, reinforcementLevel),
    convertedAt: virtualNow,
    originalDenLevel: den.level,
  };
}
