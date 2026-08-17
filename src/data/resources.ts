import type { Tweaks } from "./tweaksSchema";

export type ResourceType = "food" | "wood" | "stone" | "steel";
export type ResourceAmounts = Record<ResourceType, number>;

export const RESOURCES_DB_KEY = "resources";

export const RESOURCE_ORDER: ResourceType[] = ["food", "wood", "stone", "steel"];

export function initialResourceAmounts(tweaks: Tweaks): ResourceAmounts {
  const { food, wood, stone, steel } = tweaks.resources.starting_amounts;
  return { food, wood, stone, steel };
}

/** Strip legacy `power` keys from Partial resource maps (invested / buildCost / costs). */
export function stripPowerKeys<T extends Partial<Record<string, number>>>(
  amounts: T | null | undefined,
): Partial<Record<ResourceType, number>> {
  if (!amounts) return {};
  const next: Partial<Record<ResourceType, number>> = {};
  for (const key of RESOURCE_ORDER) {
    if (amounts[key] != null) next[key] = amounts[key];
  }
  return next;
}
