import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import type { ExtractionTile } from "../data/extractionTiles";
import type { PathTile } from "../data/pathTiles";
import {
  findResourceTileConnection,
  nextPathTier,
  pathBuildCost,
  pathUpgradeCost,
  pathUpgradeDurationMs,
  throughputMultiplierForChain,
} from "./paths";
import { terrainAt } from "./terrain";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("nextPathTier", () => {
  it("progresses goat_track -> stone_road -> highway -> null", () => {
    expect(nextPathTier("goat_track")).toBe("stone_road");
    expect(nextPathTier("stone_road")).toBe("highway");
    expect(nextPathTier("highway")).toBeNull();
  });
});

describe("pathBuildCost", () => {
  it("applies linear (not Formula A) build-count scaling to the goat track's food base cost", () => {
    const tweaks = loadRealTweaks();
    expect(pathBuildCost(tweaks, 1).food).toBeCloseTo(100);
    expect(pathBuildCost(tweaks, 2).food).toBeCloseTo(110); // 100 * 1.1
    // Diverges from Formula A's compounding by n=8: linear costs 170, Formula
    // A would've compounded to ~980 (100 * ~9.8x).
    expect(pathBuildCost(tweaks, 8).food).toBeCloseTo(170);
  });
});

describe("pathUpgradeCost", () => {
  it("stone_road costs food (own base) + stone (reused from extraction_tiles.stone)", () => {
    const tweaks = loadRealTweaks();
    const cost = pathUpgradeCost(tweaks, "stone_road");
    expect(cost.food).toBeCloseTo(60);
    expect(cost.stone).toBeCloseTo(117);
  });

  it("highway costs food + stone + steel", () => {
    const tweaks = loadRealTweaks();
    const cost = pathUpgradeCost(tweaks, "highway");
    expect(cost.food).toBeCloseTo(65);
    expect(cost.stone).toBeCloseTo(126.75);
    expect(cost.steel).toBeCloseTo(165.1);
  });
});

describe("pathUpgradeDurationMs", () => {
  it("scales with target level: base * target_level (stone_road=2, highway=3)", () => {
    const tweaks = loadRealTweaks();
    const baseMs = tweaks.infrastructure_paths.upgrade_time_minutes_base * 60_000;
    expect(pathUpgradeDurationMs(tweaks, "stone_road")).toBe(baseMs * 2);
    expect(pathUpgradeDurationMs(tweaks, "highway")).toBe(baseMs * 3);
  });
});

describe("findResourceTileConnection", () => {
  const base = { q: 0, r: 0 };

  it("connects a tile directly adjacent to a base-connected path tile", () => {
    const pathCoord = { q: 1, r: 0 };
    const tileCoord = { q: 2, r: 0 };
    const pathTiles: PathTile[] = [{ coord: pathCoord, tier: "goat_track", totalInvested: {}, upgrade: null, buildCost: {}, damaged: false }];
    const extractionTiles: ExtractionTile[] = [
      { coord: tileCoord, resource: "food", tier: "small", stockpile: 0, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
    ];

    const result = findResourceTileConnection(extractionTiles, pathTiles, base, tileCoord);

    expect(result?.tier).toBe("goat_track");
    expect(result?.chain).toEqual([pathCoord]);
  });

  it("connects a tile directly adjacent to base with no path tile at all", () => {
    const tileCoord = { q: 1, r: 0 }; // distance 1 from base — no path tile needed
    const extractionTiles: ExtractionTile[] = [
      { coord: tileCoord, resource: "food", tier: "small", stockpile: 0, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
    ];

    const result = findResourceTileConnection(extractionTiles, [], base, tileCoord);

    expect(result?.tier).toBe("highway");
    expect(result?.chain).toEqual([]);
  });

  it("propagates base-adjacency through a same-resource cluster, still with no path tile", () => {
    // base - foodA(1,0) - foodB(2,0): foodB only touches foodA, not base directly.
    const tileA = { q: 1, r: 0 };
    const tileB = { q: 2, r: 0 };
    const extractionTiles: ExtractionTile[] = [
      { coord: tileA, resource: "food", tier: "small", stockpile: 0, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
      { coord: tileB, resource: "food", tier: "small", stockpile: 0, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
    ];

    const result = findResourceTileConnection(extractionTiles, [], base, tileB);

    expect(result?.tier).toBe("highway");
    expect(result?.chain).toEqual([]);
  });

  it("propagates transitively through a cluster of the same resource type", () => {
    // base - path(1,0) - foodA(2,0) - foodB(3,0): foodB only touches foodA, not the path directly.
    const pathCoord = { q: 1, r: 0 };
    const tileA = { q: 2, r: 0 };
    const tileB = { q: 3, r: 0 };
    const pathTiles: PathTile[] = [{ coord: pathCoord, tier: "stone_road", totalInvested: {}, upgrade: null, buildCost: {}, damaged: false }];
    const extractionTiles: ExtractionTile[] = [
      { coord: tileA, resource: "food", tier: "small", stockpile: 0, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
      { coord: tileB, resource: "food", tier: "small", stockpile: 0, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
    ];

    const result = findResourceTileConnection(extractionTiles, pathTiles, base, tileB);

    expect(result?.tier).toBe("stone_road");
  });

  it("does not propagate through a differently-resourced neighbor", () => {
    const pathCoord = { q: 1, r: 0 };
    const tileA = { q: 2, r: 0 };
    const tileB = { q: 3, r: 0 };
    const pathTiles: PathTile[] = [{ coord: pathCoord, tier: "goat_track", totalInvested: {}, upgrade: null, buildCost: {}, damaged: false }];
    const extractionTiles: ExtractionTile[] = [
      { coord: tileA, resource: "wood", tier: "small", stockpile: 0, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
      { coord: tileB, resource: "food", tier: "small", stockpile: 0, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
    ];

    expect(findResourceTileConnection(extractionTiles, pathTiles, base, tileB)).toBeNull();
  });

  it("returns null when there's no path network at all", () => {
    const tileCoord = { q: 2, r: 0 };
    const extractionTiles: ExtractionTile[] = [
      { coord: tileCoord, resource: "food", tier: "small", stockpile: 0, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
    ];

    expect(findResourceTileConnection(extractionTiles, [], base, tileCoord)).toBeNull();
  });

  it("returns null when the path network doesn't reach base", () => {
    const isolatedPath = { q: 10, r: 10 };
    const tileCoord = { q: 11, r: 10 };
    const pathTiles: PathTile[] = [{ coord: isolatedPath, tier: "goat_track", totalInvested: {}, upgrade: null, buildCost: {}, damaged: false }];
    const extractionTiles: ExtractionTile[] = [
      { coord: tileCoord, resource: "food", tier: "small", stockpile: 0, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
    ];

    expect(findResourceTileConnection(extractionTiles, pathTiles, base, tileCoord)).toBeNull();
  });

  it("never connects a damaged extraction tile, even if it's otherwise base-adjacent", () => {
    const tileCoord = { q: 1, r: 0 };
    const extractionTiles: ExtractionTile[] = [
      { coord: tileCoord, resource: "food", tier: "small", stockpile: 0, totalInvested: {}, upgrade: null, buildCost: {}, damaged: true },
    ];

    expect(findResourceTileConnection(extractionTiles, [], base, tileCoord)).toBeNull();
  });

  it("a damaged path tile can't carry a chain through it, same as if no path were there", () => {
    const pathCoord = { q: 1, r: 0 };
    const tileCoord = { q: 2, r: 0 };
    const pathTiles: PathTile[] = [
      { coord: pathCoord, tier: "goat_track", totalInvested: {}, upgrade: null, buildCost: {}, damaged: true },
    ];
    const extractionTiles: ExtractionTile[] = [
      { coord: tileCoord, resource: "food", tier: "small", stockpile: 0, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
    ];

    expect(findResourceTileConnection(extractionTiles, pathTiles, base, tileCoord)).toBeNull();
  });

  it("a damaged extraction tile blocks propagation through it to the rest of its cluster", () => {
    // base - path(1,0) - foodA(2,0, damaged) - foodB(3,0): foodB can only reach base via foodA.
    const pathCoord = { q: 1, r: 0 };
    const tileA = { q: 2, r: 0 };
    const tileB = { q: 3, r: 0 };
    const pathTiles: PathTile[] = [{ coord: pathCoord, tier: "goat_track", totalInvested: {}, upgrade: null, buildCost: {}, damaged: false }];
    const extractionTiles: ExtractionTile[] = [
      { coord: tileA, resource: "food", tier: "small", stockpile: 0, totalInvested: {}, upgrade: null, buildCost: {}, damaged: true },
      { coord: tileB, resource: "food", tier: "small", stockpile: 0, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false },
    ];

    expect(findResourceTileConnection(extractionTiles, pathTiles, base, tileB)).toBeNull();
  });
});

describe("throughputMultiplierForChain", () => {
  it("matches 0.75^(mountain tiles in chain)", () => {
    const tweaks = loadRealTweaks();
    const seed = 3;
    const chain = [
      { q: 1, r: 0 },
      { q: 2, r: 0 },
      { q: 3, r: 0 },
    ];
    const mountainCount = chain.filter((c) => terrainAt(seed, c) === "mountain").length;
    expect(throughputMultiplierForChain(tweaks, seed, chain)).toBeCloseTo(0.75 ** mountainCount);
  });
});
