import { describe, expect, it, beforeEach } from "vitest";
import { assetUrlCandidates, initAssetConfig, resetAssetConfig } from "./assetPaths";

describe("assetPaths", () => {
  beforeEach(() => {
    resetAssetConfig();
  });

  it("uses default tiles when custom sprites are disabled", () => {
    initAssetConfig("hard", undefined);
    expect(assetUrlCandidates("terrain", "grassland.png")).toEqual(["/tiles/terrain/grassland.png"]);
  });

  it("prefers profile assets when custom sprites are enabled", () => {
    initAssetConfig("hard", { custom_sprites: true });
    expect(assetUrlCandidates("terrain", "grassland.png")).toEqual([
      "/profiles/hard/assets/terrain/grassland.png",
      "/tiles/terrain/grassland.png",
    ]);
  });
});
