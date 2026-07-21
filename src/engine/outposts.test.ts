import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import type { OutpostRecord } from "../data/outposts";
import {
  maxOutpostReinforcementLevel,
  outpostReinforcementHp,
  outpostReinforcementUpgradeCost,
  outpostRepairCost,
  revertOutpostToDen,
} from "./outposts";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

function makeOutpost(overrides: Partial<OutpostRecord> = {}): OutpostRecord {
  return {
    id: "outpost-den-1",
    coord: { q: 5, r: 5 },
    reinforcementLevel: 0,
    currentHp: 65,
    reinforcementAction: null,
    convertedAt: 0,
    originalDenLevel: 1,
    ...overrides,
  };
}

describe("outpostReinforcementHp", () => {
  it("is base_hp at level 0", () => {
    const tweaks = loadRealTweaks();
    expect(outpostReinforcementHp(tweaks, 0)).toBe(tweaks.outposts.reinforcement.base_hp);
  });

  it("scales linearly with level", () => {
    const tweaks = loadRealTweaks();
    const { base_hp, hp_gain_per_level } = tweaks.outposts.reinforcement;
    expect(outpostReinforcementHp(tweaks, 3)).toBeCloseTo(base_hp + hp_gain_per_level * 3);
  });
});

describe("maxOutpostReinforcementLevel", () => {
  it("equals the player's global base level", () => {
    expect(maxOutpostReinforcementLevel(1)).toBe(1);
    expect(maxOutpostReinforcementLevel(7)).toBe(7);
  });
});

describe("outpostReinforcementUpgradeCost", () => {
  it("scales with Formula B", () => {
    const tweaks = loadRealTweaks();
    const cost = outpostReinforcementUpgradeCost(tweaks, 2);
    for (const [res, amount] of Object.entries(tweaks.outposts.reinforcement.cost_base)) {
      expect(cost[res]).toBeCloseTo(amount * 0.5 * (1 + 0.1 * 2));
    }
  });
});

describe("outpostRepairCost", () => {
  it("is 0 when already at full HP", () => {
    const tweaks = loadRealTweaks();
    const cost = outpostRepairCost(tweaks, 65, 65, 0);
    for (const amount of Object.values(cost)) {
      expect(amount).toBe(0);
    }
  });

  it("scales with the fraction of HP missing", () => {
    const tweaks = loadRealTweaks();
    const full = outpostReinforcementUpgradeCost(tweaks, 0);
    const halfMissing = outpostRepairCost(tweaks, 50, 100, 0);
    for (const [res, amount] of Object.entries(full)) {
      expect(halfMissing[res]).toBeCloseTo(amount * 0.5);
    }
  });
});

describe("revertOutpostToDen", () => {
  it("reverts one level below the den's original level (floor 1), clears siege", () => {
    const outpost = makeOutpost({ originalDenLevel: 3, coord: { q: 7, r: 2 } });
    const den = revertOutpostToDen(outpost);
    expect(den).toEqual({ id: "den-1", coord: { q: 7, r: 2 }, level: 2, siege: null });
  });

  it("floors the reverted level at 1, never 0 or negative", () => {
    const outpost = makeOutpost({ originalDenLevel: 1, id: "outpost-den-9" });
    const den = revertOutpostToDen(outpost);
    expect(den.level).toBe(1);
    expect(den.id).toBe("den-9");
  });
});
