import type { ResourceType } from "../data/resources";
import { drawStructureIconAtWidth } from "./tileTextures";

/** Ground line for every structure icon, as a fraction of hex radius below tile center. */
export const STRUCTURE_GROUND_FRACTION = 0.35;

/** Fixed-structure kinds whose map icon placement can be tuned independently. */
export type StructurePlacementKey =
  | "base"
  | "outpost"
  | "den"
  | "tower"
  | "barracks"
  | "wall"
  | "dock"
  | "construction"
  | "extraction"
  | "powerStation";

export type StructurePlacementTune = {
  /** Vertical nudge in hex-radius units (added to STRUCTURE_GROUND_FRACTION). Negative = up. */
  offset: number;
  /** Icon width multiplier of hex radius. */
  scale: number;
};

/**
 * Kind defaults — used for single-sprite kinds (outpost, den, construction) and
 * as fallback when a levelled stem is missing from STRUCTURE_VARIANT_PLACEMENT.
 */
export const STRUCTURE_PLACEMENT: Record<StructurePlacementKey, StructurePlacementTune> = {
  base: { offset: 0.5, scale: 2.4 },
  outpost: { offset: 0, scale: 2.2 },
  den: { offset: 0, scale: 1.6 },
  tower: { offset: 0, scale: 2.2 },
  barracks: { offset: 0.1, scale: 2.4 },
  wall: { offset: 0, scale: 2.4 },
  dock: { offset: 0.2, scale: 2.2 },
  construction: { offset: 0, scale: 1.8 },
  extraction: { offset: 0.1, scale: 2.2 },
  powerStation: { offset: 0.1, scale: 1.6 },
};

/**
 * Edit these numbers to tune each level/tier on the map.
 * `offset` — vertical nudge (negative = up, positive = down)
 * `scale` — width as a multiple of hex radius
 */
export const STRUCTURE_VARIANT_PLACEMENT: Record<string, StructurePlacementTune> = {
  // Base L1–4
  "base-1": { offset: 0.5, scale: 2.4 },
  "base-2": { offset: 0.5, scale: 2.4 },
  "base-3": { offset: 0.5, scale: 2.4 },
  "base-4": { offset: 0.5, scale: 2.4 },
  // Tower L1–4 (pack ships 1–3; L4 uses unlevelled fallback art)
  "tower-1": { offset: 0, scale: 2.2 },
  "tower-2": { offset: 0, scale: 2.2 },
  "tower-3": { offset: 0, scale: 2.2 },
  "tower-4": { offset: 0, scale: 2.2 },
  // Barracks L1–4
  "barracks-1": { offset: 0.1, scale: 2.4 },
  "barracks-2": { offset: 0.1, scale: 2.4 },
  "barracks-3": { offset: 0.1, scale: 2.4 },
  "barracks-4": { offset: 0.1, scale: 2.4 },
  // Walls
  "wall-small": { offset: 0, scale: 2.4 },
  "wall-medium": { offset: 0, scale: 2.4 },
  "wall-large": { offset: 0, scale: 2.4 },
  // Dock (+ fishing boat)
  dock: { offset: 0.2, scale: 2.2 },
  "dock-boat": { offset: 0.2, scale: 2.2 },
  "dock-2": { offset: 0.2, scale: 2.2 },
  // Extraction — food
  "food-small": { offset: 0.1, scale: 2.2 },
  "food-mid": { offset: 0.1, scale: 1.8 },
  "food-large": { offset: 0.1, scale: 1.8 },
  // Extraction — wood
  "wood-small": { offset: 0.1, scale: 2.2 },
  "wood-mid": { offset: 0.1, scale: 1.8 },
  "wood-large": { offset: 0.1, scale: 1.8 },
  // Extraction — stone
  "stone-small": { offset: 0.1, scale: 3.4 },
  "stone-mid": { offset: 0.1, scale: 2.2 },
  "stone-large": { offset: 0.1, scale: 2.2 },
  // Extraction — steel
  "steel-small": { offset: 0.1, scale: 2.6 },
  "steel-mid": { offset: 0.1, scale: 1.8 },
  "steel-large": { offset: 0.1, scale: 1.8 },
  // Extraction — power
  "power-small": { offset: 0.1, scale: 1.6 },
  "power-mid": { offset: 0.1, scale: 1.6 },
  "power-large": { offset: 0.1, scale: 1.6 },
};

/**
 * Resolve scale + ground fraction for a structure kind, optionally overridden
 * by a sprite stem (e.g. `"tower-2"`, `"food-mid"`, `"dock-boat"`).
 */
export function structurePlacementFor(
  kind: StructurePlacementKey,
  variantStem?: string | null,
): { scale: number; groundFraction: number } {
  const tune =
    (variantStem != null && variantStem !== ""
      ? STRUCTURE_VARIANT_PLACEMENT[variantStem]
      : undefined) ?? STRUCTURE_PLACEMENT[kind];
  return {
    scale: tune.scale,
    groundFraction: STRUCTURE_GROUND_FRACTION + tune.offset,
  };
}

export function structureGroundFraction(key: StructurePlacementKey, variantStem?: string | null): number {
  return structurePlacementFor(key, variantStem).groundFraction;
}

/**
 * Per-resource vertical nudge for the legacy resource-marker fallback (when no
 * extraction structure sprite exists). Same units as placement offsets.
 */
export const RESOURCE_VERTICAL_OFFSET: Record<ResourceType, number> = {
  food: 0.1,
  wood: 0.1,
  stone: 0.1,
  steel: 0.1,
};

/** Per-resource icon width multiplier for the resource-marker fallback. */
export const RESOURCE_ICON_SCALE: Record<ResourceType, number> = {
  food: 1.8,
  wood: 1.4,
  stone: 1.8,
  steel: 1.8,
};

export function resourceGroundFraction(resource: ResourceType): number {
  return STRUCTURE_GROUND_FRACTION + RESOURCE_VERTICAL_OFFSET[resource];
}

/** Draws a fixed-structure icon using kind defaults and optional variant stem. */
export function drawPlacedStructureIcon(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  centerX: number,
  centerY: number,
  hexSize: number,
  key: StructurePlacementKey,
  variantStem?: string | null,
): void {
  const { scale, groundFraction } = structurePlacementFor(key, variantStem);
  drawStructureIconAtWidth(
    ctx,
    img,
    centerX,
    centerY,
    hexSize,
    hexSize * scale,
    groundFraction,
  );
}

/** Draws a resource-extraction building icon using the placement tables above. */
export function drawPlacedResourceIcon(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  centerX: number,
  centerY: number,
  hexSize: number,
  resource: ResourceType,
): void {
  drawStructureIconAtWidth(
    ctx,
    img,
    centerX,
    centerY,
    hexSize,
    hexSize * RESOURCE_ICON_SCALE[resource],
    resourceGroundFraction(resource),
  );
}

/** Scrap-stash map pin — same placement family as steel resource markers (Q70). */
export function drawPlacedScrapIcon(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  centerX: number,
  centerY: number,
  hexSize: number,
): void {
  drawPlacedResourceIcon(ctx, img, centerX, centerY, hexSize, "steel");
}
