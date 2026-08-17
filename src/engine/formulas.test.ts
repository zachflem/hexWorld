import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import {
  addToInvestment,
  demolishRefund,
  formulaACost,
  formulaBCost,
  isStructureActive,
  linearBuildCost,
  repairCost,
  scaledCostMap,
  structureHp,
  totalStructureCount,
} from "./formulas";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/profiles/default/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("formulaACost", () => {
  it("matches the worked tower example from TWEAKS.md", () => {
    const base = 300; // wood cost of a tower
    expect(formulaACost(base, 1)).toBeCloseTo(300);
    expect(formulaACost(base, 2)).toBeCloseTo(330);
    expect(formulaACost(base, 3)).toBeCloseTo(396);
  });
});

describe("linearBuildCost", () => {
  it("matches formulaACost through n=2 (they only diverge from n=3 on)", () => {
    expect(linearBuildCost(200, 1)).toBeCloseTo(formulaACost(200, 1));
    expect(linearBuildCost(200, 2)).toBeCloseTo(formulaACost(200, 2));
  });

  it("stays linear instead of compounding — wall #8 costs 340, not Formula A's ~1960", () => {
    expect(linearBuildCost(200, 8)).toBeCloseTo(340);
    expect(formulaACost(200, 8)).toBeGreaterThan(1900);
  });
});

describe("scaledCostMap", () => {
  it("scales every resource in the map by the same structure count", () => {
    const scaled = scaledCostMap({ wood: 300, stone: 150 }, 2);
    expect(scaled.wood).toBeCloseTo(330);
    expect(scaled.stone).toBeCloseTo(165);
  });
});

describe("formulaBCost", () => {
  it("matches the worked tower upgrade example from TWEAKS.md", () => {
    expect(formulaBCost(150, 2)).toBeCloseTo(90); // L1->L2: 90 wood
    expect(formulaBCost(150, 3)).toBeCloseTo(97.5); // L2->L3: 97.5 wood
    expect(formulaBCost(75, 2)).toBeCloseTo(45); // L1->L2: 45 stone
    expect(formulaBCost(75, 3)).toBeCloseTo(48.75); // L2->L3: 48.75 stone
  });
});

describe("addToInvestment", () => {
  it("accumulates cost into a running total, resource by resource", () => {
    const invested = { wood: 300, stone: 150 };
    const next = addToInvestment(invested, { wood: 90, stone: 45, steel: 10 });
    expect(next).toEqual({ wood: 390, stone: 195, steel: 10 });
  });

  it("starts fresh from an empty investment", () => {
    expect(addToInvestment({}, { wood: 100 })).toEqual({ wood: 100 });
  });
});

describe("totalStructureCount", () => {
  it("sums extraction/tower/barracks/dock at full weight, with no walls", () => {
    const tweaks = loadRealTweaks();
    expect(totalStructureCount(tweaks, [1, 2], [1, 2, 3], [], [1], [1, 2])).toBe(8);
  });

  it("is 0 with no structures at all", () => {
    const tweaks = loadRealTweaks();
    expect(totalStructureCount(tweaks, [], [], [], [], [])).toBe(0);
  });

  it("counts walls at their fractional slot_cost, not 1-for-1", () => {
    const tweaks = loadRealTweaks();
    const tenWalls = Array.from({ length: 10 }, (_, i) => i);
    // 10 walls at slot_cost each should read as exactly 1 full slot's worth (0.1 * 10 = 1).
    expect(totalStructureCount(tweaks, [], [], tenWalls, [], [])).toBeCloseTo(10 * tweaks.walls.slot_cost);
  });
});

describe("demolishRefund", () => {
  it("returns the configured percentage of everything ever spent", () => {
    const tweaks = loadRealTweaks();
    const refund = demolishRefund(tweaks, { wood: 300, stone: 150 });
    const pct = tweaks.demolish.refund_pct / 100;
    expect(refund.wood).toBeCloseTo(300 * pct);
    expect(refund.stone).toBeCloseTo(150 * pct);
  });
});

describe("repairCost", () => {
  it("returns the configured percentage of the ORIGINAL build cost, per DESIGN.md §12 / TWEAKS.md", () => {
    const tweaks = loadRealTweaks();
    const cost = repairCost(tweaks, { wood: 300, stone: 150 });
    const pct = tweaks.horde.territory_disconnection.repair_cost_pct_of_original_build / 100;
    expect(cost.wood).toBeCloseTo(300 * pct);
    expect(cost.stone).toBeCloseTo(150 * pct);
  });

  it("matches TWEAKS.md's documented 50% of original build cost", () => {
    const tweaks = loadRealTweaks();
    expect(tweaks.horde.territory_disconnection.repair_cost_pct_of_original_build).toBe(50);
    expect(repairCost(tweaks, { wood: 300 }).wood).toBeCloseTo(150);
  });

  it("is empty for a structure with no build cost recorded", () => {
    const tweaks = loadRealTweaks();
    expect(repairCost(tweaks, {})).toEqual({});
  });
});

describe("structureHp", () => {
  it("sums invested resources and scales by the configured HP-per-resource rate", () => {
    const tweaks = loadRealTweaks();
    const rate = tweaks.horde.structure_hp_per_invested_resource;
    expect(structureHp(tweaks, { wood: 100, stone: 50 })).toBeCloseTo(150 * rate);
  });

  it("is 0 for a structure with nothing invested", () => {
    const tweaks = loadRealTweaks();
    expect(structureHp(tweaks, {})).toBe(0);
  });
});

describe("isStructureActive", () => {
  it("treats buildStartedAt 0 as under construction, not active", () => {
    expect(isStructureActive({ damaged: false, buildStartedAt: 0 })).toBe(false);
  });

  it("is active once buildStartedAt is cleared to null", () => {
    expect(isStructureActive({ damaged: false, buildStartedAt: null })).toBe(true);
  });

  it("is inactive while damaged even if buildStartedAt is null", () => {
    expect(isStructureActive({ damaged: true, buildStartedAt: null })).toBe(false);
  });
});
