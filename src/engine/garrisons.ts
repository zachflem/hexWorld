import type { DenAssaultsRecord } from "../data/denAssaults";
import type { ExpeditionsRecord } from "../data/expeditions";
import type { Garrison, GarrisonsRecord } from "../data/garrisons";
import type { GarrisonRecallsRecord } from "../data/garrisonRecalls";
import type { LabAssaultsRecord } from "../data/labAssaults";
import type { UnitsRecord } from "../data/units";
import type { Wall } from "../data/walls";
import type { Tweaks } from "../data/tweaksSchema";
import { isStructureActive } from "./formulas";
import { axialDistance, axialKey, type Axial } from "./hexCoords";

/** Total militia currently committed to any in-transit expedition (src/data/expeditions.ts) — mirrors garrisonedMilitiaTotal's shape for the other place committed militia are "reserved." */
function expeditionMilitiaTotal(expeditions: ExpeditionsRecord): number {
  return expeditions.reduce((sum, e) => sum + e.militiaCommitted, 0);
}

function expeditionJunkyardKnightTotal(expeditions: ExpeditionsRecord): number {
  return expeditions.reduce((sum, e) => sum + e.junkyardKnightCommitted, 0);
}

function expeditionCrossBowSniperTotal(expeditions: ExpeditionsRecord): number {
  return expeditions.reduce((sum, e) => sum + e.crossBowSniperCommitted, 0);
}

/** Same reasoning as expeditionMilitiaTotal, for units committed to an in-transit den assault (data/denAssaults.ts) — the two systems draw from, and reserve against, the same standing-army pool. */
function denAssaultMilitiaTotal(denAssaults: DenAssaultsRecord): number {
  return denAssaults.reduce((sum, a) => sum + a.militiaCommitted, 0);
}

function denAssaultJunkyardKnightTotal(denAssaults: DenAssaultsRecord): number {
  return denAssaults.reduce((sum, a) => sum + a.junkyardKnightCommitted, 0);
}

function denAssaultCrossBowSniperTotal(denAssaults: DenAssaultsRecord): number {
  return denAssaults.reduce((sum, a) => sum + a.crossBowSniperCommitted, 0);
}

/** Same reasoning as denAssaultMilitiaTotal, for units committed to an in-transit lab assault (data/labAssaults.ts). */
function labAssaultMilitiaTotal(labAssaults: LabAssaultsRecord): number {
  return labAssaults.reduce((sum, a) => sum + a.militiaCommitted, 0);
}

function labAssaultJunkyardKnightTotal(labAssaults: LabAssaultsRecord): number {
  return labAssaults.reduce((sum, a) => sum + a.junkyardKnightCommitted, 0);
}

function labAssaultCrossBowSniperTotal(labAssaults: LabAssaultsRecord): number {
  return labAssaults.reduce((sum, a) => sum + a.crossBowSniperCommitted, 0);
}

/** Same reasoning as expeditionMilitiaTotal, for units marching home after a recall (data/garrisonRecalls.ts) — pulled off their garrison tile immediately, but not back in the available pool until the recall's timer resolves. */
function garrisonRecallMilitiaTotal(garrisonRecalls: GarrisonRecallsRecord): number {
  return garrisonRecalls.reduce((sum, r) => sum + r.militiaCommitted, 0);
}

function garrisonRecallJunkyardKnightTotal(garrisonRecalls: GarrisonRecallsRecord): number {
  return garrisonRecalls.reduce((sum, r) => sum + r.junkyardKnightCommitted, 0);
}

function garrisonRecallCrossBowSniperTotal(garrisonRecalls: GarrisonRecallsRecord): number {
  return garrisonRecalls.reduce((sum, r) => sum + r.crossBowSniperCommitted, 0);
}

export function garrisonAt(garrisons: GarrisonsRecord, coord: Axial): Garrison | null {
  return garrisons.find((g) => axialKey(g.coord) === axialKey(coord)) ?? null;
}

/** Total militia currently stationed across every garrison. */
export function garrisonedMilitiaTotal(garrisons: GarrisonsRecord): number {
  return garrisons.reduce((sum, g) => sum + g.militiaCount, 0);
}

/** Total junkyard knights currently stationed across every garrison — barracks L2 unlock. */
export function garrisonedJunkyardKnightTotal(garrisons: GarrisonsRecord): number {
  return garrisons.reduce((sum, g) => sum + g.junkyardKnightCount, 0);
}

/** Total cross-bow snipers currently stationed across every garrison — barracks L3 unlock. */
export function garrisonedCrossBowSniperTotal(garrisons: GarrisonsRecord): number {
  return garrisons.reduce((sum, g) => sum + g.crossBowSniperCount, 0);
}

/**
 * Militia not currently stationed anywhere and not currently committed to an
 * in-transit expedition, den assault, or garrison recall — the only pool
 * other militia actions (garrisoning, dispatching a new expedition/assault)
 * can draw from. Garrisoned, expedition-committed, assault-committed, or
 * recalled-but-not-yet-home militia are reserved: they can't be in two
 * places at once, and (critically) two pending commitments can't
 * double-commit the same militia before either resolves.
 */
export function availableMilitia(
  units: UnitsRecord,
  garrisons: GarrisonsRecord,
  expeditions: ExpeditionsRecord,
  denAssaults: DenAssaultsRecord,
  garrisonRecalls: GarrisonRecallsRecord,
  labAssaults: LabAssaultsRecord,
): number {
  return Math.max(
    0,
    units.militiaCount -
      garrisonedMilitiaTotal(garrisons) -
      expeditionMilitiaTotal(expeditions) -
      denAssaultMilitiaTotal(denAssaults) -
      garrisonRecallMilitiaTotal(garrisonRecalls) -
      labAssaultMilitiaTotal(labAssaults),
  );
}

/** Same reasoning as availableMilitia, for junkyard knights. */
export function availableJunkyardKnights(
  units: UnitsRecord,
  garrisons: GarrisonsRecord,
  expeditions: ExpeditionsRecord,
  denAssaults: DenAssaultsRecord,
  garrisonRecalls: GarrisonRecallsRecord,
  labAssaults: LabAssaultsRecord,
): number {
  return Math.max(
    0,
    units.junkyardKnightCount -
      garrisonedJunkyardKnightTotal(garrisons) -
      expeditionJunkyardKnightTotal(expeditions) -
      denAssaultJunkyardKnightTotal(denAssaults) -
      garrisonRecallJunkyardKnightTotal(garrisonRecalls) -
      labAssaultJunkyardKnightTotal(labAssaults),
  );
}

/** Same reasoning as availableMilitia, for cross-bow snipers. */
export function availableCrossBowSnipers(
  units: UnitsRecord,
  garrisons: GarrisonsRecord,
  expeditions: ExpeditionsRecord,
  denAssaults: DenAssaultsRecord,
  garrisonRecalls: GarrisonRecallsRecord,
  labAssaults: LabAssaultsRecord,
): number {
  return Math.max(
    0,
    units.crossBowSniperCount -
      garrisonedCrossBowSniperTotal(garrisons) -
      expeditionCrossBowSniperTotal(expeditions) -
      denAssaultCrossBowSniperTotal(denAssaults) -
      garrisonRecallCrossBowSniperTotal(garrisonRecalls) -
      labAssaultCrossBowSniperTotal(labAssaults),
  );
}

/** Clamp UI-entered dispatch counts to what's actually free — mirrors handleGarrisonUnits's Math.min before commit. */
export function clampPartyDispatch(
  units: UnitsRecord,
  garrisons: GarrisonsRecord,
  expeditions: ExpeditionsRecord,
  denAssaults: DenAssaultsRecord,
  garrisonRecalls: GarrisonRecallsRecord,
  labAssaults: LabAssaultsRecord,
  militiaCommitted: number,
  junkyardKnightCommitted: number,
  crossBowSniperCommitted: number,
): { militiaCommitted: number; junkyardKnightCommitted: number; crossBowSniperCommitted: number } {
  return {
    militiaCommitted: Math.min(Math.max(0, Math.floor(militiaCommitted)), availableMilitia(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults)),
    junkyardKnightCommitted: Math.min(
      Math.max(0, Math.floor(junkyardKnightCommitted)),
      availableJunkyardKnights(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults),
    ),
    crossBowSniperCommitted: Math.min(
      Math.max(0, Math.floor(crossBowSniperCommitted)),
      availableCrossBowSnipers(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults),
    ),
  };
}

/** The defense a garrison contributes to its tile — stacks additively on top of any tower/wall there, and across all three garrisonable unit types. */
export function garrisonDefense(tweaks: Tweaks, garrisons: GarrisonsRecord, coord: Axial): number {
  const garrison = garrisonAt(garrisons, coord);
  if (!garrison) return 0;
  return (
    garrison.militiaCount * tweaks.units.militia.defense_per_unit +
    garrison.junkyardKnightCount * tweaks.units.junkyard_knight.defense_per_unit +
    garrison.crossBowSniperCount * tweaks.units.cross_bow_sniper.defense_per_unit
  );
}

/** Total attack power a garrison can bring to bear — used for both manual assaults and resolveGarrisonAutoAttacks (engine/hordes.ts). */
export function garrisonAttackPower(tweaks: Tweaks, garrison: Garrison): number {
  return (
    garrison.militiaCount * tweaks.units.militia.attack_per_unit +
    garrison.junkyardKnightCount * tweaks.units.junkyard_knight.attack_per_unit +
    garrison.crossBowSniperCount * tweaks.units.cross_bow_sniper.attack_per_unit
  );
}

/** tweaks.walls.garrison_range_bonus_tiles if an active wall (engine/formulas.ts:isStructureActive) sits at `coord`, else 0 — shared by isHordeReachableFromGarrison and engine/hordes.ts:sniperDamagePerSecond. */
export function garrisonWallRangeBonus(tweaks: Tweaks, walls: Wall[], coord: Axial): number {
  const wall = walls.find((w) => isStructureActive(w) && axialKey(w.coord) === axialKey(coord));
  return wall ? tweaks.walls.garrison_range_bonus_tiles : 0;
}

/** A garrison can only strike a horde standing on its own tile or a directly adjacent one — extended by garrisonWallRangeBonus when the garrison is stationed on an active wall. */
export function isHordeReachableFromGarrison(tweaks: Tweaks, walls: Wall[], garrisonCoord: Axial, hordeCoord: Axial): boolean {
  return axialDistance(garrisonCoord, hordeCoord) <= 1 + garrisonWallRangeBonus(tweaks, walls, garrisonCoord);
}

/**
 * A horde that captures a tile kills any garrison stationed there — same
 * "no luck, committed forces are gone on a loss" rule the rest of combat
 * follows (engine/hordes.ts:advanceHordes). Returns the survivors plus the
 * total lost per unit type, so the caller can also debit units.militiaCount/
 * junkyardKnightCount/crossBowSniperCount (a garrison's units still count
 * against the standing army totals).
 */
export function resolveCapturedGarrisons(
  garrisons: GarrisonsRecord,
  capturedTiles: Axial[],
): { garrisons: GarrisonsRecord; militiaLost: number; junkyardKnightLost: number; crossBowSniperLost: number } {
  const none = { garrisons, militiaLost: 0, junkyardKnightLost: 0, crossBowSniperLost: 0 };
  if (capturedTiles.length === 0 || garrisons.length === 0) return none;
  const capturedKeys = new Set(capturedTiles.map(axialKey));
  let militiaLost = 0;
  let junkyardKnightLost = 0;
  let crossBowSniperLost = 0;
  const survivors = garrisons.filter((g) => {
    if (!capturedKeys.has(axialKey(g.coord))) return true;
    militiaLost += g.militiaCount;
    junkyardKnightLost += g.junkyardKnightCount;
    crossBowSniperLost += g.crossBowSniperCount;
    return false;
  });
  return militiaLost > 0 || junkyardKnightLost > 0 || crossBowSniperLost > 0
    ? { garrisons: survivors, militiaLost, junkyardKnightLost, crossBowSniperLost }
    : none;
}
