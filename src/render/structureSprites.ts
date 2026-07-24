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

/** Dock with fishing boat prefers dock-boat, else dock. */
export function dockSpriteCandidates(hasBoat: boolean): string[] {
  return hasBoat ? ["dock-boat", "dock"] : ["dock"];
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
