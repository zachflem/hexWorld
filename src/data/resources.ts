import type { Tweaks } from "./tweaksSchema";

export type ResourceType = "food" | "wood" | "stone" | "steel" | "power";
export type ResourceAmounts = Record<ResourceType, number>;

export const RESOURCES_DB_KEY = "resources";

export function initialResourceAmounts(tweaks: Tweaks): ResourceAmounts {
  const { food, wood, stone, steel, power } = tweaks.resources.starting_amounts;
  return { food, wood, stone, steel, power };
}
