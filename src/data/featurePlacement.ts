import {
  axialDistance,
  axialKey,
  isWithinMapBounds,
  type Axial,
} from "../engine/hexCoords";
import { seededRandom } from "../engine/noise";
import { terrainAt } from "../engine/terrain";

/** Keep placed features at least this far from one or more anchors (e.g. base). */
export interface AnchorConstraint {
  coords: readonly Axial[];
  minDistance: number;
}

export interface PlaceFeaturesOptions {
  seed: number;
  gridSize: number;
  /**
   * Distinct salt so dens / lab / scrap stashes (#36) don't share the same
   * `seededRandom` index stream for a given world seed.
   */
  salt: number;
  count: number;
  /** Minimum axial distance between features placed in this batch. */
  minSeparation: number;
  anchors?: readonly AnchorConstraint[];
  excludedKeys?: ReadonlySet<string>;
  /** Defaults to in-bounds non-water land. */
  isEligible?: (coord: Axial) => boolean;
}

/** Every tile on the rectangular odd-r map (same bounds as `isWithinMapBounds`). */
export function enumerateMapCoords(gridSize: number): Axial[] {
  const coords: Axial[] = [];
  for (let r = 0; r < gridSize; r++) {
    for (let col = 0; col < gridSize; col++) {
      coords.push({ q: col - Math.floor(r / 2), r });
    }
  }
  return coords;
}

function respectsAnchors(coord: Axial, anchors: readonly AnchorConstraint[] | undefined): boolean {
  if (!anchors) return true;
  for (const { coords, minDistance } of anchors) {
    for (const anchor of coords) {
      if (axialDistance(coord, anchor) < minDistance) return false;
    }
  }
  return true;
}

/**
 * Deterministic world-gen placer — full-map candidate pool (not an early-stopped
 * ring spiral), then seeded picks with min separation. Same `(seed, salt, …)`
 * always yields the same coords. Shared by dens/lab; intended for scrap
 * stashes (#36) and similar landmarks.
 */
export function placeFeatures(options: PlaceFeaturesOptions): Axial[] {
  const {
    seed,
    gridSize,
    salt,
    count,
    minSeparation,
    anchors,
    excludedKeys,
    isEligible = (coord) =>
      isWithinMapBounds(coord, gridSize) && terrainAt(seed, coord) !== "water",
  } = options;

  if (count <= 0) return [];

  const candidates = enumerateMapCoords(gridSize).filter((coord) => {
    if (excludedKeys?.has(axialKey(coord))) return false;
    if (!isEligible(coord)) return false;
    if (!respectsAnchors(coord, anchors)) return false;
    return true;
  });

  const placed: Axial[] = [];
  for (let i = 0; i < count && candidates.length > 0; i++) {
    const pickIndex = Math.floor(seededRandom(seed, salt + i * 2) * candidates.length);
    const [coord] = candidates.splice(pickIndex, 1);
    placed.push(coord);

    if (minSeparation > 0 && candidates.length > 0) {
      for (let c = candidates.length - 1; c >= 0; c--) {
        if (axialDistance(candidates[c], coord) < minSeparation) {
          candidates.splice(c, 1);
        }
      }
    }
  }

  return placed;
}
