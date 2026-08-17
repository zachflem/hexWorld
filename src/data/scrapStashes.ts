import {
  axialDistance,
  axialKey,
  isWithinMapBounds,
  type Axial,
} from "../engine/hexCoords";
import { seededRandom } from "../engine/noise";
import { terrainAt, type TerrainType } from "../engine/terrain";
import type { DenRecord } from "./dens";
import {
  drainRemainingResource,
  isInfiniteResources,
  remainingResourceAt,
  type HexResourcePoolsRecord,
} from "./hexResourcePools";
import type { LabRecord } from "./lab";
import { enumerateMapCoords } from "./featurePlacement";
import { scaleToMapSize } from "./mapSize";
import type { Tweaks } from "./tweaksSchema";

export interface ScrapStashRecord {
  id: string;
  coord: Axial;
  /**
   * 1-based index into `resources/scrap-#.png` (Q70). Fixed at world-gen —
   * same seed always picks the same variant for this stash.
   */
  artVariant: number;
}

export type ScrapStashesRecord = ScrapStashRecord[];

export const SCRAP_STASHES_DB_KEY = "scrapStashes";

/** seed salt for placement — keep clear of dens (1_000) / lab (9_999_999). */
export const SCRAP_STASH_PLACEMENT_SALT = 5_000;
/** Separate salt for the ±1 stash-count roll. */
export const SCRAP_STASH_COUNT_SALT = 5_001;
export const SCRAP_STASH_COUNT_VARIANCE = 1;

/** Reference (128×128) min axial gap between stashes. */
const REFERENCE_STASH_MIN_SEPARATION = 4;

/** How many `scrap-#.png` variants the default pack ships (Q70). */
export const SCRAP_ART_VARIANT_COUNT = 3;

export function rollScrapStashCount(
  seed: number,
  baseCount: number,
  variance: number = SCRAP_STASH_COUNT_VARIANCE,
): number {
  const span = 2 * variance + 1;
  const roll = Math.floor(seededRandom(seed, SCRAP_STASH_COUNT_SALT) * span) - variance;
  return Math.max(1, baseCount + roll);
}

/** True while the hex still has remaining (or infinite_resources). */
export function isActiveScrapStash(
  tweaks: Tweaks,
  seed: number,
  store: HexResourcePoolsRecord,
  stash: ScrapStashRecord,
): boolean {
  if (isInfiniteResources(tweaks)) return true;
  return remainingResourceAt(seed, stash.coord, store, tweaks) > 0;
}

/** True when a non-depleted stash reserves this hex (Q26). */
export function scrapStashBlocksHex(
  tweaks: Tweaks,
  seed: number,
  store: HexResourcePoolsRecord,
  stashes: ScrapStashesRecord,
  coord: Axial,
): boolean {
  const key = axialKey(coord);
  return stashes.some(
    (s) => isActiveScrapStash(tweaks, seed, store, s) && axialKey(s.coord) === key,
  );
}

/**
 * When a wandering scout steps onto an active stash, grant a small steel
 * sample and drain the shared hex pool (Q7 / Milestone 27).
 */
export function applyWanderingScoutScrapSamples(
  tweaks: Tweaks,
  seed: number,
  store: HexResourcePoolsRecord,
  scrapStashes: ScrapStashesRecord,
  previousScouts: { coord: Axial }[],
  nextScouts: { coord: Axial }[],
): { scrapStashes: ScrapStashesRecord; steelGained: number; hexResourcePools: HexResourcePoolsRecord } {
  const sample = tweaks.scrap_stashes.wandering_scout_sample_steel;
  if (sample <= 0 || scrapStashes.length === 0) {
    return { scrapStashes, steelGained: 0, hexResourcePools: store };
  }

  let steelGained = 0;
  let nextStore = store;

  for (let i = 0; i < nextScouts.length; i++) {
    const next = nextScouts[i];
    const prev = previousScouts[i];
    if (!next || !prev) continue;
    if (axialKey(next.coord) === axialKey(prev.coord)) continue;

    const stash = scrapStashes.find(
      (s) => isActiveScrapStash(tweaks, seed, nextStore, s) && axialKey(s.coord) === axialKey(next.coord),
    );
    if (!stash) continue;

    const drained = drainRemainingResource(seed, stash.coord, nextStore, tweaks, sample);
    nextStore = drained.store;
    if (drained.taken <= 0) continue;
    steelGained += drained.taken;
  }

  return { scrapStashes, steelGained, hexResourcePools: nextStore };
}

function terrainWeight(tweaks: Tweaks, terrain: TerrainType): number {
  if (terrain === "water") return 0;
  return tweaks.scrap_stashes.terrain_placement_weight[terrain];
}

function artVariantFor(seed: number, salt: number, variantCount: number): number {
  const n = Math.max(1, variantCount);
  return 1 + Math.floor(seededRandom(seed, salt) * n);
}

function makeStash(
  seed: number,
  index: number,
  coord: Axial,
  tweaks: Tweaks,
): ScrapStashRecord {
  const artVariant = artVariantFor(
    seed,
    SCRAP_STASH_PLACEMENT_SALT + index * 10 + 5,
    tweaks.scrap_stashes.art_variant_count,
  );
  return {
    id: `scrap-${index}`,
    coord,
    artVariant,
  };
}

/**
 * Weighted seeded pick from a candidate list (weights already on each entry).
 * Mutates `candidates` by removing the pick and anything inside `minSeparation`.
 */
function pickWeighted(
  seed: number,
  salt: number,
  candidates: { coord: Axial; weight: number }[],
  minSeparation: number,
): Axial | null {
  if (candidates.length === 0) return null;
  let total = 0;
  for (const c of candidates) total += c.weight;
  if (total <= 0) return null;

  let roll = seededRandom(seed, salt) * total;
  let pickIndex = 0;
  for (let i = 0; i < candidates.length; i++) {
    roll -= candidates[i]!.weight;
    if (roll < 0) {
      pickIndex = i;
      break;
    }
    pickIndex = i;
  }

  const [picked] = candidates.splice(pickIndex, 1);
  if (!picked) return null;

  if (minSeparation > 0) {
    for (let c = candidates.length - 1; c >= 0; c--) {
      if (axialDistance(candidates[c]!.coord, picked.coord) < minSeparation) {
        candidates.splice(c, 1);
      }
    }
  }
  return picked.coord;
}

/**
 * Deterministic scrap-stash placement (Milestone 26 / #36).
 * Favors mountain/forest/shore, keeps dens+lab clear, guarantees one stash
 * near the base (Q48), and assigns seeded scrap-# art (Q70).
 * Pool size lives on the hex (`hex_resource_pools`), not the stash record.
 */
export function createScrapStashes(
  seed: number,
  gridSize: number,
  base: Axial,
  dens: DenRecord[],
  lab: LabRecord | null,
  tweaks: Tweaks,
): ScrapStashesRecord {
  const cfg = tweaks.scrap_stashes;
  const count = rollScrapStashCount(seed, cfg.count);
  const minSeparation = scaleToMapSize(REFERENCE_STASH_MIN_SEPARATION, gridSize);
  const earlyMax = cfg.early_guarantee_max_distance;

  const excluded = new Set(dens.map((d) => axialKey(d.coord)));
  if (lab) excluded.add(axialKey(lab.coord));

  const allLand = enumerateMapCoords(gridSize).filter((coord) => {
    if (excluded.has(axialKey(coord))) return false;
    if (!isWithinMapBounds(coord, gridSize)) return false;
    const terrain = terrainAt(seed, coord);
    return terrainWeight(tweaks, terrain) > 0;
  });

  const weighted = allLand.map((coord) => ({
    coord,
    weight: terrainWeight(tweaks, terrainAt(seed, coord)),
  }));

  const placed: Axial[] = [];

  // Early-game guarantee — one stash within ~earlyMax of base (Q48).
  const near = weighted.filter((c) => axialDistance(base, c.coord) <= earlyMax);
  const guarantee = pickWeighted(seed, SCRAP_STASH_PLACEMENT_SALT, near.length > 0 ? near : weighted, minSeparation);
  if (guarantee) {
    placed.push(guarantee);
    for (let i = weighted.length - 1; i >= 0; i--) {
      const c = weighted[i]!;
      if (axialKey(c.coord) === axialKey(guarantee) || axialDistance(c.coord, guarantee) < minSeparation) {
        weighted.splice(i, 1);
      }
    }
  }

  for (let i = placed.length; i < count; i++) {
    const next = pickWeighted(seed, SCRAP_STASH_PLACEMENT_SALT + i * 2, weighted, minSeparation);
    if (!next) break;
    placed.push(next);
  }

  return placed.map((coord, i) => makeStash(seed, i, coord, tweaks));
}
