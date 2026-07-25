import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import {
  nextTowerLevel,
  towerBuildCost,
  towerDamage,
  towerRange,
  towerUpgradeCost,
  towerUpgradeDurationMs,
  zombiesKilledPerTick,
} from "./towers";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("towerBuildCost", () => {
  it("applies Formula A to wood+stone base costs", () => {
    const tweaks = loadRealTweaks();
    const first = towerBuildCost(tweaks, 1);
    const second = towerBuildCost(tweaks, 2);
    expect(first).toEqual({ wood: 300, stone: 150 });
    expect(second.wood).toBeCloseTo(330);
    expect(second.stone).toBeCloseTo(165);
  });
});

describe("towerRange", () => {
  it("adds range_per_level per level above L1 on grassland (neutral offset)", () => {
    const tweaks = loadRealTweaks();
    expect(towerRange(tweaks, 1, "grassland")).toBe(2);
    expect(towerRange(tweaks, 2, "grassland")).toBe(3);
    expect(towerRange(tweaks, 4, "grassland")).toBe(5);
  });

  it("applies range_terrain_offset by build-tile terrain (#79)", () => {
    const tweaks = loadRealTweaks();
    expect(towerRange(tweaks, 1, "shore")).toBe(2);
    expect(towerRange(tweaks, 1, "mountain")).toBe(4);
    expect(towerRange(tweaks, 1, "forest")).toBe(1);
    expect(towerRange(tweaks, 2, "forest")).toBe(2);
  });
});

describe("towerDamage", () => {
  it("matches dmg(L) = dmg(L-1) * (1 + 0.1*L), cumulative from base_damage", () => {
    const tweaks = loadRealTweaks();
    expect(towerDamage(tweaks, 1)).toBe(5);
    expect(towerDamage(tweaks, 2)).toBeCloseTo(5 * 1.2);
    expect(towerDamage(tweaks, 3)).toBeCloseTo(5 * 1.2 * 1.3);
  });
});

describe("zombiesKilledPerTick", () => {
  it("defaults to no garrison bonus", () => {
    const tweaks = loadRealTweaks();
    expect(zombiesKilledPerTick(tweaks, 1, 100)).toBeCloseTo(towerDamage(tweaks, 1));
  });

  it("adds garrisonBonusDamage onto the tower's own damage before the horde-size scaling", () => {
    const tweaks = loadRealTweaks();
    const bonus = 5 * tweaks.towers.garrison_damage_bonus_per_militia;
    expect(zombiesKilledPerTick(tweaks, 1, 100, bonus)).toBeCloseTo(towerDamage(tweaks, 1) + bonus);
    expect(zombiesKilledPerTick(tweaks, 1, 50, bonus)).toBeCloseTo((towerDamage(tweaks, 1) + bonus) * 0.5);
  });
});

describe("nextTowerLevel", () => {
  it("progresses 1->2->3->4->null", () => {
    expect(nextTowerLevel(1)).toBe(2);
    expect(nextTowerLevel(3)).toBe(4);
    expect(nextTowerLevel(4)).toBeNull();
  });
});

describe("towerUpgradeCost", () => {
  it("L1->L2 matches the worked example from TWEAKS.md (90 wood, 45 stone)", () => {
    const tweaks = loadRealTweaks();
    const cost = towerUpgradeCost(tweaks, 2);
    expect(cost.wood).toBeCloseTo(90);
    expect(cost.stone).toBeCloseTo(45);
  });

  it("L2->L3 matches the worked example (97.5 wood, 48.75 stone) and adds steel", () => {
    const tweaks = loadRealTweaks();
    const cost = towerUpgradeCost(tweaks, 3);
    expect(cost.wood).toBeCloseTo(97.5);
    expect(cost.stone).toBeCloseTo(48.75);
    expect(cost.steel).toBeGreaterThan(0);
  });

  it("L3->L4 adds steel", () => {
    const tweaks = loadRealTweaks();
    const cost = towerUpgradeCost(tweaks, 4);
    expect(cost.steel).toBeGreaterThan(0);
  });
});

describe("towerUpgradeDurationMs", () => {
  it("scales with target level: base * targetLevel", () => {
    const tweaks = loadRealTweaks();
    const baseMs = tweaks.towers.upgrade_time_minutes_base * 60_000;
    expect(towerUpgradeDurationMs(tweaks, 2)).toBe(baseMs * 2);
    expect(towerUpgradeDurationMs(tweaks, 4)).toBe(baseMs * 4);
  });
});
