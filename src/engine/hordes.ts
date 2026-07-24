import type { Barracks } from "../data/barracks";
import type { DenRecord, DensRecord } from "../data/dens";
import type { ExtractionTile } from "../data/extractionTiles";
import type { Garrison, GarrisonsRecord } from "../data/garrisons";
import type { HordeRecord, HordesRecord } from "../data/hordes";
import type { OutpostsRecord } from "../data/outposts";
import type { PathTile } from "../data/pathTiles";
import type { TerritoryRecord } from "../data/territory";
import type { Tower } from "../data/towers";
import type { Tweaks } from "../data/tweaksSchema";
import type { UnitsRecord } from "../data/units";
import type { Wall } from "../data/walls";
import { isStructureActive, structureHp } from "./formulas";
import { garrisonAt, garrisonAttackPower, garrisonDefense, garrisonWallRangeBonus, isHordeReachableFromGarrison } from "./garrisons";
import { axialDistance, axialKey, type Axial } from "./hexCoords";
import { seededRandom } from "./noise";
import { noiseCap } from "./noiseMeter";
import { findNearestHordeTarget } from "./pathfinding";
import { towerDamage, towerRange, zombiesKilledPerTick } from "./towers";

/** A one-shot-defended point advanceHordes checks a horde's route against — the main base, or any live Outpost (data/outposts.ts). `kind`/`id` are for the caller's benefit only (advanceHordes itself only ever keys off `coord`). */
export interface HordeHub {
  coord: Axial;
  hp: number;
  garrisonDefense: number;
  kind: "base" | "outpost";
  id: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Linear interpolation between the zero-noise and max-noise endpoints of a noise-scaled tweaks pair. */
function noiseScaled(atZeroNoise: number, atMaxNoise: number, noisePct: number): number {
  return atZeroNoise + (atMaxNoise - atZeroNoise) * (clamp(noisePct, 0, 100) / 100);
}

/** A per-(den, real-time-second) deterministic index for the spawn roll — varies over wall-clock time, not just den identity. */
function denRollIndex(den: DenRecord, now: number): number {
  return den.coord.q * 92_821 + den.coord.r * 68_917 + Math.floor(now / 1000);
}

function mostRecentSpawn(hordes: HordesRecord, denId: string): number {
  let latest = -Infinity;
  for (const horde of hordes) {
    if (horde.originDenId === denId && horde.spawnedAt > latest) latest = horde.spawnedAt;
  }
  return latest;
}

/**
 * Extends tweaks.jsonc's spawn_chance_formula/size_formula (noise-only) to
 * also factor in per-den proximity and level, per DESIGN.md §12. Evaluated
 * per den, closed-form over `elapsedSeconds` (a fractional interval count,
 * not floored — so live 1s ticks and multi-hour offline gaps both resolve
 * correctly via the same continuous-compounding math the rest of this
 * codebase uses) against a deterministic seeded roll, and gated by a
 * per-den spawn cooldown (not global — see tweaks.jsonc horde note).
 *
 * Two global gates sit in front of all of that (tweaks.jsonc horde
 * no_horde_noise_threshold/level_scaling notes): at/below the "silent"
 * noise floor no den even rolls (nothing to hear), and the final
 * spawnProbability is scaled by a base-level multiplier — a fresh, low-level
 * base sees only a fraction of the "full" spawn rate, ramping to 100% as the
 * base levels up.
 */
export function checkHordeSpawns(
  tweaks: Tweaks,
  dens: DensRecord,
  hordes: HordesRecord,
  noise: number,
  baseLevel: number,
  seed: number,
  territory: TerritoryRecord,
  outposts: OutpostsRecord,
  gridSize: number,
  now: number,
  elapsedSeconds: number,
): HordesRecord {
  if (elapsedSeconds <= 0 || dens.length === 0) return hordes;
  if (noise <= tweaks.horde.no_horde_noise_threshold_db) return hordes;

  const cap = noiseCap(tweaks, baseLevel);
  const noisePct = cap > 0 ? Math.min(100, (100 * noise) / cap) : 0;

  const {
    spawn_check_interval_seconds,
    spawn_cooldown_minutes,
    proximity_base_weight,
    proximity_influence,
    den_level_base_weight,
    den_level_influence,
    level_scaling_base,
    level_scaling_per_level,
  } = tweaks.horde;
  const { max_relevant_distance, max_level, horde_size_base } = tweaks.dens;
  const cooldownMs = spawn_cooldown_minutes * 60_000;
  const levelMultiplier = Math.min(1, level_scaling_base + level_scaling_per_level * (baseLevel - 1));

  const spawned: HordeRecord[] = [];

  for (const den of dens) {
    if (now - mostRecentSpawn(hordes, den.id) < cooldownMs) continue;

    const distance = axialDistance(den.coord, territory.base);
    const proximityFactor = clamp(1 - distance / max_relevant_distance, 0, 1);
    const denLevelFactor = den.level / max_level;

    const chancePerCheck =
      (noisePct / 100) ** 2 *
      (proximity_base_weight + proximity_influence * proximityFactor) *
      (den_level_base_weight + den_level_influence * denLevelFactor);

    const intervalsElapsed = elapsedSeconds / spawn_check_interval_seconds;
    const spawnProbability = (1 - (1 - chancePerCheck) ** intervalsElapsed) * levelMultiplier;

    const roll = seededRandom(seed, denRollIndex(den, now));
    if (roll >= spawnProbability) continue;

    const candidateHubs = [territory.base, ...outposts.map((o) => o.coord)];
    const nearestTarget = findNearestHordeTarget(tweaks, seed, den.coord, candidateHubs, gridSize);
    if (!nearestTarget) continue;
    const { path } = nearestTarget;

    const size = horde_size_base + noisePct ** 1.5 * (den_level_base_weight + den_level_influence * denLevelFactor);

    // A quiet spawn is slow and disperses fast; a loud one is fast and
    // persistent — both captured now, fixed for the horde's whole lifetime
    // (see the HordeRecord doc comment). tweaks.jsonc horde.speed_factor_at_*_noise
    // / size_decay_pct_per_tile_at_*_noise.
    const speedFactor = noiseScaled(tweaks.horde.speed_factor_at_zero_noise, tweaks.horde.speed_factor_at_max_noise, noisePct);
    const decayPct = noiseScaled(
      tweaks.horde.size_decay_pct_per_tile_at_zero_noise,
      tweaks.horde.size_decay_pct_per_tile_at_max_noise,
      noisePct,
    );

    spawned.push({
      id: `horde-${den.id}-${now}`,
      originDenId: den.id,
      size,
      path,
      pathIndex: 0,
      progress: 0,
      spawnedAt: now,
      speedFactor,
      decayPct,
    });
  }

  return spawned.length > 0 ? [...hordes, ...spawned] : hordes;
}

/**
 * The structure-only component of a tile's defense (garrison excluded — see
 * hordeTileDefense below, which adds that in once). Towers and walls keep
 * their own dedicated combat stats (damage/durability); extraction tiles,
 * path tiles, and barracks have no combat stat of their own, so they fall
 * back to the generic investment-based structureHp (engine/formulas.ts) —
 * DESIGN.md never said non-military structures should offer zero
 * resistance, and previously they did (hordeTileDefense only ever checked
 * towers/walls). A tile hosts at most one of these five at a time, so the
 * first match wins. A `damaged` structure of ANY kind contributes 0 — it
 * can't defend the very tile that overran it, which defeats the point of
 * repair.
 */
function structureCombatDefense(
  tweaks: Tweaks,
  extractionTiles: ExtractionTile[],
  pathTiles: PathTile[],
  towers: Tower[],
  walls: Wall[],
  barracksList: Barracks[],
  key: string,
): number {
  const tower = towers.find((t) => axialKey(t.coord) === key);
  if (tower) return isStructureActive(tower) ? towerDamage(tweaks, tower.level) : 0;

  const wall = walls.find((w) => axialKey(w.coord) === key);
  if (wall) return isStructureActive(wall) ? wall.durability : 0;

  const extractionTile = extractionTiles.find((t) => axialKey(t.coord) === key);
  if (extractionTile) return isStructureActive(extractionTile) ? structureHp(tweaks, extractionTile.totalInvested) : 0;

  const pathTile = pathTiles.find((t) => axialKey(t.coord) === key);
  if (pathTile) return isStructureActive(pathTile) ? structureHp(tweaks, pathTile.totalInvested) : 0;

  const barracks = barracksList.find((b) => axialKey(b.coord) === key);
  if (barracks) return isStructureActive(barracks) ? structureHp(tweaks, barracks.totalInvested) : 0;

  return 0;
}

/**
 * Milestone 11 placeholder, still — this is the ONE-SHOT check for whether a
 * horde can advance onto a tile: an undefended tile has no resistance (0);
 * whatever structure sits there (structureCombatDefense, above) contributes
 * its stand-in defense value, compared once, instantly (see
 * resolveHordeTileFight) rather than worn down over time. This is separate
 * from towers' real per-tick attrition against nearby hordes (see
 * towerDamagePerSecond below, in advanceHordes) — a tower both chips away at
 * any horde within range every tick AND still serves as this tile's one-shot
 * defense stat if a horde tries to step directly onto it. A garrison
 * (engine/garrisons.ts) stacks additively on top of whichever structure
 * value applies — a mobile reinforcement, not a substitute.
 */
export function hordeTileDefense(
  tweaks: Tweaks,
  extractionTiles: ExtractionTile[],
  pathTiles: PathTile[],
  towers: Tower[],
  walls: Wall[],
  barracksList: Barracks[],
  garrisons: GarrisonsRecord,
  coord: Axial,
): number {
  const key = axialKey(coord);
  return (
    structureCombatDefense(tweaks, extractionTiles, pathTiles, towers, walls, barracksList, key) +
    garrisonDefense(tweaks, garrisons, coord)
  );
}

/** Deterministic, no luck — same generic size>=defense shape engine/expeditions.ts:stepCorridorWalk reuses for a party fighting the opposite direction. */
export function resolveHordeTileFight(hordeSize: number, defense: number): boolean {
  return hordeSize >= defense;
}

/**
 * A garrison proactively striking a horde on its own tile or an adjacent one
 * (engine/garrisons.ts:isHordeReachableFromGarrison) — same deterministic
 * shape as every other combat resolution in this game (DESIGN.md §10): win
 * destroys the horde outright and the committing garrison returns unharmed,
 * lose consumes the entire garrison (every unit type stationed there) and
 * the horde is untouched. Attack power sums across every garrisonable unit
 * type (engine/garrisons.ts:garrisonAttackPower) — militia, junkyard knights,
 * and cross-bow snipers all contribute.
 */
export function resolveHordeAttack(tweaks: Tweaks, garrison: Garrison, hordeSize: number): boolean {
  return garrisonAttackPower(tweaks, garrison) >= hordeSize;
}

/**
 * Automatic version of a garrison's strike — no manual commitment needed:
 * every garrison with a horde on its own tile or a directly adjacent one
 * (engine/garrisons.ts:isHordeReachableFromGarrison, extended by
 * tweaks.walls.garrison_range_bonus_tiles when stationed on a non-damaged
 * wall) commits its FULL strength against it every tick, resolved via
 * resolveHordeAttack. Processed garrison by garrison, sequentially, so a
 * horde already destroyed earlier in this same pass can't be "attacked"
 * twice, and a garrison that's already been wiped this pass doesn't get a
 * phantom second fight.
 */
export function resolveGarrisonAutoAttacks(
  tweaks: Tweaks,
  garrisons: GarrisonsRecord,
  hordes: HordesRecord,
  units: UnitsRecord,
  walls: Wall[],
): { garrisons: GarrisonsRecord; hordes: HordesRecord; units: UnitsRecord; anyAutoAttack: boolean } {
  if (garrisons.length === 0 || hordes.length === 0) {
    return { garrisons, hordes, units, anyAutoAttack: false };
  }

  let nextGarrisons = garrisons;
  let nextHordes = hordes;
  let nextUnits = units;
  let anyAutoAttack = false;

  for (const garrison of garrisons) {
    const current = nextGarrisons.find((g) => axialKey(g.coord) === axialKey(garrison.coord));
    if (!current) continue; // wiped earlier this same pass

    const horde = nextHordes.find((h) => isHordeReachableFromGarrison(tweaks, walls, current.coord, h.path[h.pathIndex]));
    if (!horde) continue;

    anyAutoAttack = true;
    const won = resolveHordeAttack(tweaks, current, horde.size);

    if (won) {
      nextHordes = nextHordes.filter((h) => h.id !== horde.id);
      continue;
    }

    // Lost units are actually dead — same as any other committed force on a
    // loss (resolveCapturedGarrisons follows the identical rule) — every
    // unit type stationed in this garrison is debited from the standing army.
    nextGarrisons = nextGarrisons.filter((g) => axialKey(g.coord) !== axialKey(current.coord));
    nextUnits = {
      ...nextUnits,
      militiaCount: Math.max(0, nextUnits.militiaCount - current.militiaCount),
      junkyardKnightCount: Math.max(0, nextUnits.junkyardKnightCount - current.junkyardKnightCount),
      crossBowSniperCount: Math.max(0, nextUnits.crossBowSniperCount - current.crossBowSniperCount),
    };
  }

  return anyAutoAttack
    ? { garrisons: nextGarrisons, hordes: nextHordes, units: nextUnits, anyAutoAttack }
    : { garrisons, hordes, units, anyAutoAttack: false };
}

/** Every active tower (engine/formulas.ts:isStructureActive) whose range (engine/towers.ts:towerRange) reaches `coord` — exported so the map renderer can highlight towers currently in combat (src/render/HexCanvas.tsx). */
export function towersInRange(tweaks: Tweaks, towers: Tower[], coord: Axial): Tower[] {
  return towers.filter((t) => isStructureActive(t) && axialDistance(t.coord, coord) <= towerRange(tweaks, t.level));
}

/**
 * Watchtower early-warning (#38): ids newly entering tower range should toast
 * once; ids that left range are dropped so a later re-entry alerts again.
 */
export function reconcileHordeWatchtowerAlerts(
  currentlyInRangeIds: Iterable<string>,
  previouslyAlerted: ReadonlySet<string>,
): { nextAlerted: Set<string>; newlyAlertedIds: string[] } {
  const stillInRange = new Set(currentlyInRangeIds);
  const newlyAlertedIds: string[] = [];
  for (const id of stillInRange) {
    if (!previouslyAlerted.has(id)) newlyAlertedIds.push(id);
  }
  return { nextAlerted: stillInRange, newlyAlertedIds };
}

/**
 * Real per-tick attrition (DESIGN.md §10: "Towers deal damage at range,
 * every tick a horde remains within reach") — zombiesKilledPerTick per
 * in-range tower, converted to a continuous per-second rate the same way
 * extraction yield is (tweaks.jsonc values are nominally "per tick" but
 * applied continuously over elapsedSeconds, not in discrete steps). Multiple
 * towers in range simply sum. A tower with militia garrisoned on its own
 * tile gets their attack power added straight onto its own damage
 * (tweaks.towers.garrison_damage_bonus_per_militia) before the horde-size
 * scaling — additive, not a separate attack.
 */
export function towerDamagePerSecond(
  tweaks: Tweaks,
  inRangeTowers: Tower[],
  hordeSize: number,
  garrisons: GarrisonsRecord,
): number {
  return inRangeTowers.reduce((sum, tower) => {
    const garrison = garrisonAt(garrisons, tower.coord);
    const garrisonBonusDamage = garrison ? garrison.militiaCount * tweaks.towers.garrison_damage_bonus_per_militia : 0;
    return sum + zombiesKilledPerTick(tweaks, tower.level, hordeSize, garrisonBonusDamage) / tweaks.game.tick_interval_seconds;
  }, 0);
}

/**
 * Cross-bow snipers are the first ranged unit (barracks L3 unlock) — a
 * garrison containing them, anywhere (not just atop a tower), deals
 * continuous per-tick damage to any horde within
 * units.cross_bow_sniper.range_tiles of its own tile (extended by
 * tweaks.walls.garrison_range_bonus_tiles when that garrison's own coord has
 * a non-damaged wall), the same "per tick, converted to a continuous rate"
 * shape as tower damage above. Composes with towerDamagePerSecond: a tower
 * with snipers garrisoned on it gets both its own damage (plus the
 * militia-only garrison bonus, see above) AND this ranged contribution,
 * added on top.
 */
export function sniperDamagePerSecond(tweaks: Tweaks, garrisons: GarrisonsRecord, walls: Wall[], coord: Axial): number {
  return garrisons.reduce((sum, garrison) => {
    if (garrison.crossBowSniperCount <= 0) return sum;
    const rangeTiles = tweaks.units.cross_bow_sniper.range_tiles + garrisonWallRangeBonus(tweaks, walls, garrison.coord);
    if (axialDistance(garrison.coord, coord) > rangeTiles) return sum;
    return (
      sum +
      (garrison.crossBowSniperCount * tweaks.units.cross_bow_sniper.ranged_damage_per_unit) /
        tweaks.game.tick_interval_seconds
    );
  }, 0);
}

/**
 * Continuous tile-by-tile advancement, closed-form over `elapsedSeconds` —
 * baseline rate is 1 tile per tick_interval_seconds, same "advance one tile
 * per tick" DESIGN.md describes, scaled per-horde by `horde.speedFactor`
 * (fixed at spawn from the noise level at that moment — see
 * checkHordeSpawns) and expressed as a continuous rate rather than a
 * discrete step loop so arbitrary offline gaps resolve correctly. A horde
 * that fails a tile fight (placeholder defense not yet beaten) simply halts
 * at its current tile — there's no attrition in Milestone 11 to change that
 * outcome over time, so further elapsed progress is discarded rather than
 * queued up. Capturing an owned tile removes it from `territory.owned`
 * (the first code path to shrink it — see data/territory.ts's doc comment);
 * any structure on that tile is left in place, not deleted — `capturedTiles`
 * reports which coords were captured this call so the caller can flag those
 * structures `damaged` (see markCapturedStructuresDamaged below). Each
 * successful tile advance also decays the horde's own `size` by its
 * (likewise spawn-fixed) `horde.decayPct`% (compounding) — ground covered is
 * itself a defense, so a horde that's traveled far arrives weaker; a
 * quiet-spawned horde decays much faster than a loud one. Before any of
 * that, every tower in range of the horde's current tile also chips away at
 * it continuously (towerDamagePerSecond) — a horde whose size reaches 0,
 * whether from tower fire or ordinary decay, is destroyed outright and
 * dropped from the returned list. Being in ANY tower's range also multiplies
 * the horde's speed by tweaks.jsonc horde.tower_range_slow_multiplier
 * ("they're distracted, under attack") — stacking with the per-tick damage,
 * not replacing it.
 *
 * The base tile is never stripped from `territory.owned` (it can't be
 * "captured" like a normal tile), and its fight is a one-shot unlike every
 * other tile's "halt and try again next tick": defense is `baseHp` (the
 * base's persisted, repairable HP — data/base.ts:BaseRecord.currentHp) plus
 * its garrison defense — both folded into the caller-supplied `hubs` list,
 * generalized (2026-07-20, Milestone 14) from a single hardcoded base check
 * to cover any number of "defended points" a horde's route might cross,
 * since an Outpost (data/outposts.ts) now needs the exact same one-shot
 * fight the main base always has, just with a different consequence on a
 * loss. If a hub's combined `hp + garrisonDefense` beats the horde's size,
 * the horde is destroyed outright (size zeroed, dropped by the
 * survivingHordes filter below) and `hubDamage[hubKey]` accumulates by the
 * horde's size — a successful defense still costs HP, so repeated assaults
 * demand repair even if none of them individually break through. If the
 * horde's size instead beats that defense, that hub's key is pushed onto
 * `overrunHubKeys` for the caller (App.tsx) to act on: the base's overrun
 * still ends the game (DESIGN.md §13, unchanged); an outpost's overrun
 * instead reverts it to a hostile den (engine/outposts.ts:revertOutpostToDen)
 * — this function itself has no opinion on which, it just reports which
 * hub(s) were overrun this call, by key. A horde's route is computed once
 * at spawn time toward whichever hub (base or outpost) is nearest the
 * spawning den (checkHordeSpawns/findNearestHordeTarget) and fixed for its
 * whole lifetime — this function just walks that precomputed path and
 * checks it against every hub in `hubs`, so a different, non-target hub
 * still takes damage here if it happens to sit on the route.
 */
export function advanceHordes(
  tweaks: Tweaks,
  hordes: HordesRecord,
  territory: TerritoryRecord,
  extractionTiles: ExtractionTile[],
  pathTiles: PathTile[],
  towers: Tower[],
  walls: Wall[],
  barracksList: Barracks[],
  garrisons: GarrisonsRecord,
  hubs: HordeHub[],
  elapsedSeconds: number,
): {
  hordes: HordesRecord;
  territory: TerritoryRecord;
  capturedTiles: Axial[];
  overrunHubKeys: string[];
  hubDamage: Record<string, number>;
} {
  if (elapsedSeconds <= 0 || hordes.length === 0) {
    return { hordes, territory, capturedTiles: [], overrunHubKeys: [], hubDamage: {} };
  }

  let owned = territory.owned;
  const capturedTiles: Axial[] = [];
  const hubsByKey = new Map(hubs.map((h) => [axialKey(h.coord), h]));
  const overrunHubKeys: string[] = [];
  const hubDamage: Record<string, number> = {};

  const nextHordes = hordes.map((horde) => {
    let pathIndex = horde.pathIndex;

    // Every tower in range of the horde's CURRENT tile both chips away at it
    // continuously (using its size at the start of this call — all in-range
    // towers computed off the same snapshot, then applied once, so order
    // between towers doesn't matter within a single tick) AND slows it down
    // ("distracted, under attack") — stacking with its own noise-scaled
    // speedFactor from spawn, not replacing it.
    const inRangeTowers = towersInRange(tweaks, towers, horde.path[pathIndex]);
    const slowFactor = inRangeTowers.length > 0 ? tweaks.horde.tower_range_slow_multiplier : 1;
    const rate = (elapsedSeconds / tweaks.game.tick_interval_seconds) * horde.speedFactor * slowFactor;
    const decayFactor = 1 - horde.decayPct / 100;

    let progress = horde.progress + rate;

    const dps =
      towerDamagePerSecond(tweaks, inRangeTowers, horde.size, garrisons) +
      sniperDamagePerSecond(tweaks, garrisons, walls, horde.path[pathIndex]);
    // Distance traveled is itself a defense — a horde loses decayPct% of its
    // CURRENT size (compounding) for every tile it successfully advances, so
    // one that's crossed a lot of ground arrives attritted.
    let size = Math.max(0, horde.size - dps * elapsedSeconds);

    while (size > 0 && progress >= 1 && pathIndex < horde.path.length - 1) {
      const nextCoord = horde.path[pathIndex + 1];
      const nextKey = axialKey(nextCoord);

      const hub = hubsByKey.get(nextKey);
      if (hub) {
        // One-shot, unlike every other tile: a successful defense doesn't
        // just halt the horde for another try later, it destroys the horde
        // outright — at the cost of hub HP equal to the horde's own size.
        // Losing (horde size >= defense) is unchanged from before: the hub
        // is overrun, still advancing onto the tile and decaying first so
        // the frozen post-loss snapshot looks the same as it always has.
        const hubDefense = hub.hp + hub.garrisonDefense;
        if (hubDefense > size) {
          hubDamage[nextKey] = (hubDamage[nextKey] ?? 0) + size;
          size = 0;
          progress = 0;
        } else {
          pathIndex += 1;
          progress -= 1;
          size = Math.max(0, size * decayFactor);
          overrunHubKeys.push(nextKey);
        }
        break;
      }

      const defense = hordeTileDefense(tweaks, extractionTiles, pathTiles, towers, walls, barracksList, garrisons, nextCoord);
      if (!resolveHordeTileFight(size, defense)) {
        progress = 0;
        break;
      }

      pathIndex += 1;
      progress -= 1;
      size = Math.max(0, size * decayFactor);

      if (owned.some((o) => axialKey(o) === nextKey)) {
        owned = owned.filter((o) => axialKey(o) !== nextKey);
        capturedTiles.push(nextCoord);
      }
    }

    if (pathIndex >= horde.path.length - 1) {
      pathIndex = horde.path.length - 1;
      progress = 0;
    }

    return pathIndex === horde.pathIndex && progress === horde.progress && size === horde.size
      ? horde
      : { ...horde, pathIndex, progress, size };
  });

  // A horde reduced to 0 — by tower fire or plain decay — is destroyed
  // outright rather than lingering as an inert, permanently-losing entry.
  // Rounded rather than an exact `<= 0` check: decay (size *= decayFactor)
  // is multiplicative and asymptotically approaches 0 without ever quite
  // reaching it, so a long-decayed horde would otherwise sit forever at a
  // sliver of a size, still "alive," still blocking the tile it halted on,
  // and still rendered on the map — even though it already reads as 0 there
  // (HexCanvas rounds the displayed size the same way).
  const survivingHordes = nextHordes.some((h) => Math.round(h.size) <= 0)
    ? nextHordes.filter((h) => Math.round(h.size) > 0)
    : nextHordes;

  return {
    hordes: survivingHordes,
    territory: owned === territory.owned ? territory : { ...territory, owned },
    capturedTiles,
    overrunHubKeys,
    hubDamage,
  };
}

type CapturedStructureFields = {
  coord: Axial;
  damaged: boolean;
  upgrade?: unknown | null;
  buildStartedAt?: number | null;
  damageRepair?: { startedAt: number } | null;
  action?: unknown | null;
  trainingQueue?: unknown | null;
};

/** Clears in-flight build/upgrade timers so horde-capture repair is never blocked by stale work. */
function applyHordeCaptureDamage<T extends CapturedStructureFields>(structure: T): T {
  return {
    ...structure,
    damaged: true,
    upgrade: null,
    buildStartedAt: null,
    damageRepair: null,
    action: null,
    trainingQueue: null,
  };
}

export type HordeStructureKind = "extraction tile" | "path" | "tower" | "wall" | "barracks";

export type HordeStructureCaptureEvent = {
  coord: Axial;
  kind: HordeStructureKind;
  cancelledWork: string[];
};

/** Plain-English labels for work cleared when a horde captures a structure's tile. */
export function cancelledWorkLabelsForCapture(structure: CapturedStructureFields): string[] {
  const labels: string[] = [];
  if (structure.buildStartedAt != null) labels.push("Construction cancelled");
  if (structure.upgrade != null) labels.push("Upgrade cancelled");
  if (structure.damageRepair != null) labels.push("Repair cancelled");
  if (structure.action != null) {
    const kind = (structure.action as { kind?: string }).kind;
    if (kind === "repair") labels.push("Wall repair cancelled");
    else if (kind === "upgrade") labels.push("Wall upgrade cancelled");
    else labels.push("Wall work cancelled");
  }
  if (structure.trainingQueue != null) labels.push("Training cancelled");
  return labels;
}

/**
 * One event per structure newly flagged damaged this capture tick — call
 * BEFORE markCapturedStructuresDamaged so cancelled-work labels reflect
 * the pre-capture timers.
 */
export function hordeStructureCaptureEvents(
  capturedTiles: Axial[],
  extractionTiles: CapturedStructureFields[],
  pathTiles: CapturedStructureFields[],
  towers: CapturedStructureFields[],
  walls: CapturedStructureFields[],
  barracksList: CapturedStructureFields[],
): HordeStructureCaptureEvent[] {
  if (capturedTiles.length === 0) return [];

  const events: HordeStructureCaptureEvent[] = [];
  for (const coord of capturedTiles) {
    const key = axialKey(coord);
    const extraction = extractionTiles.find((s) => axialKey(s.coord) === key);
    if (extraction && !extraction.damaged) {
      events.push({ coord, kind: "extraction tile", cancelledWork: cancelledWorkLabelsForCapture(extraction) });
      continue;
    }
    const path = pathTiles.find((s) => axialKey(s.coord) === key);
    if (path && !path.damaged) {
      events.push({ coord, kind: "path", cancelledWork: cancelledWorkLabelsForCapture(path) });
      continue;
    }
    const tower = towers.find((s) => axialKey(s.coord) === key);
    if (tower && !tower.damaged) {
      events.push({ coord, kind: "tower", cancelledWork: cancelledWorkLabelsForCapture(tower) });
      continue;
    }
    const wall = walls.find((s) => axialKey(s.coord) === key);
    if (wall && !wall.damaged) {
      events.push({ coord, kind: "wall", cancelledWork: cancelledWorkLabelsForCapture(wall) });
      continue;
    }
    const barracks = barracksList.find((s) => axialKey(s.coord) === key);
    if (barracks && !barracks.damaged) {
      events.push({ coord, kind: "barracks", cancelledWork: cancelledWorkLabelsForCapture(barracks) });
    }
  }
  return events;
}

/**
 * Flags any structure sitting on a tile a horde just captured as `damaged` —
 * DESIGN.md §12: buildings survive a lost tile but become non-functional
 * until the tile is reclaimed and repaired (see engine/formulas.ts:repairCost).
 * Generic over the five structure arrays (extraction/path/tower/wall/barracks)
 * since they all share `coord` + `damaged`. A no-op (returns the same array
 * reference) when nothing was captured or nothing sits on the captured tiles,
 * so callers can call this unconditionally every tick without extra churn.
 */
export function markCapturedStructuresDamaged<T extends CapturedStructureFields>(
  structures: T[],
  capturedTiles: Axial[],
): T[] {
  if (capturedTiles.length === 0) return structures;
  const capturedKeys = new Set(capturedTiles.map(axialKey));
  let changed = false;
  const next = structures.map((structure) => {
    if (structure.damaged || !capturedKeys.has(axialKey(structure.coord))) return structure;
    changed = true;
    return applyHordeCaptureDamage(structure);
  });
  return changed ? next : structures;
}
