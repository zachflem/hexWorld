import type { TerritoryRecord } from "../data/territory";
import type { Tower } from "../data/towers";
import type { Tweaks } from "../data/tweaksSchema";
import { isStructureActive } from "./formulas";
import { axialKey, axialNeighbors, axialSpiral, isWithinMapBounds, type Axial } from "./hexCoords";
import { terrainAt } from "./terrain";
import { towerRange } from "./towers";

/** True if `coord` is one of the 6 hex neighbors of at least one tile in `centers`. */
function isAdjacentToAny(coord: Axial, centers: Axial[]): boolean {
  const centerKeys = new Set(centers.map(axialKey));
  return axialNeighbors(coord).some((neighbor) => centerKeys.has(axialKey(neighbor)));
}

/**
 * A tile can be scouted only if adjacent to a *land* tile you already own or
 * have already scouted — knowledge has to spread outward from your footprint
 * the same way physical expansion does, not skip around freely (DESIGN.md
 * §6). The land requirement on the connecting tile means a scout can survey
 * the water tile right at the shoreline (that's just looking, not crossing),
 * but can't chain further out across open water one hop at a time — there's
 * no water-capable unit to do that traversal, so each successive water tile
 * needs a *land* neighbor already known, which the middle of a lake won't have.
 */
export function isTileScoutable(seed: number, coord: Axial, owned: Axial[], scouted: Axial[]): boolean {
  const isLand = (c: Axial) => terrainAt(seed, c) !== "water";
  return isAdjacentToAny(coord, owned.filter(isLand)) || isAdjacentToAny(coord, scouted.filter(isLand));
}

/** tile_defense = tile_defense_base + tile_defense_per_distance * distance_from_base — tweaks.jsonc territory_expansion. */
export function tileDefense(tweaks: Tweaks, distanceFromBase: number): number {
  const { tile_defense_base, tile_defense_per_distance } = tweaks.territory_expansion;
  return tile_defense_base + tile_defense_per_distance * distanceFromBase;
}

/**
 * Viewshed-style passive expansion: every tile within a tower's current
 * range (towerRange, engine/towers.ts — grows with level, same radius the
 * tower shades on the map and defends) is automatically owned, no militia
 * assault required — "the tower adds elevation, so the player can see
 * further," per playtesting discussion. This is IN ADDITION to force-based
 * expansion (an expedition fighting its way there — engine/expeditions.ts,
 * which reuses tileDefense above), not a replacement — a tower's footprint
 * claims ground the moment it's built or upgraded, force-based expansion
 * still covers everywhere else.
 *
 * `excludedTiles` (typically: every tile a horde currently occupies) keeps
 * this from instantly re-claiming a tile the SAME tick a horde takes it —
 * without that exclusion, any captured tile within a tower's own range would
 * flip back to owned immediately, nullifying capture/damage/repair entirely
 * for that ground. The moment the horde is gone (destroyed or advanced past)
 * the tile reclaims itself automatically next tick — but the STRUCTURE on it
 * (if any) stays `damaged` until the player pays to repair it; this only
 * ever touches `territory.owned`.
 *
 * A damaged or still-under-construction tower contributes no claim
 * (engine/formulas.ts:isStructureActive), same as it contributes no combat
 * value (hordeTileDefense, engine/hordes.ts) — non-functional is
 * non-functional across the board.
 */
export function autoClaimTowerRange(
  tweaks: Tweaks,
  towers: Tower[],
  territory: TerritoryRecord,
  gridSize: number,
  excludedTiles: Set<string>,
  seed: number,
): TerritoryRecord {
  if (towers.length === 0) return territory;

  const ownedKeys = new Set(territory.owned.map(axialKey));
  const seen = new Set<string>();
  const newlyClaimed: Axial[] = [];

  for (const tower of towers) {
    if (!isStructureActive(tower)) continue;
    const range = towerRange(tweaks, tower.level, terrainAt(seed, tower.coord));
    for (const coord of axialSpiral(tower.coord, range)) {
      if (!isWithinMapBounds(coord, gridSize)) continue;
      const key = axialKey(coord);
      if (ownedKeys.has(key) || excludedTiles.has(key) || seen.has(key)) continue;
      seen.add(key);
      newlyClaimed.push(coord);
    }
  }

  return newlyClaimed.length > 0 ? { ...territory, owned: [...territory.owned, ...newlyClaimed] } : territory;
}

/** True when `coord` falls within any active tower's viewshed (same radius as autoClaimTowerRange). */
export function isWithinActiveTowerClaim(
  tweaks: Tweaks,
  towers: Tower[],
  coord: Axial,
  gridSize: number,
  seed: number,
): boolean {
  const key = axialKey(coord);
  for (const tower of towers) {
    if (!isStructureActive(tower)) continue;
    const range = towerRange(tweaks, tower.level, terrainAt(seed, tower.coord));
    for (const c of axialSpiral(tower.coord, range)) {
      if (!isWithinMapBounds(c, gridSize)) continue;
      if (axialKey(c) === key) return true;
    }
  }
  return false;
}

/** Owned ground, or bare tile within an active tower's viewshed (auto-claim eligible). */
export function canRepairHordeDamagedTile(
  tweaks: Tweaks,
  towers: Tower[],
  territory: TerritoryRecord,
  coord: Axial,
  gridSize: number,
  seed: number,
): boolean {
  const key = axialKey(coord);
  if (territory.owned.some((o) => axialKey(o) === key)) return true;
  return isWithinActiveTowerClaim(tweaks, towers, coord, gridSize, seed);
}
