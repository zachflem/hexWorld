import type { ResourceType } from "./resources";

/**
 * Pending storage-level upgrades, keyed by resource — kept separate from
 * data/storageLevels.ts's StorageLevels (a bare Record<ResourceType, number>
 * read throughout the tick loop for capacity math) so that shape stays
 * untouched. Same relationship as data/expeditions.ts being separate from
 * data/base.ts.
 */
export type StorageUpgradesRecord = Partial<Record<ResourceType, { targetLevel: number; startedAt: number }>>;

export const STORAGE_UPGRADES_DB_KEY = "storageUpgrades";

export function initialStorageUpgrades(): StorageUpgradesRecord {
  return {};
}

/** True when any resource's storage upgrade timer is running. */
export function hasPendingStorageUpgrade(storageUpgrades: StorageUpgradesRecord): boolean {
  return countPendingStorageUpgrades(storageUpgrades) > 0;
}

/** Number of storage upgrade timers currently running. */
export function countPendingStorageUpgrades(storageUpgrades: StorageUpgradesRecord): number {
  return Object.values(storageUpgrades).filter((pending) => pending != null).length;
}
