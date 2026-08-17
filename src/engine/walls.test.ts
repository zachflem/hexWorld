import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import type { Wall } from "../data/walls";
import {
  maxWallDurability,
  nextWallTier,
  wallBuildCost,
  wallDamagePerTick,
  wallRepairCost,
  wallRepairDurationMs,
  wallUpgradeCost,
  wallUpgradeDurationMs,
} from "./walls";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/profiles/default/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("nextWallTier", () => {
  it("progresses wood -> rock -> steel -> null", () => {
    expect(nextWallTier("wood")).toBe("rock");
    expect(nextWallTier("rock")).toBe("steel");
    expect(nextWallTier("steel")).toBeNull();
  });
});

describe("wallBuildCost", () => {
  it("applies linear (not Formula A) build-count scaling to the wood-tier base cost", () => {
    const tweaks = loadRealTweaks();
    expect(wallBuildCost(tweaks, 1).wood).toBeCloseTo(200);
    expect(wallBuildCost(tweaks, 2).wood).toBeCloseTo(220);
    // Diverges from Formula A's compounding by n=8: linear costs 340, Formula
    // A would've compounded to ~1960 — the exact "wall #8 costs 2k wood"
    // complaint this scaling change addresses.
    expect(wallBuildCost(tweaks, 8).wood).toBeCloseTo(340);
  });
});

describe("maxWallDurability", () => {
  it("derives HP as hits_to_break * damage_taken_base_per_tier", () => {
    const tweaks = loadRealTweaks();
    // damage_taken_base_per_tier tripled (2026-07-20 balance pass: wood 3->9,
    // rock 7->21, steel 11->33) — durability_hits_to_break is unchanged.
    expect(maxWallDurability(tweaks, "wood")).toBe(3 * 9);
    expect(maxWallDurability(tweaks, "rock")).toBe(7 * 21);
    expect(maxWallDurability(tweaks, "steel")).toBe(15 * 33);
  });
});

describe("wallDamagePerTick", () => {
  it("scales with horde size", () => {
    const tweaks = loadRealTweaks();
    expect(wallDamagePerTick(tweaks, "wood", 100)).toBeCloseTo(9);
    expect(wallDamagePerTick(tweaks, "wood", 200)).toBeCloseTo(18);
  });
});

describe("wallUpgradeCost", () => {
  it("wood->rock costs wood (own base) + stone (reused from extraction_tiles.stone)", () => {
    const tweaks = loadRealTweaks();
    const cost = wallUpgradeCost(tweaks, "rock");
    expect(cost.wood).toBeCloseTo(120);
    expect(cost.stone).toBeCloseTo(117);
  });

  it("rock->steel adds steel", () => {
    const tweaks = loadRealTweaks();
    const cost = wallUpgradeCost(tweaks, "steel");
    expect(cost.wood).toBeCloseTo(130);
    expect(cost.stone).toBeCloseTo(126.75);
    expect(cost.steel).toBeGreaterThan(0);
  });
});

describe("wallUpgradeDurationMs", () => {
  it("scales with target level: base * target_level (rock=2, steel=3)", () => {
    const tweaks = loadRealTweaks();
    const baseMs = tweaks.walls.tier_upgrade_time_minutes_base * 60_000;
    expect(wallUpgradeDurationMs(tweaks, "rock")).toBe(baseMs * 2);
    expect(wallUpgradeDurationMs(tweaks, "steel")).toBe(baseMs * 3);
  });
});

describe("wallRepairCost", () => {
  it("is proportional to missing HP, scaled off the wall's total lifetime investment", () => {
    const wall: Wall = {
      coord: { q: 0, r: 0 },
      tier: "wood",
      durability: 0,
      totalInvested: { wood: 200 },
      action: null,
      buildCost: {},
      damaged: false,
    };
    const maxHp = 9; // arbitrary round test value — wallRepairCost only cares about the missing-HP fraction, not the real per-tier durability numbers
    const cost = wallRepairCost(wall, maxHp);
    expect(cost.wood).toBeCloseTo(200); // fully damaged -> full investment owed back
  });

  it("costs nothing at full health", () => {
    const wall: Wall = {
      coord: { q: 0, r: 0 },
      tier: "wood",
      durability: 9,
      totalInvested: { wood: 200 },
      action: null,
      buildCost: {},
      damaged: false,
    };
    expect(wallRepairCost(wall, 9).wood).toBeCloseTo(0);
  });

  it("scales linearly with the fraction of HP missing", () => {
    const wall: Wall = {
      coord: { q: 0, r: 0 },
      tier: "wood",
      durability: 4.5,
      totalInvested: { wood: 200 },
      action: null,
      buildCost: {},
      damaged: false,
    };
    expect(wallRepairCost(wall, 9).wood).toBeCloseTo(100);
  });
});

describe("wallRepairDurationMs", () => {
  it("is 0 when fully healthy", () => {
    const tweaks = loadRealTweaks();
    const wall: Wall = { coord: { q: 0, r: 0 }, tier: "wood", durability: 9, totalInvested: {}, action: null, buildCost: {}, damaged: false };
    expect(wallRepairDurationMs(tweaks, wall, 9)).toBe(0);
  });

  it("scales with missing HP: missingHp * seconds_per_missing_hp * 1000", () => {
    const tweaks = loadRealTweaks();
    const wall: Wall = { coord: { q: 0, r: 0 }, tier: "wood", durability: 0, totalInvested: {}, action: null, buildCost: {}, damaged: false };
    expect(wallRepairDurationMs(tweaks, wall, 9)).toBe(9 * tweaks.walls.repair.seconds_per_missing_hp * 1000);
  });

  it("is proportional for a partially-damaged wall", () => {
    const tweaks = loadRealTweaks();
    const wall: Wall = { coord: { q: 0, r: 0 }, tier: "wood", durability: 4.5, totalInvested: {}, action: null, buildCost: {}, damaged: false };
    expect(wallRepairDurationMs(tweaks, wall, 9)).toBe(4.5 * tweaks.walls.repair.seconds_per_missing_hp * 1000);
  });
});
