import type { ResourceType } from "./resources";

export type StorageLevels = Record<ResourceType, number>;

export const STORAGE_LEVELS_DB_KEY = "storageLevels";

export function initialStorageLevels(): StorageLevels {
  return { food: 1, wood: 1, stone: 1, steel: 1 };
}
