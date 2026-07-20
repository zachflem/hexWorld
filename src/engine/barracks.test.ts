import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import type { Barracks } from "../data/barracks";
import {
  barracksBuildCost,
  barracksUpgradeCost,
  barracksUpgradeDurationMs,
  crossBowSniperCapacity,
  junkyardKnightCapacity,
  militiaCapacity,
  nextBarracksLevel,
  scoutCapacity,
} from "./barracks";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("barracksBuildCost", () => {
  it("applies Formula A to wood+stone base costs", () => {
    const tweaks = loadRealTweaks();
    expect(barracksBuildCost(tweaks, 1)).toEqual({ wood: 250, stone: 150 });
    expect(barracksBuildCost(tweaks, 2).wood).toBeCloseTo(275);
  });
});

describe("nextBarracksLevel", () => {
  it("progresses 1->2->3->4->null", () => {
    expect(nextBarracksLevel(1)).toBe(2);
    expect(nextBarracksLevel(3)).toBe(4);
    expect(nextBarracksLevel(4)).toBeNull();
  });
});

describe("barracksUpgradeCost", () => {
  it("L1->L2 applies Formula B to wood+stone", () => {
    const tweaks = loadRealTweaks();
    const cost = barracksUpgradeCost(tweaks, 2);
    expect(cost.wood).toBeCloseTo(90);
    expect(cost.stone).toBeCloseTo(45);
  });

  it("L2->L3 adds steel via the reused extraction-tile baseline", () => {
    const tweaks = loadRealTweaks();
    const cost = barracksUpgradeCost(tweaks, 3);
    expect(cost.steel).toBeGreaterThan(0);
  });

  it("L3->L4 adds power via the reused extraction-tile baseline", () => {
    const tweaks = loadRealTweaks();
    const cost = barracksUpgradeCost(tweaks, 4);
    expect(cost.power).toBeGreaterThan(0);
  });
});

describe("barracksUpgradeDurationMs", () => {
  it("scales with target level: base * targetLevel", () => {
    const tweaks = loadRealTweaks();
    const baseMs = tweaks.barracks.upgrade_time_minutes_base * 60_000;
    expect(barracksUpgradeDurationMs(tweaks, 2)).toBe(baseMs * 2);
    expect(barracksUpgradeDurationMs(tweaks, 4)).toBe(baseMs * 4);
  });
});

describe("militiaCapacity / scoutCapacity", () => {
  it("sums per-level contributions across multiple barracks", () => {
    const tweaks = loadRealTweaks();
    const list: Barracks[] = [
      { coord: { q: 0, r: 0 }, level: 1, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
      { coord: { q: 1, r: 0 }, level: 2, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
    ];
    expect(militiaCapacity(tweaks, list)).toBe(
      tweaks.barracks.militia_capacity_per_level * 1 + tweaks.barracks.militia_capacity_per_level * 2,
    );
    expect(scoutCapacity(tweaks, list)).toBe(
      tweaks.barracks.scout_capacity_per_level * 1 + tweaks.barracks.scout_capacity_per_level * 2,
    );
  });

  it("is 0 with no barracks", () => {
    const tweaks = loadRealTweaks();
    expect(militiaCapacity(tweaks, [])).toBe(0);
    expect(scoutCapacity(tweaks, [])).toBe(0);
  });
});

describe("junkyardKnightCapacity / crossBowSniperCapacity", () => {
  it("is 0 when no barracks meets the unit's min_barracks_level", () => {
    const tweaks = loadRealTweaks();
    const list: Barracks[] = [
      { coord: { q: 0, r: 0 }, level: 1, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
    ];
    expect(junkyardKnightCapacity(tweaks, list)).toBe(0);
    expect(crossBowSniperCapacity(tweaks, list)).toBe(0);
  });

  it("only counts barracks that individually meet the gate, each scaled by its own level", () => {
    const tweaks = loadRealTweaks();
    const list: Barracks[] = [
      { coord: { q: 0, r: 0 }, level: 1, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
      { coord: { q: 1, r: 0 }, level: 2, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
      { coord: { q: 2, r: 0 }, level: 3, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
    ];
    // Junkyard knight gates at L2 — the L1 barracks contributes nothing.
    expect(junkyardKnightCapacity(tweaks, list)).toBe(
      tweaks.barracks.junkyard_knight_capacity_per_level * 2 + tweaks.barracks.junkyard_knight_capacity_per_level * 3,
    );
    // Cross-bow sniper gates at L3 — only the L3 barracks contributes.
    expect(crossBowSniperCapacity(tweaks, list)).toBe(tweaks.barracks.cross_bow_sniper_capacity_per_level * 3);
  });

  it("is 0 with no barracks", () => {
    const tweaks = loadRealTweaks();
    expect(junkyardKnightCapacity(tweaks, [])).toBe(0);
    expect(crossBowSniperCapacity(tweaks, [])).toBe(0);
  });
});
