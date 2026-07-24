import { describe, expect, it, beforeEach } from "vitest";
import { assetUrlCandidates, initAssetConfig, resetAssetConfig } from "./assetPaths";
import {
  structureLevelName,
  structureLevelCandidates,
  extractionTierCandidates,
  dockSpriteCandidates,
  structureAssetUrlCandidates,
} from "./structureSprites";

describe("structureSprites", () => {
  beforeEach(() => {
    resetAssetConfig();
  });

  it("builds levelled stems", () => {
    expect(structureLevelName("tower", 2)).toBe("tower-2");
    expect(structureLevelName("base", 1)).toBe("base-1");
  });

  it("lists exact level then unlevelled default", () => {
    expect(structureLevelCandidates("tower", 3)).toEqual(["tower-3", "tower"]);
    expect(structureLevelCandidates("barracks", 1)).toEqual(["barracks-1", "barracks"]);
    expect(structureLevelCandidates("base", 6)).toEqual(["base-6", "base"]);
  });

  it("lists per-resource extraction tier, then generic extraction stems", () => {
    expect(extractionTierCandidates("food", "small")).toEqual([
      "food-small",
      "extraction-small",
      "extraction",
    ]);
    expect(extractionTierCandidates("wood", "mid")).toEqual([
      "wood-mid",
      "extraction-mid",
      "extraction",
    ]);
    expect(extractionTierCandidates("power", "large")).toEqual([
      "power-large",
      "extraction-large",
      "extraction",
    ]);
  });

  it("lists dock-boat before dock when a boat is present", () => {
    expect(dockSpriteCandidates(true)).toEqual(["dock-boat", "dock"]);
    expect(dockSpriteCandidates(false)).toEqual(["dock"]);
  });

  it("flattens name candidates across profile→default URLs", () => {
    initAssetConfig("hard");
    expect(structureAssetUrlCandidates(["tower-2", "tower"], assetUrlCandidates)).toEqual([
      "/profiles/hard/assets/structures/tower-2.png",
      "/profiles/default/assets/structures/tower-2.png",
      "/profiles/hard/assets/structures/tower.png",
      "/profiles/default/assets/structures/tower.png",
    ]);
  });

  it("uses only default profile URLs when playing default", () => {
    initAssetConfig("default");
    expect(structureAssetUrlCandidates(["base-1", "base"], assetUrlCandidates)).toEqual([
      "/profiles/default/assets/structures/base-1.png",
      "/profiles/default/assets/structures/base.png",
    ]);
  });
});
