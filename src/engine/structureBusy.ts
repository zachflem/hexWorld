/**
 * Shared "one timed task at a time" checks for per-tile structures.
 * Import these in both App.tsx handlers and GameScreen *OptionFor helpers
 * so UI and engine stay in sync. Base hub uses isBaseHubBusy (engine/base.ts);
 * garrison/recall/collect are deliberately not gated here.
 */

export const STRUCTURE_BUSY_REASON = "Already busy with another task";
export const BASE_HUB_BUSY_REASON = "Base is busy with another task";

export type LandStructureFields = {
  buildStartedAt?: number | null;
  upgrade?: unknown | null;
  damageRepair?: { startedAt: number } | null;
};

/** Extraction tile, path, tower — build, tier upgrade, or horde repair. */
export function isLandStructureBusy(structure: LandStructureFields): boolean {
  return structure.buildStartedAt != null || structure.upgrade != null || structure.damageRepair != null;
}

export type WallFields = LandStructureFields & {
  action?: unknown | null;
};

/** Wall — build, durability upgrade/repair (action slot), or horde repair. */
export function isWallBusy(wall: WallFields): boolean {
  return wall.buildStartedAt != null || wall.action != null || wall.damageRepair != null;
}

export type DockFields = {
  buildStartedAt?: number | null;
  fishingBoatUpgrade?: unknown | null;
};

/** Dock — initial build or fishing-boat construction. */
export function isDockBusy(dock: DockFields): boolean {
  return dock.buildStartedAt != null || dock.fishingBoatUpgrade != null;
}

export type BarracksFields = LandStructureFields & {
  trainingQueue?: unknown | null;
};

/** Barracks — land-structure tasks plus one training queue. */
export function isBarracksBusy(barracks: BarracksFields): boolean {
  return isLandStructureBusy(barracks) || barracks.trainingQueue != null;
}

export type OutpostReinforcementFields = {
  reinforcementAction?: unknown | null;
};

export function isOutpostReinforcementBusy(outpost: OutpostReinforcementFields): boolean {
  return outpost.reinforcementAction != null;
}

/** Horde-capture repair on any land structure (wall uses action slot instead of upgrade). */
export function isHordeRepairBlocked(
  structure: LandStructureFields & { action?: unknown | null },
): boolean {
  if (structure.action != null) return true;
  return isLandStructureBusy(structure);
}
