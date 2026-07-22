import type { TerrainType } from "../engine/terrain";
import type { ResourceType } from "../data/resources";

type TextureKey = string;

const cache = new Map<TextureKey, HTMLImageElement | "error">();
const listeners = new Set<() => void>();

/** Subscribe to be notified whenever any texture finishes loading — used to trigger a redraw, since the canvas draw loop only reruns on effect-dependency changes, not per frame. */
export function onTextureLoad(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function load(key: TextureKey, path: string): HTMLImageElement | null {
  const cached = cache.get(key);
  if (cached === "error") return null;
  if (cached) return cached;

  const img = new Image();
  img.onload = () => {
    cache.set(key, img);
    listeners.forEach((fn) => fn());
  };
  img.onerror = () => {
    cache.set(key, "error");
  };
  img.src = path;
  return null;
}

export function getTerrainTexture(type: TerrainType): HTMLImageElement | null {
  return load(`terrain/${type}`, `/tiles/terrain/${type}.png`);
}

export function getResourceTexture(type: ResourceType): HTMLImageElement | null {
  return load(`resources/${type}`, `/tiles/resources/${type}.png`);
}

/**
 * Fixed-structure marker icon (base, tower, barracks, dock, den, outpost,
 * wall tiers, ...) — a small overlay icon (like resource markers), not
 * full-hex art like terrain. `name` matches the PNG's filename under
 * /tiles/structures/ (e.g. "tower" -> tower.png).
 */
export function getStructureIconTexture(name: string): HTMLImageElement | null {
  return load(`structures/${name}-icon`, `/tiles/structures/${name}.png`);
}

/**
 * Full-hex tile art for a path tier — same footprint/overlay convention as
 * `getTerrainTexture` (a path tile fully replaces the terrain fill rather
 * than sitting as a small overlay on top of it). `name` matches the PNG's
 * filename under /tiles/structures/ (e.g. "path-stone" -> path-stone.png).
 */
export function getPathTileTexture(name: string): HTMLImageElement | null {
  return load(`structures/${name}-full`, `/tiles/structures/${name}.png`);
}

/**
 * Mobile-entity marker icon (expedition, horde, scout skiff, wandering
 * scout, ...) — same small-overlay treatment as getStructureIconTexture,
 * just for things that move around the map rather than sit fixed on a
 * tile. `name` matches the PNG's filename under /tiles/units/.
 */
export function getUnitIconTexture(name: string): HTMLImageElement | null {
  return load(`units/${name}-icon`, `/tiles/units/${name}.png`);
}

/**
 * Full-hex tile art (terrain, base marker) is exported taller than it is
 * wide: a square hex footprint (bottom point to top edge = image width)
 * with extra height above it reserved for overlay content (mountain peaks,
 * treetops) meant to spill into the tile behind — measured directly against
 * the source files, not detected. Draws just the square footprint, stretched
 * to fill the hex's bounding box. Deliberately not clipped — draw order
 * (top row first) makes each lower tile paint over the tile behind it, which
 * is what lets `drawHexTileOverlay` below spill upward correctly.
 */
export function drawHexTileTexture(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  centerX: number,
  centerY: number,
  destW: number,
  destH: number,
): void {
  const cropH = img.width;
  const cropY = img.height - cropH;
  ctx.drawImage(img, 0, cropY, img.width, cropH, centerX - destW / 2, centerY - destH / 2, destW, destH);
}

/**
 * Draws the portion of a hex tile's art *above* its square footprint (the
 * top `img.height - img.width` source rows) — mountain peaks, treetops,
 * rooftops meant to rise above the tile and spill into the tile behind it.
 * Positioned so its bottom edge lines up exactly with the footprint's top
 * edge (`hexTopY`, i.e. `centerY - size`), using the same width and vertical
 * scale as `drawHexTileTexture`'s `destW`/`destH` so there's no seam between
 * the two. Call this as part of the terrain pass (before fog/decoration are
 * drawn) — fog is re-applied per-tile afterward, so it correctly covers back
 * up whatever this draws over the tile above.
 */
export function drawHexTileOverlay(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  centerX: number,
  hexTopY: number,
  destW: number,
  destH: number,
): void {
  const overlaySourceH = img.height - img.width;
  if (overlaySourceH <= 0) return;
  const scaleY = destH / img.width;
  const overlayDestH = overlaySourceH * scaleY;
  ctx.drawImage(img, 0, 0, img.width, overlaySourceH, centerX - destW / 2, hexTopY - overlayDestH, destW, overlayDestH);
}

/** Draws `img` centered on (centerX, centerY), matching its width to `destW` and letting height follow its own aspect ratio — used for small overlay icons (e.g. resource markers), which aren't part of the hex-tile asset convention above. */
export function drawImageAtWidth(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  centerX: number,
  centerY: number,
  destW: number,
): void {
  const destH = destW * (img.height / img.width);
  ctx.drawImage(img, centerX - destW / 2, centerY - destH / 2, destW, destH);
}
