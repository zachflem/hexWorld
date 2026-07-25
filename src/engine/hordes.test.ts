import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import type { Barracks } from "../data/barracks";
import type { DenRecord, DensRecord } from "../data/dens";
import type { ExtractionTile } from "../data/extractionTiles";
import type { Garrison, GarrisonsRecord } from "../data/garrisons";
import type { HordeRecord } from "../data/hordes";
import type { OutpostRecord } from "../data/outposts";
import type { TerritoryRecord } from "../data/territory";
import type { Tower } from "../data/towers";
import type { UnitsRecord } from "../data/units";
import type { Wall } from "../data/walls";
import { tweaksSchema } from "../data/tweaksSchema";
import { structureHp } from "./formulas";
import { axialKey, type Axial } from "./hexCoords";
import {
  advanceHordes,
  checkHordeSpawns,
  hordeTileDefense,
  markCapturedStructuresDamaged,
  preserveCapturedTilesAsScouted,
  hordeStructureCaptureEvents,
  resolveGarrisonAutoAttacks,
  resolveHordeAttack,
  resolveHordeTileFight,
  reconcileHordeWatchtowerAlerts,
  type HordeHub,
} from "./hordes";
import { seededRandom } from "./noise";
import { noiseCap } from "./noiseMeter";
import { towerDamage, towerRange } from "./towers";

// tweaks.horde.level_scaling_base/level_scaling_per_level scale spawnProbability
// down at low base levels — this is the level at which the multiplier caps at
// 1.0 (no reduction), used throughout this file wherever a test needs the old
// "chance=1 at max noise" behavior without the level-scaling term getting in
// the way.
function fullScaleLevel(tweaks: ReturnType<typeof loadRealTweaks>): number {
  const { level_scaling_base, level_scaling_per_level } = tweaks.horde;
  return Math.ceil((1 - level_scaling_base) / level_scaling_per_level) + 1;
}

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

function makeGarrison(coord: Axial, overrides: Partial<Garrison> = {}): Garrison {
  return { coord, militiaCount: 0, junkyardKnightCount: 0, crossBowSniperCount: 0, ...overrides };
}

const seed = 3;
const gridSize = 128;

describe("checkHordeSpawns", () => {
  it("never spawns at zero noise, regardless of elapsed time", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const den: DenRecord = { id: "den-1", coord: base, level: tweaks.dens.max_level, siege: null };
    const territory: TerritoryRecord = { base, owned: [base] };

    const result = checkHordeSpawns(tweaks, [den], [], 0, 1, seed, territory, [], gridSize, Date.now(), 3600);
    expect(result).toHaveLength(0);
  });

  it("never spawns at or below the silent noise floor, regardless of how favorable everything else is", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const den: DenRecord = { id: "den-1", coord: base, level: tweaks.dens.max_level, siege: null };
    const territory: TerritoryRecord = { base, owned: [base] };
    const fullLevel = fullScaleLevel(tweaks);

    const result = checkHordeSpawns(
      tweaks,
      [den],
      [],
      tweaks.horde.no_horde_noise_threshold_db,
      fullLevel,
      seed,
      territory,
      [],
      gridSize,
      Date.now(),
      1e9,
    );
    expect(result).toHaveLength(0);
  });

  it("spawns deterministically when noise is maxed, base level removes the level-scaling penalty, and the den sits right on base (chance=1)", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const den: DenRecord = { id: "den-1", coord: base, level: tweaks.dens.max_level, siege: null };
    const territory: TerritoryRecord = { base, owned: [base] };
    const fullLevel = fullScaleLevel(tweaks);
    const cap = noiseCap(tweaks, fullLevel);

    const result = checkHordeSpawns(tweaks, [den], [], cap, fullLevel, seed, territory, [], gridSize, Date.now(), 10);
    expect(result).toHaveLength(1);
    expect(result[0].originDenId).toBe("den-1");
    expect(result[0].pathIndex).toBe(0);
    expect(result[0].progress).toBe(0);
  });

  it("scales horde size with noise and den level", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const den: DenRecord = { id: "den-1", coord: base, level: tweaks.dens.max_level, siege: null };
    const territory: TerritoryRecord = { base, owned: [base] };
    const fullLevel = fullScaleLevel(tweaks);
    const cap = noiseCap(tweaks, fullLevel);

    const [horde] = checkHordeSpawns(tweaks, [den], [], cap, fullLevel, seed, territory, [], gridSize, Date.now(), 10);
    const { den_level_base_weight, den_level_influence } = tweaks.horde;
    const expectedSize = tweaks.dens.horde_size_base + 100 ** 1.5 * (den_level_base_weight + den_level_influence * 1);
    expect(horde.size).toBeCloseTo(expectedSize);
  });

  it("gives a horde spawned at max noise the max-noise speed/decay endpoints", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const den: DenRecord = { id: "den-1", coord: base, level: tweaks.dens.max_level, siege: null };
    const territory: TerritoryRecord = { base, owned: [base] };
    const fullLevel = fullScaleLevel(tweaks);
    const cap = noiseCap(tweaks, fullLevel); // noisePct = 100 -> spawnProbability exactly 1, deterministic regardless of the roll

    const [horde] = checkHordeSpawns(tweaks, [den], [], cap, fullLevel, seed, territory, [], gridSize, Date.now(), 10);
    expect(horde.speedFactor).toBeCloseTo(tweaks.horde.speed_factor_at_max_noise);
    expect(horde.decayPct).toBeCloseTo(tweaks.horde.size_decay_pct_per_tile_at_max_noise);
  });

  it("interpolates speed/decay linearly between the noise endpoints", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const den: DenRecord = { id: "den-1", coord: base, level: tweaks.dens.max_level, siege: null };
    const territory: TerritoryRecord = { base, owned: [base] };
    const fullLevel = fullScaleLevel(tweaks);
    const halfNoise = noiseCap(tweaks, fullLevel) / 2; // noisePct = 50
    // A huge elapsed span makes spawnProbability underflow to exactly 1 in
    // float64 (same "practically certain" trick used elsewhere in this file
    // for offline-gap tests) — deterministic regardless of the seeded roll,
    // without needing noisePct=100 the way the max-noise test above does.
    // fullLevel keeps the level-scaling multiplier at 1.0 so it doesn't cap
    // spawnProbability below 1 here.
    const hugeElapsed = 1e9;

    const [horde] = checkHordeSpawns(tweaks, [den], [], halfNoise, fullLevel, seed, territory, [], gridSize, Date.now(), hugeElapsed);
    const { speed_factor_at_zero_noise, speed_factor_at_max_noise, size_decay_pct_per_tile_at_zero_noise, size_decay_pct_per_tile_at_max_noise } =
      tweaks.horde;
    expect(horde.speedFactor).toBeCloseTo((speed_factor_at_zero_noise + speed_factor_at_max_noise) / 2);
    expect(horde.decayPct).toBeCloseTo((size_decay_pct_per_tile_at_zero_noise + size_decay_pct_per_tile_at_max_noise) / 2);
  });

  it("scales the effective spawn probability by base level — a fraction of normal at level 1, full at a high enough level", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const den: DenRecord = { id: "den-1", coord: base, level: tweaks.dens.max_level, siege: null };
    const territory: TerritoryRecord = { base, owned: [base] };
    const now = 1_000_000_000_000; // fixed so the seeded roll below is reproducible
    const hugeElapsed = 1e9; // underflows the raw (pre-level-multiplier) spawnProbability to 1
    const noise = tweaks.noise.cap_base; // any noise comfortably above the silent floor

    // Reconstruct the same deterministic per-den roll checkHordeSpawns uses internally.
    const rollIndex = den.coord.q * 92_821 + den.coord.r * 68_917 + Math.floor(now / 1000);
    const roll = seededRandom(seed, rollIndex);

    const atLevel1 = checkHordeSpawns(tweaks, [den], [], noise, 1, seed, territory, [], gridSize, now, hugeElapsed);
    const atFullLevel = checkHordeSpawns(tweaks, [den], [], noise, fullScaleLevel(tweaks), seed, territory, [], gridSize, now, hugeElapsed);

    expect(atLevel1.length > 0).toBe(roll < tweaks.horde.level_scaling_base);
    expect(atFullLevel).toHaveLength(1); // multiplier capped at 1.0 -> always spawns
  });

  it("enforces spawn cooldown per den, independently of other dens", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const denOnCooldown: DenRecord = { id: "den-cool", coord: base, level: tweaks.dens.max_level, siege: null };
    const denReady: DenRecord = { id: "den-ready", coord: base, level: tweaks.dens.max_level, siege: null };
    const territory: TerritoryRecord = { base, owned: [base] };
    const fullLevel = fullScaleLevel(tweaks);
    const cap = noiseCap(tweaks, fullLevel);
    const now = Date.now();

    const recentHorde: HordeRecord = {
      id: "existing",
      originDenId: "den-cool",
      size: 10,
      path: [base],
      pathIndex: 0,
      progress: 0,
      spawnedAt: now - 60_000, // 1 minute ago, well within the 5-minute cooldown
      speedFactor: 1,
      decayPct: 0,
    };

    const result = checkHordeSpawns(tweaks, [denOnCooldown, denReady], [recentHorde], cap, fullLevel, seed, territory, [], gridSize, now, 10);
    const newlySpawned = result.filter((h) => h.id !== "existing");
    expect(newlySpawned).toHaveLength(1);
    expect(newlySpawned[0].originDenId).toBe("den-ready");
    expect(result).toHaveLength(2); // the pre-existing "den-cool" horde, plus the one new "den-ready" spawn
  });

  it("does nothing with no dens or non-positive elapsed time", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: { q: 0, r: 0 }, owned: [] };
    const emptyDens: DensRecord = [];
    expect(checkHordeSpawns(tweaks, emptyDens, [], 999, 1, seed, territory, [], gridSize, Date.now(), 10)).toEqual([]);

    const den: DenRecord = { id: "den-1", coord: territory.base, level: 1, siege: null };
    expect(checkHordeSpawns(tweaks, [den], [], 999, 1, seed, territory, [], gridSize, Date.now(), 0)).toEqual([]);
  });

  it("paths a spawning horde to the nearest hub (an outpost) instead of always the base", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    // Den sits one tile from the outpost but far (50 tiles) from base — even
    // at the worst-case terrain-cost ratio (mountain 4x vs grassland 1x,
    // tweaks.jsonc horde.pathfinding.terrain_cost), one hop to the outpost
    // can never cost more than a 50-tile trek to base, so the outpost is
    // unambiguously nearest regardless of the seeded terrain layout.
    const denCoord = { q: 1, r: 0 };
    const outpost: OutpostRecord = {
      id: "outpost-1",
      coord: { q: 2, r: 0 },
      reinforcementLevel: 1,
      currentHp: 100,
      reinforcementAction: null,
      convertedAt: 0,
      originalDenLevel: 1,
    };
    const den: DenRecord = { id: "den-1", coord: denCoord, level: tweaks.dens.max_level, siege: null };
    const territory: TerritoryRecord = { base, owned: [base] };
    const fullLevel = fullScaleLevel(tweaks);
    const cap = noiseCap(tweaks, fullLevel);
    const hugeElapsed = 1e9; // underflows spawnProbability to 1, deterministic regardless of the seeded roll — same trick as the other spawn tests above

    const [horde] = checkHordeSpawns(tweaks, [den], [], cap, fullLevel, seed, territory, [outpost], gridSize, Date.now(), hugeElapsed);
    expect(horde).toBeDefined();
    const lastTile = horde.path[horde.path.length - 1];
    expect(axialKey(lastTile)).toBe(axialKey(outpost.coord));
  });
});

describe("hordeTileDefense / resolveHordeTileFight", () => {
  it("is 0 for an undefended tile", () => {
    const tweaks = loadRealTweaks();
    expect(hordeTileDefense(tweaks, [], [], [], [], [], { q: 0, r: 0 })).toBe(0);
  });

  it("uses towerDamage as a placeholder defense value for a tower tile", () => {
    const tweaks = loadRealTweaks();
    const coord = { q: 0, r: 0 };
    const tower: Tower = { coord, level: 2, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false };
    expect(hordeTileDefense(tweaks, [], [tower], [], [], [], coord)).toBeCloseTo(towerDamage(tweaks, 2));
  });

  it("uses wall durability as a placeholder defense value for a wall tile", () => {
    const tweaks = loadRealTweaks();
    const coord = { q: 0, r: 0 };
    const wall: Wall = { coord, tier: "wood", durability: 123, totalInvested: {}, action: null, buildCost: {}, damaged: false };
    expect(hordeTileDefense(tweaks, [], [], [wall], [], [], coord)).toBe(123);
  });

  it("resolves deterministically: horde wins iff size >= defense", () => {
    expect(resolveHordeTileFight(50, 50)).toBe(true);
    expect(resolveHordeTileFight(50, 49)).toBe(true);
    expect(resolveHordeTileFight(50, 51)).toBe(false);
  });

  it("treats a damaged tower as 0 defense — a captured structure can't defend the tile that overran it", () => {
    const tweaks = loadRealTweaks();
    const coord = { q: 0, r: 0 };
    const tower: Tower = { coord, level: 4, totalInvested: {}, upgrade: null, buildCost: {}, damaged: true };
    expect(hordeTileDefense(tweaks, [], [tower], [], [], [], coord)).toBe(0);
  });

  it("treats a damaged wall as 0 defense regardless of its remaining durability", () => {
    const tweaks = loadRealTweaks();
    const coord = { q: 0, r: 0 };
    const wall: Wall = {
      coord,
      tier: "steel",
      durability: 999_999,
      totalInvested: {},
      action: null,
      buildCost: {},
      damaged: true,
    };
    expect(hordeTileDefense(tweaks, [], [], [wall], [], [], coord)).toBe(0);
  });

  it("stacks a garrison additively on top of a tower's defense", () => {
    const tweaks = loadRealTweaks();
    const coord = { q: 0, r: 0 };
    const tower: Tower = { coord, level: 2, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false };
    const garrisons: GarrisonsRecord = [makeGarrison(coord, { militiaCount: 5 })];
    const expected = towerDamage(tweaks, 2) + 5 * tweaks.units.militia.defense_per_unit;
    expect(hordeTileDefense(tweaks, [], [tower], [], [], garrisons, coord)).toBeCloseTo(expected);
  });

  it("lets a garrison alone defend a bare tile with no tower or wall", () => {
    const tweaks = loadRealTweaks();
    const coord = { q: 0, r: 0 };
    const garrisons: GarrisonsRecord = [makeGarrison(coord, { militiaCount: 3 })];
    expect(hordeTileDefense(tweaks, [], [], [], [], garrisons, coord)).toBe(3 * tweaks.units.militia.defense_per_unit);
  });

  it("gives an extraction tile structural defense derived from its total invested resources", () => {
    const tweaks = loadRealTweaks();
    const coord = { q: 0, r: 0 };
    const extraction: ExtractionTile = {
      coord,
      resource: "wood",
      tier: "small",
      stockpile: 0,
      totalInvested: { wood: 100 },
      upgrade: null,
      buildCost: { wood: 100 },
      damaged: false,
    };
    expect(hordeTileDefense(tweaks, [extraction], [], [], [], [], coord)).toBeCloseTo(structureHp(tweaks, { wood: 100 }));
  });

  it("treats a damaged extraction tile as 0 structural defense", () => {
    const tweaks = loadRealTweaks();
    const coord = { q: 0, r: 0 };
    const extraction: ExtractionTile = {
      coord,
      resource: "wood",
      tier: "small",
      stockpile: 0,
      totalInvested: { wood: 100 },
      upgrade: null,
      buildCost: { wood: 100 },
      damaged: true,
    };
    expect(hordeTileDefense(tweaks, [extraction], [], [], [], [], coord)).toBe(0);
  });

  it("gives a barracks structural defense derived from its total invested resources", () => {
    const tweaks = loadRealTweaks();
    const coord = { q: 0, r: 0 };
    const barracks: Barracks = {
      coord,
      level: 1,
      totalInvested: { wood: 200, stone: 100 },
      upgrade: null,
      buildCost: { wood: 200, stone: 100 },
      damaged: false,
    };
    expect(hordeTileDefense(tweaks, [], [], [], [barracks], [], coord)).toBeCloseTo(
      structureHp(tweaks, { wood: 200, stone: 100 }),
    );
  });

  it("treats a damaged barracks as 0 structural defense", () => {
    const tweaks = loadRealTweaks();
    const coord = { q: 0, r: 0 };
    const barracks: Barracks = {
      coord,
      level: 1,
      totalInvested: { wood: 200, stone: 100 },
      upgrade: null,
      buildCost: { wood: 200, stone: 100 },
      damaged: true,
    };
    expect(hordeTileDefense(tweaks, [], [], [], [barracks], [], coord)).toBe(0);
  });
});

describe("resolveHordeAttack", () => {
  it("resolves deterministically: garrison wins iff its total attack power >= horde size", () => {
    const tweaks = loadRealTweaks();
    const perUnit = tweaks.units.militia.attack_per_unit;
    const garrison = makeGarrison({ q: 0, r: 0 }, { militiaCount: 10 });
    expect(resolveHordeAttack(tweaks, garrison, 10 * perUnit)).toBe(true);
    expect(resolveHordeAttack(tweaks, garrison, 10 * perUnit - 1)).toBe(true);
    expect(resolveHordeAttack(tweaks, garrison, 10 * perUnit + 1)).toBe(false);
  });

  it("sums attack power across militia, junkyard knights, and cross-bow snipers", () => {
    const tweaks = loadRealTweaks();
    const garrison = makeGarrison({ q: 0, r: 0 }, { militiaCount: 5, junkyardKnightCount: 2, crossBowSniperCount: 1 });
    const attackPower =
      5 * tweaks.units.militia.attack_per_unit +
      2 * tweaks.units.junkyard_knight.attack_per_unit +
      1 * tweaks.units.cross_bow_sniper.attack_per_unit;
    expect(resolveHordeAttack(tweaks, garrison, attackPower)).toBe(true);
    expect(resolveHordeAttack(tweaks, garrison, attackPower + 1)).toBe(false);
  });
});

describe("resolveGarrisonAutoAttacks", () => {
  const units = (militiaCount: number): UnitsRecord => ({
    militiaCount,
    junkyardKnightCount: 0,
    crossBowSniperCount: 0,
  });

  function horde(overrides: Partial<HordeRecord> = {}): HordeRecord {
    return {
      id: "h1",
      originDenId: "den-1",
      size: 10,
      path: [{ q: 0, r: 0 }],
      pathIndex: 0,
      progress: 0,
      spawnedAt: 0,
      speedFactor: 1,
      decayPct: 5,
      ...overrides,
    };
  }

  it("destroys a horde on the garrison's own tile, no manual action needed", () => {
    const tweaks = loadRealTweaks();
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { militiaCount: 100 })];
    const hordes = [horde({ size: 1 })];
    const startingUnits = units(100);

    const result = resolveGarrisonAutoAttacks(tweaks, garrisons, hordes, startingUnits, []);
    expect(result.anyAutoAttack).toBe(true);
    expect(result.hordes).toEqual([]);
    expect(result.garrisons).toEqual(garrisons); // untouched — the garrison won, no losses
    expect(result.units).toBe(startingUnits); // reference-equal: nothing changed on a win
  });

  it("destroys a horde on an adjacent tile", () => {
    const tweaks = loadRealTweaks();
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 5, r: 5 }, { militiaCount: 100 })];
    const hordes = [horde({ size: 1, path: [{ q: 6, r: 5 }] })];

    const result = resolveGarrisonAutoAttacks(tweaks, garrisons, hordes, units(100), []);
    expect(result.hordes).toEqual([]);
  });

  it("wipes the garrison and debits the standing army when the auto-attack loses", () => {
    const tweaks = loadRealTweaks();
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { militiaCount: 1 })];
    const hordes = [horde({ size: 999_999 })];

    const result = resolveGarrisonAutoAttacks(tweaks, garrisons, hordes, units(1), []);
    expect(result.anyAutoAttack).toBe(true);
    expect(result.garrisons).toEqual([]);
    expect(result.hordes).toEqual(hordes); // horde untouched on a loss
    expect(result.units.militiaCount).toBe(0);
  });

  it("does nothing when no horde is within reach", () => {
    const tweaks = loadRealTweaks();
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { militiaCount: 100 })];
    const hordes = [horde({ size: 1, path: [{ q: 10, r: 10 }] })];

    const result = resolveGarrisonAutoAttacks(tweaks, garrisons, hordes, units(100), []);
    expect(result.anyAutoAttack).toBe(false);
    expect(result.garrisons).toBe(garrisons);
    expect(result.hordes).toBe(hordes);
  });

  it("doesn't double-attack a horde already destroyed earlier in the same pass", () => {
    const tweaks = loadRealTweaks();
    const garrisons: GarrisonsRecord = [
      makeGarrison({ q: 0, r: 0 }, { militiaCount: 100 }),
      makeGarrison({ q: 1, r: 0 }, { militiaCount: 100 }),
    ];
    const hordes = [horde({ size: 1 })]; // reachable from both garrisons

    const result = resolveGarrisonAutoAttacks(tweaks, garrisons, hordes, units(200), []);
    expect(result.hordes).toEqual([]);
    // Both garrisons survive — the first kill removed the horde, so the
    // second garrison found nothing left to fight.
    expect(result.garrisons).toEqual(garrisons);
  });

  it("is a no-op when there are no garrisons or no hordes", () => {
    const tweaks = loadRealTweaks();
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { militiaCount: 100 })];
    expect(resolveGarrisonAutoAttacks(tweaks, [], [horde()], units(100), []).anyAutoAttack).toBe(false);
    expect(resolveGarrisonAutoAttacks(tweaks, garrisons, [], units(100), []).anyAutoAttack).toBe(false);
  });
});

describe("advanceHordes", () => {
  const path = [
    { q: 0, r: 0 },
    { q: 1, r: 0 },
    { q: 2, r: 0 },
    { q: 3, r: 0 },
    { q: 4, r: 0 },
  ];

  function makeHorde(overrides: Partial<HordeRecord> = {}): HordeRecord {
    return {
      id: "h1",
      originDenId: "den-1",
      size: 50,
      path,
      pathIndex: 0,
      progress: 0,
      spawnedAt: 0,
      speedFactor: 1,
      decayPct: 5,
      ...overrides,
    };
  }

  /** A single base hub at path[4] (== every test's territory.base here) — the old baseHp/baseGarrisonDefense pair, now the hubs[] list advanceHordes takes. */
  function hubs(hp: number, garrisonDefense = 0): HordeHub[] {
    return [{ coord: path[4], hp, garrisonDefense, kind: "base", id: "base" }];
  }

  const baseKey = axialKey(path[4]);

  it("advances exactly N tiles for N whole tick intervals of elapsed time (closed-form)", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    const elapsed = tweaks.game.tick_interval_seconds * 3;

    const { hordes } = advanceHordes(tweaks, [makeHorde()], territory, [], [], [], [], [], hubs(0), elapsed, 0);
    expect(hordes[0].pathIndex).toBe(3);
    expect(hordes[0].progress).toBeCloseTo(0);
  });

  it("caps at the final tile and stays there for an arbitrarily long elapsed gap", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    const elapsed = tweaks.game.tick_interval_seconds * 10_000; // a huge, multi-year-equivalent gap

    const { hordes } = advanceHordes(tweaks, [makeHorde()], territory, [], [], [], [], [], hubs(0), elapsed, 0);
    expect(hordes[0].pathIndex).toBe(path.length - 1);
    expect(hordes[0].progress).toBe(0);
  });

  it("removes a captured tile from territory.owned", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [path[1], path[2]] };
    const elapsed = tweaks.game.tick_interval_seconds * 1;

    const { territory: nextTerritory } = advanceHordes(tweaks, [makeHorde()], territory, [], [], [], [], [], hubs(0), elapsed, 0);
    expect(nextTerritory.owned).toEqual([path[2]]);
  });

  it("leaves territory/towers/walls untouched when nothing advances", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [path[1]] };
    const towers: Tower[] = [];
    const walls: Wall[] = [];

    const result = advanceHordes(tweaks, [], territory, [], towers, walls, [], [], hubs(0), 100, 0);
    expect(result.territory).toBe(territory);
    expect(result.hordes).toEqual([]);
  });

  it("never removes the base tile from territory.owned, even once a horde overruns it", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [path[1], path[2], path[3], path[4]] };
    const elapsed = tweaks.game.tick_interval_seconds * 10_000; // reach and sit at the base

    const { hordes, territory: nextTerritory, overrunHubKeys } = advanceHordes(
      tweaks,
      [makeHorde()],
      territory,
      [],
      [],
      [],
      [],
      [],
      hubs(0), // no reinforcement HP, no garrison defense — an undefended base always falls
      elapsed,
      0,
    );
    expect(hordes[0].pathIndex).toBe(path.length - 1);
    expect(nextTerritory.owned).toEqual([path[4]]);
    expect(overrunHubKeys).toContain(baseKey);
  });

  it("destroys the horde and costs base HP equal to its size when reinforcement holds, rather than an instant loss", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [path[1], path[2], path[3], path[4]] };
    const elapsed = tweaks.game.tick_interval_seconds * 10_000;
    const size = 50;
    // Starts adjacent to the base so its size arrives undecayed — isolates
    // the base-fight outcome from ordinary per-tile travel decay, covered
    // separately by the "decays size by the horde's own decayPct" test.
    const horde = makeHorde({ size, pathIndex: path.length - 2, progress: 0 });

    const { hordes, overrunHubKeys, hubDamage } = advanceHordes(
      tweaks,
      [horde],
      territory,
      [],
      [],
      [],
      [],
      [],
      hubs(999_999), // reinforcement comfortably beats the horde
      elapsed,
      0,
    );
    // Destroyed outright — unlike every other tile, a successful base
    // defense doesn't halt the horde for another try, it ends the fight.
    expect(hordes).toEqual([]);
    expect(overrunHubKeys).not.toContain(baseKey);
    expect(hubDamage[baseKey]).toBe(size);
  });

  it("still reports baseOverrun=true (and no baseDamageTaken) when the horde's size beats the defense", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [path[1], path[2], path[3], path[4]] };
    const elapsed = tweaks.game.tick_interval_seconds * 10_000;

    const { hordes, overrunHubKeys, hubDamage } = advanceHordes(
      tweaks,
      [makeHorde({ size: 50 })],
      territory,
      [],
      [],
      [],
      [],
      [],
      hubs(10), // reinforcement HP far too low to hold
      elapsed,
      0,
    );
    expect(hordes[0].pathIndex).toBe(path.length - 1);
    expect(overrunHubKeys).toContain(baseKey);
    expect(hubDamage[baseKey] ?? 0).toBe(0);
  });

  it("treats an outpost sitting on the horde's route as an independent hub — overrun there, then still fought again at the base on a later call", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    const elapsed = tweaks.game.tick_interval_seconds * 10_000;
    const size = 50;
    const outpostKey = axialKey(path[2]);

    const twoHubs: HordeHub[] = [
      { coord: path[2], hp: 5, garrisonDefense: 0, kind: "outpost", id: "outpost-1" },
      { coord: path[4], hp: 999_999, garrisonDefense: 0, kind: "base", id: "base" },
    ];

    // A hub fight — win or lose — is a one-shot, terminal event for a horde
    // within a single advanceHordes call (it `break`s out of that horde's
    // movement loop), the same way the base fight always has been. So the
    // weak outpost and the strong base can't both resolve in one call here;
    // this exercises that behavior across two ticks instead of pretending
    // it's a single continuous walk.
    const first = advanceHordes(tweaks, [makeHorde({ size })], territory, [], [], [], [], [], twoHubs, elapsed, 0);
    expect(first.overrunHubKeys).toEqual([outpostKey]);
    expect(first.hubDamage[outpostKey]).toBeUndefined();
    expect(first.hordes).toHaveLength(1);
    const decayedSize = first.hordes[0].size;
    expect(decayedSize).toBeLessThan(size);

    const second = advanceHordes(tweaks, first.hordes, territory, [], [], [], [], [], twoHubs, elapsed, 0);

    // The much stronger base destroys the surviving, already-decayed horde
    // outright — proving the outpost and base fights resolved independently
    // rather than sharing one combined defense.
    expect(second.overrunHubKeys).toEqual([]);
    expect(second.hordes).toEqual([]);
    // Further decayed by the remaining tiles walked between the outpost and
    // the base before this second fight.
    expect(second.hubDamage[baseKey]).toBeGreaterThan(0);
    expect(second.hubDamage[baseKey]).toBeLessThan(decayedSize);
  });

  it("halts at a tile it can't beat, and stays halted rather than skipping ahead", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    const wall: Wall = { coord: path[2], tier: "wood", durability: 999_999, totalInvested: {}, action: null, buildCost: {}, damaged: false };
    const elapsed = tweaks.game.tick_interval_seconds * 5; // enough to reach the end if unopposed

    const { hordes } = advanceHordes(tweaks, [makeHorde({ size: 50 })], territory, [], [], [wall], [], [], hubs(0), elapsed, 0);
    expect(hordes[0].pathIndex).toBe(1); // captured path[1], then stopped short of path[2]
    expect(hordes[0].progress).toBe(0);
  });

  it("reports every tile captured this call via capturedTiles", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [path[1], path[2]] };
    const elapsed = tweaks.game.tick_interval_seconds * 2;

    const { capturedTiles } = advanceHordes(tweaks, [makeHorde()], territory, [], [], [], [], [], hubs(0), elapsed, 0);
    expect(capturedTiles).toEqual([path[1], path[2]]);
  });

  it("reports no captured tiles when nothing advances", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    expect(advanceHordes(tweaks, [], territory, [], [], [], [], [], hubs(0), 100, 0).capturedTiles).toEqual([]);
    expect(advanceHordes(tweaks, [makeHorde()], territory, [], [], [], [], [], hubs(0), 0, 0).capturedTiles).toEqual([]);
  });

  it("decays size by the horde's own decayPct, compounding, per tile advanced", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    const elapsed = tweaks.game.tick_interval_seconds * 3;
    const decayPct = 5;
    const decayFactor = 1 - decayPct / 100;

    const { hordes } = advanceHordes(tweaks, [makeHorde({ size: 100, decayPct })], territory, [], [], [], [], [], hubs(0), elapsed, 0);
    expect(hordes[0].pathIndex).toBe(3); // 3 tiles advanced -> decay applied 3 times
    expect(hordes[0].size).toBeCloseTo(100 * decayFactor ** 3);
  });

  it("advances slower for a lower speedFactor (a quiet-spawned horde crawls)", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    const elapsed = tweaks.game.tick_interval_seconds * 3; // enough for 3 tiles at speedFactor=1

    const { hordes } = advanceHordes(
      tweaks,
      [makeHorde({ speedFactor: 0.5 })],
      territory,
      [],
      [],
      [],
      [],
      [],
      hubs(0),
      elapsed,
      0,
    );
    expect(hordes[0].pathIndex).toBe(1); // half speed -> 1.5 tiles worth of progress, only 1 whole tile crossed
    expect(hordes[0].progress).toBeCloseTo(0.5);
  });

  it("leaves size untouched when the horde doesn't advance", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    const wall: Wall = {
      coord: path[1],
      tier: "steel",
      durability: 999_999,
      totalInvested: {},
      action: null,
      buildCost: {},
      damaged: false,
    };
    const elapsed = tweaks.game.tick_interval_seconds * 3;

    const { hordes } = advanceHordes(tweaks, [makeHorde({ size: 50 })], territory, [], [], [wall], [], [], hubs(0), elapsed, 0);
    expect(hordes[0].pathIndex).toBe(0);
    expect(hordes[0].size).toBe(50);
  });

  it("lets a garrison alone halt a horde at a bare tile, same as a tower or wall would", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    const garrisons: GarrisonsRecord = [makeGarrison(path[2], { militiaCount: 999_999 })];
    const elapsed = tweaks.game.tick_interval_seconds * 5; // enough to reach the end if unopposed

    const { hordes } = advanceHordes(tweaks, [makeHorde({ size: 50 })], territory, [], [], [], [], garrisons, hubs(0), elapsed, 0);
    expect(hordes[0].pathIndex).toBe(1); // captured path[1], then stopped short of path[2]
    expect(hordes[0].progress).toBe(0);
  });

  it("destroys a horde outright once decay brings it to 0, rather than leaving it at 0 forever", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    const elapsed = tweaks.game.tick_interval_seconds * 3;

    const { hordes } = advanceHordes(
      tweaks,
      [makeHorde({ size: 100, decayPct: 100 })],
      territory,
      [],
      [],
      [],
      [],
      [],
      hubs(0),
      elapsed,
      0,
    );
    expect(hordes).toEqual([]);
  });

  it("towers within range chip away at a horde continuously, destroying it if size hits 0", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    const tower: Tower = {
      coord: path[0],
      level: 4,
      totalInvested: {},
      upgrade: null,
      buildCost: {},
      damaged: false,
    };
    // A tiny horde, one huge tick — comfortably enough tower dps to wipe it.
    const elapsed = tweaks.game.tick_interval_seconds * 100;

    const { hordes } = advanceHordes(
      tweaks,
      [makeHorde({ size: 1, speedFactor: 0 })], // speedFactor 0 isolates tower damage from tile-advance/decay
      territory,
      [],
      [tower],
      [],
      [],
      [],
      hubs(0),
      elapsed,
      0,
    );
    expect(hordes).toEqual([]);
  });

  it("militia garrisoned on a tower's own tile add their attack power onto that tower's per-tick damage", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    const tower: Tower = {
      coord: path[0],
      level: 1,
      totalInvested: {},
      upgrade: null,
      buildCost: {},
      damaged: false,
    };
    const garrisons: GarrisonsRecord = [makeGarrison(path[0], { militiaCount: 5 })];
    // One full tick_interval of elapsed time makes dps*elapsed equal zombiesKilledPerTick exactly.
    const elapsed = tweaks.game.tick_interval_seconds;
    const size = 1000;

    const { hordes: withoutGarrison } = advanceHordes(
      tweaks,
      [makeHorde({ size, speedFactor: 0 })],
      territory,
      [],
      [tower],
      [],
      [],
      [],
      hubs(0),
      elapsed,
      0,
    );
    const { hordes: withGarrison } = advanceHordes(
      tweaks,
      [makeHorde({ size, speedFactor: 0 })],
      territory,
      [],
      [tower],
      [],
      [],
      garrisons,
      hubs(0),
      elapsed,
      0,
    );

    const expectedBonusDamage =
      5 * tweaks.towers.garrison_damage_bonus_per_militia * (size / 100);
    expect(withoutGarrison[0].size - withGarrison[0].size).toBeCloseTo(expectedBonusDamage, 5);
  });

  it("cross-bow snipers garrisoned within range deal continuous ranged damage, with no tower needed", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    // Garrisoned one tile away from the horde's starting tile — within
    // range_tiles, no tower present at all.
    const garrisons: GarrisonsRecord = [makeGarrison(path[1], { crossBowSniperCount: 4 })];
    const elapsed = tweaks.game.tick_interval_seconds;

    const { hordes } = advanceHordes(
      tweaks,
      [makeHorde({ size: 1000, speedFactor: 0 })],
      territory,
      [],
      [],
      [],
      [],
      garrisons,
      hubs(0),
      elapsed,
      0,
    );
    const expectedDamage = 4 * tweaks.units.cross_bow_sniper.ranged_damage_per_unit;
    expect(1000 - hordes[0].size).toBeCloseTo(expectedDamage, 5);
  });

  it("a cross-bow sniper garrison out of range deals no ranged damage", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    const farAway = { q: 50, r: 50 };
    const garrisons: GarrisonsRecord = [makeGarrison(farAway, { crossBowSniperCount: 4 })];
    const elapsed = tweaks.game.tick_interval_seconds;

    const { hordes } = advanceHordes(
      tweaks,
      [makeHorde({ size: 1000, speedFactor: 0 })],
      territory,
      [],
      [],
      [],
      [],
      garrisons,
      hubs(0),
      elapsed,
      0,
    );
    expect(hordes[0].size).toBe(1000);
  });

  it("a damaged tower deals no per-tick damage, same as it contributes no tile defense", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    const tower: Tower = {
      coord: path[0],
      level: 4,
      totalInvested: {},
      upgrade: null,
      buildCost: {},
      damaged: true,
    };
    const elapsed = tweaks.game.tick_interval_seconds * 100;

    const { hordes } = advanceHordes(
      tweaks,
      [makeHorde({ size: 1, speedFactor: 0 })],
      territory,
      [],
      [tower],
      [],
      [],
      [],
      hubs(0),
      elapsed,
      0,
    );
    expect(hordes).toHaveLength(1);
    expect(hordes[0].size).toBe(1);
  });

  it("a tower out of range deals no damage", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    const farAway = { q: 50, r: 50 };
    const tower: Tower = {
      coord: farAway,
      level: 4,
      totalInvested: {},
      upgrade: null,
      buildCost: {},
      damaged: false,
    };
    const elapsed = tweaks.game.tick_interval_seconds * 100;

    const { hordes } = advanceHordes(
      tweaks,
      [makeHorde({ size: 1, speedFactor: 0 })],
      territory,
      [],
      [tower],
      [],
      [],
      [],
      hubs(0),
      elapsed,
      0,
    );
    expect(hordes).toHaveLength(1);
    expect(hordes[0].size).toBe(1);
  });

  it("advances at half rate while within a tower's range — distracted, under attack", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base: path[4], owned: [] };
    // Positioned right on the horde's starting tile, so it's in range for the
    // whole tick regardless of towerRange() at any level.
    const tower: Tower = {
      coord: path[0],
      level: 1,
      totalInvested: {},
      upgrade: null,
      buildCost: {},
      damaged: false,
    };
    expect(towerRange(tweaks, 1, "grassland")).toBeGreaterThanOrEqual(0);
    // Huge size so the tower's per-tick damage can't meaningfully dent it —
    // isolates the slowdown effect from the size-decay/tower-dps effects
    // covered by the other tests in this block.
    const size = 1e9;
    const elapsed = tweaks.game.tick_interval_seconds * 2; // unslowed, this would advance exactly 2 tiles

    const slowed = advanceHordes(
      tweaks,
      [makeHorde({ size, decayPct: 0 })],
      territory,
      [],
      [tower],
      [],
      [],
      [],
      hubs(0),
      elapsed,
      0,
    );
    const unslowed = advanceHordes(tweaks, [makeHorde({ size, decayPct: 0 })], territory, [], [], [], [], [], hubs(0), elapsed, 0);

    expect(unslowed.hordes[0].pathIndex).toBe(2);
    expect(slowed.hordes[0].pathIndex).toBe(1);
    expect(slowed.hordes[0].progress).toBeCloseTo(0);
  });
});

describe("markCapturedStructuresDamaged", () => {
  const a = { coord: { q: 0, r: 0 }, damaged: false };
  const b = { coord: { q: 1, r: 0 }, damaged: false };

  it("flags only the structures sitting on captured tiles", () => {
    const result = markCapturedStructuresDamaged([a, b], [{ q: 1, r: 0 }]);
    expect(result[0].damaged).toBe(false);
    expect(result[1].damaged).toBe(true);
  });

  it("returns the same array reference when nothing was captured", () => {
    const structures = [a, b];
    expect(markCapturedStructuresDamaged(structures, [])).toBe(structures);
  });

  it("returns the same array reference when no structure sits on a captured tile", () => {
    const structures = [a, b];
    expect(markCapturedStructuresDamaged(structures, [{ q: 9, r: 9 }])).toBe(structures);
  });

  it("leaves an already-damaged structure untouched (no redundant re-flagging)", () => {
    const alreadyDamaged = { coord: { q: 0, r: 0 }, damaged: true };
    const structures = [alreadyDamaged];
    const result = markCapturedStructuresDamaged(structures, [{ q: 0, r: 0 }]);
    expect(result).toBe(structures);
    expect(result[0]).toBe(alreadyDamaged);
  });

  it("clears in-flight upgrade/build timers so horde repair is not blocked afterward", () => {
    const tower = {
      coord: { q: 0, r: 0 },
      damaged: false,
      upgrade: { targetLevel: 2, startedAt: 0 },
      buildStartedAt: 99,
    };
    const [result] = markCapturedStructuresDamaged([tower], [{ q: 0, r: 0 }]);
    expect(result.damaged).toBe(true);
    expect(result.upgrade).toBeNull();
    expect(result.buildStartedAt).toBeNull();
  });
});

describe("preserveCapturedTilesAsScouted", () => {
  it("appends newly captured tiles that were never scouted", () => {
    const scouted = [{ q: 0, r: 0 }];
    const result = preserveCapturedTilesAsScouted(scouted, [
      { q: 1, r: 0 },
      { q: 2, r: 0 },
    ]);
    expect(result).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
    ]);
  });

  it("does not duplicate tiles already in scoutedTiles", () => {
    const scouted = [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
    ];
    const result = preserveCapturedTilesAsScouted(scouted, [
      { q: 1, r: 0 },
      { q: 2, r: 0 },
    ]);
    expect(result).toEqual([
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: 2, r: 0 },
    ]);
  });

  it("returns the same array reference when nothing was captured", () => {
    const scouted = [{ q: 0, r: 0 }];
    expect(preserveCapturedTilesAsScouted(scouted, [])).toBe(scouted);
  });

  it("returns the same array reference when every captured tile was already scouted", () => {
    const scouted = [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
    ];
    expect(preserveCapturedTilesAsScouted(scouted, [{ q: 1, r: 0 }])).toBe(scouted);
  });
});

describe("hordeStructureCaptureEvents", () => {
  it("reports cancelled upgrade work from the pre-capture snapshot", () => {
    const tower = {
      coord: { q: 2, r: 0 },
      damaged: false,
      upgrade: { targetLevel: 2, startedAt: 0 },
    };
    const events = hordeStructureCaptureEvents([{ q: 2, r: 0 }], [], [tower], [], []);
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("tower");
    expect(events[0].cancelledWork).toContain("Upgrade cancelled");
  });

  it("skips already-damaged structures", () => {
    const tower = { coord: { q: 0, r: 0 }, damaged: true, upgrade: null };
    expect(hordeStructureCaptureEvents([{ q: 0, r: 0 }], [], [tower], [], [])).toHaveLength(0);
  });
});

describe("reconcileHordeWatchtowerAlerts", () => {
  it("alerts only on first entry, then again after leave and re-enter", () => {
    const first = reconcileHordeWatchtowerAlerts(["h1"], new Set());
    expect(first.newlyAlertedIds).toEqual(["h1"]);
    expect([...first.nextAlerted]).toEqual(["h1"]);

    const still = reconcileHordeWatchtowerAlerts(["h1"], first.nextAlerted);
    expect(still.newlyAlertedIds).toEqual([]);

    const left = reconcileHordeWatchtowerAlerts([], still.nextAlerted);
    expect([...left.nextAlerted]).toEqual([]);

    const reenter = reconcileHordeWatchtowerAlerts(["h1"], left.nextAlerted);
    expect(reenter.newlyAlertedIds).toEqual(["h1"]);
  });
});
