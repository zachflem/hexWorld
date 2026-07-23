import { describe, expect, it, beforeEach } from "vitest";
import { assetUrlCandidates, initAssetConfig, resetAssetConfig, DEFAULT_PROFILE_SLUG } from "./assetPaths";

describe("assetPaths", () => {
  beforeEach(() => {
    resetAssetConfig();
  });

  it("uses only the default profile pack when playing default", () => {
    initAssetConfig(DEFAULT_PROFILE_SLUG);
    expect(assetUrlCandidates("terrain", "grassland.png")).toEqual([
      "/profiles/default/assets/terrain/grassland.png",
    ]);
  });

  it("falls back from active profile to default profile assets", () => {
    initAssetConfig("hard");
    expect(assetUrlCandidates("terrain", "grassland.png")).toEqual([
      "/profiles/hard/assets/terrain/grassland.png",
      "/profiles/default/assets/terrain/grassland.png",
    ]);
  });
});
