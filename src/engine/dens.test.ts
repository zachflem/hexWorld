import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import type { DenRecord, DenSiegeState } from "../data/dens";
import type { GarrisonsRecord } from "../data/garrisons";
import type { Tower } from "../data/towers";
import type { Wall } from "../data/walls";
import { denAssaultSurvivors, denDefense, holdDefenseAt, lastStandWaveSize, resolveDenAssault, resolveHoldPeriod } from "./dens";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

function makeDen(overrides: Partial<DenRecord> = {}): DenRecord {
  return { id: "den-1", coord: { q: 0, r: 0 }, level: 1, siege: null, ...overrides };
}

describe("denDefense", () => {
  it("is den_defense_base at level 1", () => {
    const tweaks = loadRealTweaks();
    expect(denDefense(tweaks, 1)).toBe(tweaks.dens.siege.den_defense_base);
  });

  it("scales linearly with level", () => {
    const tweaks = loadRealTweaks();
    const { den_defense_base, den_defense_per_level } = tweaks.dens.siege;
    expect(denDefense(tweaks, 3)).toBeCloseTo(den_defense_base + den_defense_per_level * 2);
  });
});

describe("resolveDenAssault", () => {
  it("starts the siege hold on a win (attackPower >= denDefense), zeroed at the given time", () => {
    const tweaks = loadRealTweaks();
    const den = makeDen({ level: 1 });
    const attackPower = denDefense(tweaks, 1);
    const now = 12_345;

    const result = resolveDenAssault(tweaks, den, attackPower, now);

    expect(result.won).toBe(true);
    expect(result.den.siege).toEqual({ startedAt: now, lastWaveAt: now, waveIndex: 0 });
  });

  it("leaves the den untouched on a loss (attackPower < denDefense)", () => {
    const tweaks = loadRealTweaks();
    const den = makeDen({ level: 5 });
    const attackPower = denDefense(tweaks, 5) - 1;

    const result = resolveDenAssault(tweaks, den, attackPower, 999);

    expect(result.won).toBe(false);
    expect(result.den).toBe(den);
    expect(result.den.siege).toBeNull();
  });
});

describe("denAssaultSurvivors", () => {
  it("leaves 0 survivors on an exact-margin win (attackPower === defense)", () => {
    const result = denAssaultSurvivors(20, 20, 10, 0, 0);
    expect(result).toEqual({ militia: 0, junkyardKnight: 0, crossBowSniper: 0 });
  });

  it("keeps a proportional share of every committed type, floored", () => {
    // attackPower 100, defense 40 -> 60% of attack power survives.
    const result = denAssaultSurvivors(100, 40, 10, 10, 10);
    expect(result).toEqual({ militia: 6, junkyardKnight: 6, crossBowSniper: 6 });
  });

  it("keeps everyone when defense is 0", () => {
    const result = denAssaultSurvivors(50, 0, 5, 3, 2);
    expect(result).toEqual({ militia: 5, junkyardKnight: 3, crossBowSniper: 2 });
  });

  it("floors fractional survivors rather than rounding", () => {
    // attackPower 3, defense 1 -> survival fraction 2/3.
    const result = denAssaultSurvivors(3, 1, 1, 1, 1);
    expect(result).toEqual({ militia: 0, junkyardKnight: 0, crossBowSniper: 0 });
  });

  it("never goes negative when attackPower is 0", () => {
    const result = denAssaultSurvivors(0, 0, 5, 5, 5);
    expect(result).toEqual({ militia: 0, junkyardKnight: 0, crossBowSniper: 0 });
  });
});

describe("holdDefenseAt", () => {
  const coord = { q: 0, r: 0 };

  function makeTower(overrides: Partial<Tower> = {}): Tower {
    return { coord, level: 1, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false, ...overrides };
  }

  function makeWall(overrides: Partial<Wall> = {}): Wall {
    return { coord, tier: "wood", durability: 0, totalInvested: {}, action: null, buildCost: {}, damaged: false, ...overrides };
  }

  it("is 0 with nothing defending", () => {
    const tweaks = loadRealTweaks();
    expect(holdDefenseAt(tweaks, coord, [], [], [])).toBe(0);
  });

  it("includes a garrison stationed directly on the den's own coord", () => {
    const tweaks = loadRealTweaks();
    const garrisons: GarrisonsRecord = [{ coord, militiaCount: 5, junkyardKnightCount: 0, crossBowSniperCount: 0 }];
    expect(holdDefenseAt(tweaks, coord, [], [], garrisons)).toBeCloseTo(5 * tweaks.units.militia.defense_per_unit);
  });

  it("includes any non-damaged tower whose range reaches the den", () => {
    const tweaks = loadRealTweaks();
    const towers: Tower[] = [makeTower({ level: 2 })];
    expect(holdDefenseAt(tweaks, coord, towers, [], [])).toBeGreaterThan(0);
  });

  it("excludes a damaged tower", () => {
    const tweaks = loadRealTweaks();
    const towers: Tower[] = [makeTower({ level: 2, damaged: true })];
    expect(holdDefenseAt(tweaks, coord, towers, [], [])).toBe(0);
  });

  it("includes a non-damaged wall built on one of the den's neighbors, not on the den's own coord", () => {
    const tweaks = loadRealTweaks();
    const neighbor = { q: 1, r: 0 };
    const wallOnNeighbor: Wall[] = [makeWall({ coord: neighbor, durability: 42 })];
    const wallOnCore: Wall[] = [makeWall({ coord, durability: 42 })];
    expect(holdDefenseAt(tweaks, coord, [], wallOnNeighbor, [])).toBe(42);
    expect(holdDefenseAt(tweaks, coord, [], wallOnCore, [])).toBe(0);
  });

  it("excludes a damaged wall", () => {
    const tweaks = loadRealTweaks();
    const walls: Wall[] = [makeWall({ coord: { q: 1, r: 0 }, durability: 42, damaged: true })];
    expect(holdDefenseAt(tweaks, coord, [], walls, [])).toBe(0);
  });

  it("sums garrison + tower + wall contributions", () => {
    const tweaks = loadRealTweaks();
    const garrisons: GarrisonsRecord = [{ coord, militiaCount: 3, junkyardKnightCount: 0, crossBowSniperCount: 0 }];
    const towers: Tower[] = [makeTower({ level: 1 })];
    const walls: Wall[] = [makeWall({ coord: { q: 1, r: 0 }, durability: 10 })];
    const expected =
      3 * tweaks.units.militia.defense_per_unit +
      holdDefenseAt(tweaks, coord, towers, [], []) +
      10;
    expect(holdDefenseAt(tweaks, coord, towers, walls, garrisons)).toBeCloseTo(expected);
  });
});

describe("lastStandWaveSize", () => {
  it("is wave_base at level 1, wave 0", () => {
    const tweaks = loadRealTweaks();
    expect(lastStandWaveSize(tweaks, 1, 0)).toBe(tweaks.dens.siege.wave_base);
  });

  it("scales with den level and escalates per wave", () => {
    const tweaks = loadRealTweaks();
    const { wave_base, wave_per_level, wave_escalation_per_wave } = tweaks.dens.siege;
    expect(lastStandWaveSize(tweaks, 3, 2)).toBeCloseTo(wave_base + wave_per_level * 2 + wave_escalation_per_wave * 2);
  });

  it("never exceeds wave_cap", () => {
    const tweaks = loadRealTweaks();
    expect(lastStandWaveSize(tweaks, 100, 1000)).toBe(tweaks.dens.siege.wave_cap);
  });
});

describe("resolveHoldPeriod", () => {
  function makeSiegedDen(siege: DenSiegeState, overrides: Partial<DenRecord> = {}): DenRecord {
    return makeDen({ siege, ...overrides });
  }

  it("is a no-op ('ongoing') for a den that isn't under siege", () => {
    const tweaks = loadRealTweaks();
    const den = makeDen({ siege: null });
    const result = resolveHoldPeriod(tweaks, den, 999, 0);
    expect(result.outcome).toBe("ongoing");
    expect(result.den).toBe(den);
  });

  it("does nothing until a wave interval has elapsed", () => {
    const tweaks = loadRealTweaks();
    const siege: DenSiegeState = { startedAt: 0, lastWaveAt: 0, waveIndex: 0 };
    const den = makeSiegedDen(siege);
    const waveIntervalMs = tweaks.dens.siege.wave_interval_minutes * 60_000;
    const result = resolveHoldPeriod(tweaks, den, 0, waveIntervalMs - 1);
    expect(result.outcome).toBe("ongoing");
    expect(result.den).toBe(den);
  });

  it("repels a wave and escalates waveIndex when holdDefense beats it", () => {
    const tweaks = loadRealTweaks();
    const siege: DenSiegeState = { startedAt: 0, lastWaveAt: 0, waveIndex: 0 };
    const den = makeSiegedDen(siege, { level: 1 });
    const waveIntervalMs = tweaks.dens.siege.wave_interval_minutes * 60_000;
    const hugeDefense = tweaks.dens.siege.wave_cap;

    const result = resolveHoldPeriod(tweaks, den, hugeDefense, waveIntervalMs);

    expect(result.outcome).toBe("ongoing");
    expect(result.den.siege).toEqual({ startedAt: 0, lastWaveAt: waveIntervalMs, waveIndex: 1 });
  });

  it("fails the siege (reverts to hostile) when a wave beats holdDefense", () => {
    const tweaks = loadRealTweaks();
    const siege: DenSiegeState = { startedAt: 0, lastWaveAt: 0, waveIndex: 0 };
    const den = makeSiegedDen(siege, { level: 1 });
    const waveIntervalMs = tweaks.dens.siege.wave_interval_minutes * 60_000;

    const result = resolveHoldPeriod(tweaks, den, 0, waveIntervalMs);

    expect(result.outcome).toBe("failed");
    expect(result.den.siege).toBeNull();
    expect(result.den.level).toBe(1); // unchanged — reverts at its own level, no growth/decay
  });

  it("converts once the full hold duration has elapsed with no failure", () => {
    const tweaks = loadRealTweaks();
    const siege: DenSiegeState = { startedAt: 0, lastWaveAt: 0, waveIndex: 0 };
    const den = makeSiegedDen(siege);
    const holdDurationMs = tweaks.dens.siege.hold_duration_minutes * 60_000;

    const result = resolveHoldPeriod(tweaks, den, tweaks.dens.siege.wave_cap, holdDurationMs);

    expect(result.outcome).toBe("converted");
  });
});
