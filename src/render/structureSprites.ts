import type { ExtractionTier } from "../data/extractionTiles";
import type { ResourceType } from "../data/resources";

/** Levelled stem, e.g. structureLevelName("tower", 2) → "tower-2". */
export function structureLevelName(base: string, level: number): string {
  return `${base}-${level}`;
}

/**
 * Exact levelled name first, then the unlevelled default.
 * Missing variant files fall through to the unlevelled pack asset.
 */
export function structureLevelCandidates(base: string, level: number): string[] {
  return [structureLevelName(base, level), base];
}

/**
 * Extraction art: per-resource tier (`food-small`, `wood-mid`, …), then
 * generic `extraction-{tier}`, then `extraction`. Final draw fallback is the
 * resource marker (caller).
 */
export function extractionTierCandidates(resource: ResourceType, tier: ExtractionTier): string[] {
  return [`${resource}-${tier}`, `extraction-${tier}`, "extraction"];
}

/**
 * Dock art: prefer levelled stems; L3+ / fishing boat also tries dock-boat.
 * `hasBoatOrLevel` — pass fishingBoat flag or level ≥ 3.
 */
export function dockSpriteCandidates(levelOrHasBoat: number | boolean): string[] {
  const level = typeof levelOrHasBoat === "number" ? levelOrHasBoat : levelOrHasBoat ? 3 : 1;
  const hasBoat = level >= 3 || levelOrHasBoat === true;
  if (hasBoat) return ["dock-boat", `dock-${level}`, "dock"];
  return [`dock-${level}`, "dock"];
}

/**
 * Power station art: prefer dedicated stems, then reuse legacy power extraction
 * tier sprites (power-small/mid/large) until station-specific art ships.
 */
export function powerStationSpriteCandidates(level: number): string[] {
  const tier = level >= 3 ? "large" : level === 2 ? "mid" : "small";
  return [`power-station-${level}`, "power-station", `power-${tier}`, "power-small"];
}

export function powerStationVariantStem(level: number): string {
  if (level >= 3) return "power-large";
  if (level === 2) return "power-mid";
  return "power-small";
}

/** Scrap Yard art — dedicated stems first, then steel extraction tiers as fallback. */
export function scrapYardSpriteCandidates(level: number): string[] {
  const tier = level >= 3 ? "large" : level === 2 ? "mid" : "small";
  return [`scrap-yard-${level}`, "scrap-yard", `steel-${tier}`];
}

export function scrapYardVariantStem(level: number): string {
  if (level >= 3) return "scrap-yard-3";
  if (level === 2) return "scrap-yard-2";
  return "scrap-yard-1";
}

/**
 * Flatten structure name candidates into profile→default URL order:
 * for ["tower-2", "tower"] on hard → hard/tower-2, default/tower-2, hard/tower, default/tower.
 */
export function structureAssetUrlCandidates(
  names: string[],
  assetUrlCandidates: (category: "structures", filename: string) => string[],
): string[] {
  return names.flatMap((name) => assetUrlCandidates("structures", `${name}.png`));
}
