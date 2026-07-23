import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import type { ResearchRecord } from "../data/research";
import { initialResearch } from "../data/research";
import { isResearchAvailable, researchCost, researchDurationMs, troopSpeedMultiplier, unlockedSpeedRates } from "./research";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("isResearchAvailable", () => {
  it("tier 2 of a line is available from the start", () => {
    expect(isResearchAvailable(initialResearch(), "troop_speed_2")).toBe(true);
    expect(isResearchAvailable(initialResearch(), "game_speed_2")).toBe(true);
  });

  it("tier 3 requires tier 2 completed first", () => {
    expect(isResearchAvailable(initialResearch(), "troop_speed_3")).toBe(false);
    const withTier2: ResearchRecord = { completed: ["troop_speed_2"], pending: null };
    expect(isResearchAvailable(withTier2, "troop_speed_3")).toBe(true);
  });

  it("an already-completed id is no longer available", () => {
    const withTier2: ResearchRecord = { completed: ["troop_speed_2"], pending: null };
    expect(isResearchAvailable(withTier2, "troop_speed_2")).toBe(false);
  });

  it("the two lines don't gate each other", () => {
    const withTroopTier2: ResearchRecord = { completed: ["troop_speed_2"], pending: null };
    expect(isResearchAvailable(withTroopTier2, "game_speed_2")).toBe(true);
    expect(isResearchAvailable(withTroopTier2, "game_speed_3")).toBe(false);
  });
  it("isResearchAvailable for parallel_upgrades from the start", () => {
    expect(isResearchAvailable(initialResearch(), "parallel_upgrades")).toBe(true);
  });
});

describe("structureTaskSlotCap", () => {
  it("reads parallel_upgrades cost and duration from tweaks", () => {
    const tweaks = loadRealTweaks();
    expect(researchCost(tweaks, "parallel_upgrades")).toEqual(tweaks.research.parallel_upgrades.cost);
    expect(researchDurationMs(tweaks, "parallel_upgrades")).toBe(15 * 60_000);
  });
});

describe("researchCost / researchDurationMs", () => {
  it("reads cost and duration from tweaks.research for each tier", () => {
    const tweaks = loadRealTweaks();
    expect(researchCost(tweaks, "troop_speed_2")).toEqual(tweaks.research.troop_speed.tier_2.cost);
    expect(researchDurationMs(tweaks, "troop_speed_2")).toBe(tweaks.research.troop_speed.tier_2.duration_minutes * 60_000);
    expect(researchCost(tweaks, "game_speed_3")).toEqual(tweaks.research.game_speed.tier_3.cost);
    expect(researchDurationMs(tweaks, "game_speed_3")).toBe(tweaks.research.game_speed.tier_3.duration_minutes * 60_000);
  });
});

describe("troopSpeedMultiplier", () => {
  it("defaults to 1.0 with nothing researched", () => {
    const tweaks = loadRealTweaks();
    expect(troopSpeedMultiplier(tweaks, initialResearch())).toBe(1);
  });

  it("is the tier-2 multiplier once tier 2 is completed", () => {
    const tweaks = loadRealTweaks();
    const research: ResearchRecord = { completed: ["troop_speed_2"], pending: null };
    expect(troopSpeedMultiplier(tweaks, research)).toBe(tweaks.research.troop_speed.tier_2.multiplier);
  });

  it("is the tier-3 multiplier once tier 3 is completed, not tier 2's", () => {
    const tweaks = loadRealTweaks();
    const research: ResearchRecord = { completed: ["troop_speed_2", "troop_speed_3"], pending: null };
    expect(troopSpeedMultiplier(tweaks, research)).toBe(tweaks.research.troop_speed.tier_3.multiplier);
  });
});

describe("unlockedSpeedRates", () => {
  it("is just [1] with nothing researched", () => {
    const tweaks = loadRealTweaks();
    expect(unlockedSpeedRates(tweaks, initialResearch())).toEqual([1]);
  });

  it("adds the tier-2 rate once unlocked", () => {
    const tweaks = loadRealTweaks();
    const research: ResearchRecord = { completed: ["game_speed_2"], pending: null };
    expect(unlockedSpeedRates(tweaks, research)).toEqual([1, tweaks.research.game_speed.tier_2.rate]);
  });

  it("adds both tier rates once both are unlocked", () => {
    const tweaks = loadRealTweaks();
    const research: ResearchRecord = { completed: ["game_speed_2", "game_speed_3"], pending: null };
    expect(unlockedSpeedRates(tweaks, research)).toEqual([1, tweaks.research.game_speed.tier_2.rate, tweaks.research.game_speed.tier_3.rate]);
  });
});
