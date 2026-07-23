import type { ResourceType } from "../data/resources";
import { drawStructureIconAtWidth } from "./tileTextures";

/** Ground line for every structure icon, as a fraction of hex radius below tile center. */
export const STRUCTURE_GROUND_FRACTION = 0.35;

/** Fixed-structure types whose map icon placement can be tuned independently. */
export type StructurePlacementKey =
  | "base"
  | "outpost"
  | "den"
  | "tower"
  | "barracks"
  | "wall"
  | "dock"
  | "construction";

/**
 * Per-structure vertical nudge in hex-radius units, added to
 * `STRUCTURE_GROUND_FRACTION`. Negative moves the sprite up (feet higher on the
 * hex, more roof spill into the tile above); positive moves it down.
 */
export const STRUCTURE_VERTICAL_OFFSET: Record<StructurePlacementKey, number> = {
  base: 0.5,
  outpost: 0,
  den: 0,
  tower: 0,
  barracks: 0.1,
  wall: 0,
  dock: 0.2,
  construction: 0,
};

/** Icon width multiplier (of hex radius) for each fixed structure type. */
export const STRUCTURE_ICON_SCALE: Record<StructurePlacementKey, number> = {
  base: 2.2,
  outpost: 2.2,
  den: 1.6,
  tower: 1.2,
  barracks: 1.6,
  wall: 1.4,
  dock: 1.6,
  construction: 1.0,
};

/**
 * Per-resource vertical nudge — same units as `STRUCTURE_VERTICAL_OFFSET`.
 * Extraction buildings share the structure bottom-anchor convention but each
 * sprite has different proportions in its PNG.
 */
export const RESOURCE_VERTICAL_OFFSET: Record<ResourceType, number> = {
  food: 0.1,
  wood: 0.1,
  stone: 0.1,
  steel: 0.1,
  power: 0.1,
};

/** Per-resource icon width multiplier (of hex radius). */
export const RESOURCE_ICON_SCALE: Record<ResourceType, number> = {
  food: 1.6,
  wood: 1.2,
  stone: 1.6,
  steel: 1.6,
  power: 1.6,
};

export function structureGroundFraction(key: StructurePlacementKey): number {
  return STRUCTURE_GROUND_FRACTION + STRUCTURE_VERTICAL_OFFSET[key];
}

export function resourceGroundFraction(resource: ResourceType): number {
  return STRUCTURE_GROUND_FRACTION + RESOURCE_VERTICAL_OFFSET[resource];
}

/** Draws a fixed-structure icon using the placement tables above. */
export function drawPlacedStructureIcon(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  centerX: number,
  centerY: number,
  hexSize: number,
  key: StructurePlacementKey,
): void {
  drawStructureIconAtWidth(
    ctx,
    img,
    centerX,
    centerY,
    hexSize,
    hexSize * STRUCTURE_ICON_SCALE[key],
    structureGroundFraction(key),
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
