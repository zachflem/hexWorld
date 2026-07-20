import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import type { Barracks } from "../data/barracks";
import type { TerritoryRecord } from "../data/territory";
import { tweaksSchema } from "../data/tweaksSchema";
import {
  expeditionProvisionsCost,
  expeditionTravelDurationMs,
  findBestExpeditionRoute,
  partyAttackPower,
  resolveExpeditionWalk,
} from "./expeditions";
import { axialDistance, axialKey, axialNeighbors, axialSpiral, mapCenter, type Axial } from "./hexCoords";
import { terrainAt } from "./terrain";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

function makeBarracks(coord: Axial, overrides: Partial<Barracks> = {}): Barracks {
  return { coord, level: 1, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false, ...overrides };
}

/** First non-water tile at or beyond `minRadius` from `near`, for deterministic land-based fixtures (mirrors pathfinding.test.ts's findLandTile). */
function findLandTile(seed: number, near: Axial, minRadius: number, maxRadius = 60): Axial {
  for (const coord of axialSpiral(near, maxRadius)) {
    if (axialDistance(near, coord) < minRadius) continue;
    if (terrainAt(seed, coord) !== "water") return coord;
  }
  throw new Error(`no land tile found within radius ${maxRadius} of (${near.q},${near.r}) for seed ${seed}`);
}

/**
 * Greedily walks `length` hops of contiguous land, never stepping onto a
 * tile within distance 1 of anything in `avoidNear` — keeps a constructed
 * multi-hop "far barracks" corridor from accidentally shortcutting through a
 * "near barracks" tile placed elsewhere in the same test.
 */
function landChain(seed: number, start: Axial, length: number, avoidNear: Axial[] = []): Axial[] {
  const chain: Axial[] = [start];
  const visited = new Set([axialKey(start)]);
  let current = start;
  while (chain.length < length) {
    const next = axialNeighbors(current).find(
      (n) =>
        !visited.has(axialKey(n)) &&
        terrainAt(seed, n) !== "water" &&
        !avoidNear.some((a) => axialDistance(a, n) <= 1),
    );
    if (!next) throw new Error(`no land chain of length ${length} found from (${start.q},${start.r}) for seed ${seed}`);
    chain.push(next);
    visited.add(axialKey(next));
    current = next;
  }
  return chain;
}

describe("findBestExpeditionRoute", () => {
  const seed = 3;
  const gridSize = 128;

  const base = findLandTile(seed, mapCenter(gridSize), 0);

  it("returns null when there are no barracks at all", () => {
    const tweaks = loadRealTweaks();
    const destination = findLandTile(seed, base, 1);
    const territory: TerritoryRecord = { base, owned: [base, destination] };
    const result = findBestExpeditionRoute(tweaks, seed, [], territory, [], gridSize, destination);
    expect(result).toBeNull();
  });

  it("returns null when the only barracks is damaged", () => {
    const tweaks = loadRealTweaks();
    const destination = findLandTile(seed, base, 1);
    const territory: TerritoryRecord = { base, owned: [base, destination] };
    const barracksList = [makeBarracks(base, { damaged: true })];
    const result = findBestExpeditionRoute(tweaks, seed, barracksList, territory, [], gridSize, destination);
    expect(result).toBeNull();
  });

  it("returns null when the destination isn't owned or scouted", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base, owned: [base] };
    const barracksList = [makeBarracks(base)];
    const farAway = findLandTile(seed, base, 50);
    const result = findBestExpeditionRoute(tweaks, seed, barracksList, territory, [], gridSize, farAway);
    expect(result).toBeNull();
  });

  it("picks the cheapest route across several non-damaged barracks, not just the nearest", () => {
    const tweaks = loadRealTweaks();
    // nearBarracks sits directly adjacent to the destination — worst case,
    // 1 tile's cost never exceeds 4 (mountain, tweaks.jsonc
    // horde.pathfinding.terrain_cost). farBarracks only reaches the
    // destination via a guaranteed 5-hop, all-land chain — best case,
    // 5 tiles' cost is never less than 5 (cheapest terrain is 1). So
    // nearBarracks's route must always win, regardless of actual seed terrain.
    const nearChain = landChain(seed, base, 2);
    const destination = nearChain[1];
    const nearBarracks = base;
    const farChain = landChain(seed, destination, 6, [nearBarracks]);
    const farBarracks = farChain[5];

    const owned = [...nearChain, ...farChain];
    const territory: TerritoryRecord = { base, owned };
    const barracksList = [makeBarracks(nearBarracks), makeBarracks(farBarracks)];

    const result = findBestExpeditionRoute(tweaks, seed, barracksList, territory, [], gridSize, destination);
    expect(result).not.toBeNull();
    expect(result!.origin).toEqual(nearBarracks);
    expect(result!.path[0]).toEqual(nearBarracks);
    expect(result!.path[result!.path.length - 1]).toEqual(destination);
  });

  it("only ever searches through owned-or-scouted tiles", () => {
    const tweaks = loadRealTweaks();
    const destination = landChain(seed, base, 2)[1]; // a direct land neighbor of base
    const territory: TerritoryRecord = { base, owned: [base] };
    const barracksList = [makeBarracks(base)];
    const scoutedTiles = [destination];
    const result = findBestExpeditionRoute(tweaks, seed, barracksList, territory, scoutedTiles, gridSize, destination);
    expect(result).not.toBeNull();
    expect(result!.path[0]).toEqual(base);
    expect(result!.path[result!.path.length - 1]).toEqual(destination);
  });
});

describe("expeditionProvisionsCost", () => {
  it("scales with party size and route cost", () => {
    const tweaks = loadRealTweaks();
    expect(expeditionProvisionsCost(tweaks, 10, 5)).toBeCloseTo(10 * 5 * tweaks.expeditions.provisions_food_per_unit_per_cost);
  });

  it("is 0 for an empty party or a free route", () => {
    const tweaks = loadRealTweaks();
    expect(expeditionProvisionsCost(tweaks, 0, 5)).toBe(0);
    expect(expeditionProvisionsCost(tweaks, 10, 0)).toBe(0);
  });
});

describe("expeditionTravelDurationMs", () => {
  it("scales with route cost alone", () => {
    const tweaks = loadRealTweaks();
    expect(expeditionTravelDurationMs(tweaks, 5)).toBeCloseTo(5 * tweaks.expeditions.travel_seconds_per_cost * 1000);
  });

  it("is 0 for a free route", () => {
    const tweaks = loadRealTweaks();
    expect(expeditionTravelDurationMs(tweaks, 0)).toBe(0);
  });
});

describe("partyAttackPower", () => {
  it("sums attack power across all three committed unit types", () => {
    const tweaks = loadRealTweaks();
    const expected =
      5 * tweaks.units.militia.attack_per_unit +
      2 * tweaks.units.junkyard_knight.attack_per_unit +
      1 * tweaks.units.cross_bow_sniper.attack_per_unit;
    expect(partyAttackPower(tweaks, 5, 2, 1)).toBeCloseTo(expected);
  });

  it("is 0 for an empty party", () => {
    const tweaks = loadRealTweaks();
    expect(partyAttackPower(tweaks, 0, 0, 0)).toBe(0);
  });
});

describe("resolveExpeditionWalk", () => {
  const base = { q: 0, r: 0 };

  it("claims every tile on the path, including the destination, when attack power beats every tile's defense", () => {
    const tweaks = loadRealTweaks();
    const path: Axial[] = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
    const result = resolveExpeditionWalk(tweaks, path, [], base, 1_000_000);
    expect(result.survived).toBe(true);
    expect(result.claimedTiles).toEqual(path);
  });

  it("skips already-owned tiles as free passage, without needing to beat their defense", () => {
    const tweaks = loadRealTweaks();
    const path: Axial[] = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
    // attackPower of 0 would fail every unowned tile's fight, so surviving
    // proves the owned tiles never triggered a fight check at all.
    const result = resolveExpeditionWalk(tweaks, path, path, base, 0);
    expect(result.survived).toBe(true);
    expect(result.claimedTiles).toEqual([]);
  });

  it("claims tiles up to but excluding the first tile it can't beat, and reports survived: false", () => {
    const tweaks = loadRealTweaks();
    // distance 1 -> defense tile_defense_base + tile_defense_per_distance;
    // distance 100 -> much higher defense than a small attackPower can meet.
    const path: Axial[] = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 100, r: 0 }];
    const weakAttack = tweaks.territory_expansion.tile_defense_base + tweaks.territory_expansion.tile_defense_per_distance;
    // path[0] is the origin barracks tile, which sits on already-owned ground.
    const result = resolveExpeditionWalk(tweaks, path, [base], base, weakAttack);
    expect(result.survived).toBe(false);
    expect(result.claimedTiles).toEqual([{ q: 1, r: 0 }]);
  });

  it("wipes out with zero tiles claimed when even the first unowned tile can't be beaten", () => {
    const tweaks = loadRealTweaks();
    const path: Axial[] = [{ q: 0, r: 0 }, { q: 100, r: 0 }];
    const result = resolveExpeditionWalk(tweaks, path, [base], base, 0);
    expect(result.survived).toBe(false);
    expect(result.claimedTiles).toEqual([]);
  });
});
