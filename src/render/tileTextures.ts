import type { TerrainType } from "../engine/terrain";
import type { ResourceType } from "../data/resources";
import { assetUrlCandidates, type AssetCategory } from "./assetPaths";
import { structureAssetUrlCandidates } from "./structureSprites";

type TextureKey = string;

const cache = new Map<TextureKey, HTMLImageElement | "error">();
const listeners = new Set<() => void>();

/** Subscribe to be notified whenever any texture finishes loading — used to trigger a redraw, since the canvas draw loop only reruns on effect-dependency changes, not per frame. */
export function onTextureLoad(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function resetTextureCache(): void {
  cache.clear();
}

function loadWithFallbacks(key: TextureKey, urls: string[], index = 0): HTMLImageElement | null {
  const cached = cache.get(key);
  if (cached === "error") return null;
  if (cached) return cached;

  if (index >= urls.length) {
    cache.set(key, "error");
    return null;
  }

  const img = new Image();
  img.onload = () => {
    cache.set(key, img);
    listeners.forEach((fn) => fn());
  };
  img.onerror = () => {
    if (index + 1 < urls.length) {
      loadWithFallbacks(key, urls, index + 1);
    } else {
      cache.set(key, "error");
    }
  };
  img.src = urls[index]!;
  return null;
}

function loadCategory(category: AssetCategory, cacheKey: string, filename: string): HTMLImageElement | null {
  return loadWithFallbacks(`${category}/${cacheKey}`, assetUrlCandidates(category, filename));
}

export function getTerrainTexture(type: TerrainType): HTMLImageElement | null {
  return loadCategory("terrain", type, `${type}.png`);
}

export function getResourceTexture(type: ResourceType): HTMLImageElement | null {
  return loadCategory("resources", type, `${type}.png`);
}

/** Scrap-stash marker — `resources/scrap-#.png` (Milestone 26 / Q70). */
export function getScrapTexture(variant: number): HTMLImageElement | null {
  const n = Math.max(1, Math.floor(variant));
  return loadCategory("resources", `scrap-${n}`, `scrap-${n}.png`);
}

/**
 * Fixed-structure marker icon (base, tower, barracks, dock, den, lab, outpost,
 * wall tiers, ...) — a small overlay icon (like resource markers), not
 * full-hex art like terrain. `name` matches the PNG's filename under
 * profiles/{slug}/assets/structures/ (e.g. "tower" -> tower.png).
 */
export function getStructureIconTexture(name: string): HTMLImageElement | null {
  return getStructureIconTextureCandidates([name]);
}

/**
 * Try structure sprite names in order (e.g. ["tower-2", "tower"]), each
 * through the profile→default URL chain. First existing file wins; missing
 * levelled art falls back to the unlevelled pack asset (Milestone 24 / #P13).
 */
export function getStructureIconTextureCandidates(names: string[]): HTMLImageElement | null {
  if (names.length === 0) return null;
  if (names.length === 1) {
    return loadCategory("structures", `${names[0]}-icon`, `${names[0]}.png`);
  }
  const cacheKey = `${names.join("|")}-icon`;
  return loadWithFallbacks(`structures/${cacheKey}`, structureAssetUrlCandidates(names, assetUrlCandidates));
}


/**
 * Mobile-entity marker icon (expedition, horde, scout skiff, wandering
 * scout, ...) — same small-overlay treatment as getStructureIconTexture,
 * just for things that move around the map rather than sit fixed on a
 * tile. `name` matches the PNG's filename under profiles/{slug}/assets/units/.
 */
export function getUnitIconTexture(name: string): HTMLImageElement | null {
  return loadCategory("units", `${name}-icon`, `${name}.png`);
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
 *
 * Shipped terrain files are 256×384 under this convention. Flat pointy-top
 * hex source art must be converted first via `scripts/convert-flat-terrain-hex.py`
 * (ROADMAP #P12; see AGENTS.md).
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

/**
 * Draws a fixed-structure/building icon with its bottom edge pinned to a
 * ground line on the hex (`centerY + hexSize * groundFraction`), letting the
 * sprite's full natural height rise upward so taller art spills into the tile
 * above — same depth illusion as `drawHexTileOverlay` gives terrain. Center-
 * anchoring via `drawImageAtWidth` left buildings sitting too low in the cell.
 * Per-structure offsets live in `structurePlacement.ts`.
 */
export function drawStructureIconAtWidth(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  centerX: number,
  centerY: number,
  hexSize: number,
  destW: number,
  groundFraction = 0.35,
): void {
  const destH = destW * (img.height / img.width);
  const groundY = centerY + hexSize * groundFraction;
  ctx.drawImage(img, centerX - destW / 2, groundY - destH, destW, destH);
}
