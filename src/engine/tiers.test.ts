import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import { nextTier, tierUpgradeCost, tierUpgradeDurationMs, tierYieldMultiplier } from "./tiers";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("nextTier", () => {
  it("progresses small -> mid -> large -> null", () => {
    expect(nextTier("small")).toBe("mid");
    expect(nextTier("mid")).toBe("large");
    expect(nextTier("large")).toBeNull();
  });
});

describe("tierYieldMultiplier", () => {
  it("matches yield(tier) = small_yield * 1.5^tier_index from TWEAKS.md", () => {
    const tweaks = loadRealTweaks();
    expect(tierYieldMultiplier(tweaks, "small")).toBeCloseTo(1);
    expect(tierYieldMultiplier(tweaks, "mid")).toBeCloseTo(1.5);
    expect(tierYieldMultiplier(tweaks, "large")).toBeCloseTo(2.25);
  });
});

describe("tierUpgradeCost", () => {
  it("small->mid costs only the tile's own base resource (Formula B, target level 2)", () => {
    const tweaks = loadRealTweaks();
    const cost = tierUpgradeCost(tweaks, "food", "mid");
    expect(cost).toEqual({ wood: 90 });
  });

  it("mid->large adds the tech-progression's stone contribution (target level 3)", () => {
    const tweaks = loadRealTweaks();
    const cost = tierUpgradeCost(tweaks, "food", "large");
    expect(cost.wood).toBeCloseTo(97.5);
    expect(cost.stone).toBeCloseTo(126.75);
  });
});

describe("tierUpgradeDurationMs", () => {
  it("scales with target level: base * target_level (small=1, mid=2, large=3)", () => {
    const tweaks = loadRealTweaks();
    const baseMs = tweaks.extraction_tiles.tier_upgrade_time_minutes_base * 60_000;
    expect(tierUpgradeDurationMs(tweaks, "mid")).toBe(baseMs * 2);
    expect(tierUpgradeDurationMs(tweaks, "large")).toBe(baseMs * 3);
  });
});
