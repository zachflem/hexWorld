/**
 * Shared timed-task slot checks for per-tile structures.
 * Import these in both App.tsx handlers and GameScreen *OptionFor helpers
 * so UI and engine stay in sync. Base hub uses countBaseHubTasks /
 * isBaseHubAtTaskCap (engine/base.ts); garrison/recall/collect are not gated.
 */

import type { BaseRecord } from "../data/base";
import type { ResearchRecord } from "../data/research";
import type { StorageUpgradesRecord } from "../data/storageUpgrades";
import { countPendingStorageUpgrades } from "../data/storageUpgrades";
import { structureTaskSlotCap } from "./research";

export const STRUCTURE_BUSY_REASON = "Already busy with another task";
export const BASE_HUB_BUSY_REASON = "Base is busy with another task";

export type LandStructureFields = {
  buildStartedAt?: number | null;
  upgrade?: unknown | null;
  damageRepair?: { startedAt: number } | null;
};

export function countLandStructureTasks(structure: LandStructureFields): number {
  let count = 0;
  if (structure.buildStartedAt != null) count++;
  if (structure.upgrade != null) count++;
  if (structure.damageRepair != null) count++;
  return count;
}

/** Extraction tile, path, tower — build, tier upgrade, or horde repair. */
export function isLandStructureAtTaskCap(structure: LandStructureFields, research: ResearchRecord): boolean {
  return countLandStructureTasks(structure) >= structureTaskSlotCap(research);
}

/** @deprecated Prefer isLandStructureAtTaskCap — kept for tests migrating to slot counts. */
export function isLandStructureBusy(structure: LandStructureFields): boolean {
  return countLandStructureTasks(structure) >= 1;
}

export type WallFields = LandStructureFields & {
  action?: unknown | null;
};

export function countWallTasks(wall: WallFields): number {
  let count = 0;
  if (wall.buildStartedAt != null) count++;
  if (wall.action != null) count++;
  if (wall.damageRepair != null) count++;
  return count;
}

/** Wall — build, durability upgrade/repair (action slot), or horde repair. */
export function isWallAtTaskCap(wall: WallFields, research: ResearchRecord): boolean {
  return countWallTasks(wall) >= structureTaskSlotCap(research);
}

export function isWallBusy(wall: WallFields): boolean {
  return countWallTasks(wall) >= 1;
}

export type DockFields = {
  buildStartedAt?: number | null;
  upgrade?: unknown | null;
  /** @deprecated Legacy — counts toward the busy slot until migrated to `upgrade`. */
  fishingBoatUpgrade?: unknown | null;
};

export function countDockTasks(dock: DockFields): number {
  let count = 0;
  if (dock.buildStartedAt != null) count++;
  if (dock.upgrade != null) count++;
  if (dock.fishingBoatUpgrade != null) count++;
  return count;
}

export function isDockAtTaskCap(dock: DockFields, research: ResearchRecord): boolean {
  return countDockTasks(dock) >= structureTaskSlotCap(research);
}

export function isDockBusy(dock: DockFields): boolean {
  return countDockTasks(dock) >= 1;
}

export type BarracksFields = LandStructureFields & {
  trainingQueue?: unknown | null;
};

export function countBarracksTasks(barracks: BarracksFields): number {
  return countLandStructureTasks(barracks) + (barracks.trainingQueue != null ? 1 : 0);
}

export function isBarracksAtTaskCap(barracks: BarracksFields, research: ResearchRecord): boolean {
  return countBarracksTasks(barracks) >= structureTaskSlotCap(research);
}

export function isBarracksBusy(barracks: BarracksFields): boolean {
  return countBarracksTasks(barracks) >= 1;
}

export type OutpostReinforcementFields = {
  reinforcementAction?: unknown | null;
};

export function isOutpostReinforcementBusy(outpost: OutpostReinforcementFields): boolean {
  return outpost.reinforcementAction != null;
}

/** Horde-capture repair — blocked only while a horde-damage repair timer is already running. */
export function isHordeRepairBlocked(structure: LandStructureFields & { damaged: boolean }): boolean {
  return structure.damageRepair != null;
}

/** Any in-flight timer on a tile — demolish stays blocked while work is ongoing. */
export function hasAnyStructureTask(
  structure: LandStructureFields & { action?: unknown | null; trainingQueue?: unknown | null },
): boolean {
  if (structure.action != null) return true;
  if (structure.trainingQueue != null) return true;
  return countLandStructureTasks(structure) > 0;
}

export function countBaseHubTasks(base: BaseRecord, storageUpgrades: StorageUpgradesRecord): number {
  let count = 0;
  if (base.action != null) count++;
  if (base.relocation != null) count++;
  count += countPendingStorageUpgrades(storageUpgrades);
  return count;
}

export function isBaseHubAtTaskCap(
  base: BaseRecord,
  storageUpgrades: StorageUpgradesRecord,
  research: ResearchRecord,
): boolean {
  return countBaseHubTasks(base, storageUpgrades) >= structureTaskSlotCap(research);
}
