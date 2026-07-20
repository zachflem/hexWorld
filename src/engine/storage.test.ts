import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import { storageCapacity, storageUpgradeCost } from "./storage";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("storageCapacity", () => {
  it("doubles per level, starting at 1000 for L1", () => {
    const tweaks = loadRealTweaks();
    expect(storageCapacity(tweaks, 1)).toBe(1000);
    expect(storageCapacity(tweaks, 2)).toBe(2000);
    expect(storageCapacity(tweaks, 3)).toBe(4000);
  });
});

describe("storageUpgradeCost", () => {
  it("matches Formula B applied to the resource's own upgrade base cost", () => {
    const tweaks = loadRealTweaks();
    // food L1->L2: (500*0.5)*(1+0.1*2) = 300 wood
    const cost = storageUpgradeCost(tweaks, "food", 1);
    expect(cost.wood).toBeCloseTo(300);
  });
});
