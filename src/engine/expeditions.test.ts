import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import type { Barracks } from "../data/barracks";
import type { OutpostRecord, OutpostsRecord } from "../data/outposts";
import type { TerritoryRecord } from "../data/territory";
import type { Tower } from "../data/towers";
import { tweaksSchema } from "../data/tweaksSchema";
import {
  ASSAULT_CORRIDOR,
  TERRITORY_CORRIDOR,
  expeditionPathIndexAt,
  expeditionProvisionsCost,
  expeditionTravelDurationMs,
  findBestExpeditionRoute,
  partyAttackPower,
  provisionsRefund,
  reinforceProvisionsCost,
  reinforceTravelDurationMs,
  stationExpeditionAsGarrison,
  stepCorridorWalk,
} from "./expeditions";
import { garrisonAt } from "./garrisons";
import { axialDistance, axialKey, axialNeighbors, axialSpiral, mapCenter, type Axial } from "./hexCoords";
import { terrainAt } from "./terrain";
import type { Expedition } from "../data/expeditions";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

function makeBarracks(coord: Axial, overrides: Partial<Barracks> = {}): Barracks {
  return { coord, level: 1, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false, ...overrides };
}

function makeTower(coord: Axial, overrides: Partial<Tower> = {}): Tower {
  return { coord, level: 1, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false, ...overrides };
}

function makeOutpost(coord: Axial, overrides: Partial<OutpostRecord> = {}): OutpostRecord {
  return {
    id: `outpost-${axialKey(coord)}`,
    coord,
    reinforcementLevel: 0,
    currentHp: 100,
    reinforcementAction: null,
    convertedAt: 0,
    originalDenLevel: 1,
    ...overrides,
  };
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

  it("returns null when there are no candidate structures at all", () => {
    const tweaks = loadRealTweaks();
    const destination = findLandTile(seed, base, 1);
    const territory: TerritoryRecord = { base, owned: [base, destination] };
    const result = findBestExpeditionRoute(tweaks, seed, [], [], [], territory, [], gridSize, destination);
    expect(result).toBeNull();
  });

  it("returns null when the only barracks is damaged", () => {
    const tweaks = loadRealTweaks();
    const destination = findLandTile(seed, base, 1);
    const territory: TerritoryRecord = { base, owned: [base, destination] };
    const barracksList = [makeBarracks(base, { damaged: true })];
    const result = findBestExpeditionRoute(tweaks, seed, barracksList, [], [], territory, [], gridSize, destination);
    expect(result).toBeNull();
  });

  it("returns null when the destination isn't owned or scouted", () => {
    const tweaks = loadRealTweaks();
    const territory: TerritoryRecord = { base, owned: [base] };
    const barracksList = [makeBarracks(base)];
    const farAway = findLandTile(seed, base, 50);
    const result = findBestExpeditionRoute(tweaks, seed, barracksList, [], [], territory, [], gridSize, farAway);
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

    const result = findBestExpeditionRoute(tweaks, seed, barracksList, [], [], territory, [], gridSize, destination);
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
    const result = findBestExpeditionRoute(tweaks, seed, barracksList, [], [], territory, scoutedTiles, gridSize, destination);
    expect(result).not.toBeNull();
    expect(result!.path[0]).toEqual(base);
    expect(result!.path[result!.path.length - 1]).toEqual(destination);
  });

  it("considers a tower or an outpost as a valid origin, alongside barracks", () => {
    const tweaks = loadRealTweaks();
    // farBarracks is the only barracks, reachable only via a guaranteed
    // 6-hop chain; nearTower sits directly adjacent to the destination — its
    // route must win on cost regardless of actual seed terrain (same
    // reasoning as the barracks-vs-barracks test above).
    const nearChain = landChain(seed, base, 2);
    const destination = nearChain[1];
    const nearTowerCoord = base;
    const farChain = landChain(seed, destination, 6, [nearTowerCoord]);
    const farBarracksCoord = farChain[5];

    const owned = [...nearChain, ...farChain];
    const territory: TerritoryRecord = { base, owned };
    const barracksList = [makeBarracks(farBarracksCoord)];
    const towers = [makeTower(nearTowerCoord)];
    const outposts: OutpostsRecord = [];

    const result = findBestExpeditionRoute(tweaks, seed, barracksList, towers, outposts, territory, [], gridSize, destination);
    expect(result).not.toBeNull();
    expect(result!.origin).toEqual(nearTowerCoord);

    // An outpost at the same coord as the tower is an equally valid origin —
    // dropping the tower and barracks candidates entirely still finds the
    // same cheap route via the outpost alone.
    const outpostOnlyResult = findBestExpeditionRoute(
      tweaks,
      seed,
      [],
      [],
      [makeOutpost(nearTowerCoord)],
      territory,
      [],
      gridSize,
      destination,
    );
    expect(outpostOnlyResult).not.toBeNull();
    expect(outpostOnlyResult!.origin).toEqual(nearTowerCoord);
  });

  it("ignores a damaged or still-under-construction tower as an origin candidate", () => {
    const tweaks = loadRealTweaks();
    const destination = findLandTile(seed, base, 1);
    const territory: TerritoryRecord = { base, owned: [base, destination] };
    const damagedTower = [makeTower(base, { damaged: true })];
    const underConstructionTower = [makeTower(base, { buildStartedAt: Date.now() })];
    expect(findBestExpeditionRoute(tweaks, seed, [], damagedTower, [], territory, [], gridSize, destination)).toBeNull();
    expect(
      findBestExpeditionRoute(tweaks, seed, [], underConstructionTower, [], territory, [], gridSize, destination),
    ).toBeNull();
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
  it("scales with route cost alone at the default 1x speed", () => {
    const tweaks = loadRealTweaks();
    expect(expeditionTravelDurationMs(tweaks, 5, 1)).toBeCloseTo(5 * tweaks.expeditions.travel_seconds_per_cost * 1000);
  });

  it("is 0 for a free route", () => {
    const tweaks = loadRealTweaks();
    expect(expeditionTravelDurationMs(tweaks, 0, 1)).toBe(0);
  });

  it("divides duration by the troop-speed research multiplier", () => {
    const tweaks = loadRealTweaks();
    expect(expeditionTravelDurationMs(tweaks, 5, 2)).toBeCloseTo((5 * tweaks.expeditions.travel_seconds_per_cost * 1000) / 2);
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

describe("expeditionPathIndexAt", () => {
  it("interpolates linearly between departedAt and arriveAt, rounding to the nearest path index", () => {
    expect(expeditionPathIndexAt(0, 100, 0, 5)).toBe(0);
    expect(expeditionPathIndexAt(0, 100, 100, 5)).toBe(4);
    expect(expeditionPathIndexAt(0, 100, 50, 5)).toBe(2); // fraction 0.5 * 4 = 2
  });

  it("clamps to the final index once now is past arriveAt", () => {
    expect(expeditionPathIndexAt(0, 100, 200, 5)).toBe(4);
  });

  it("treats an arriveAt <= departedAt schedule as already fully arrived", () => {
    expect(expeditionPathIndexAt(100, 100, 50, 5)).toBe(4);
  });
});

describe("stepCorridorWalk", () => {
  const base = { q: 0, r: 0 };
  const noHordes = new Map<string, number>();

  it("resolves every newly-reached tile up to targetIndex, including the destination, when attack power beats every tile's defense", () => {
    const tweaks = loadRealTweaks();
    const path: Axial[] = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
    const result = stepCorridorWalk(tweaks, path, 0, path.length - 1, [], base, 1_000_000, noHordes);
    expect(result.death).toBeNull();
    expect(result.resolvedIndex).toBe(path.length - 1);
    expect(result.claimedTiles).toEqual([path[1], path[2]]); // path[0] is resolvedIndex 0 already, never re-fought
  });

  it("skips already-owned tiles as free passage, without needing to beat their defense", () => {
    const tweaks = loadRealTweaks();
    const path: Axial[] = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
    // attackPower of 0 would fail every unowned tile's fight, so resolving
    // cleanly proves the owned tiles never triggered a fight check at all.
    const result = stepCorridorWalk(tweaks, path, 0, path.length - 1, path, base, 0, noHordes);
    expect(result.death).toBeNull();
    expect(result.resolvedIndex).toBe(path.length - 1);
    expect(result.claimedTiles).toEqual([]);
  });

  it("stops at (and does not claim) the first tile it can't beat, reporting a tile_defense death there", () => {
    const tweaks = loadRealTweaks();
    // distance 1 -> defense tile_defense_base + tile_defense_per_distance;
    // distance 100 -> much higher defense than a small attackPower can meet.
    const path: Axial[] = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 100, r: 0 }];
    const weakAttack = tweaks.territory_expansion.tile_defense_base + tweaks.territory_expansion.tile_defense_per_distance;
    // path[0] is the origin structure's own tile, which sits on already-owned ground.
    const result = stepCorridorWalk(tweaks, path, 0, path.length - 1, [base], base, weakAttack, noHordes);
    expect(result.resolvedIndex).toBe(1); // stopped one before the failing tile (index 2)
    expect(result.claimedTiles).toEqual([{ q: 1, r: 0 }]);
    expect(result.death).toEqual({ tile: { q: 100, r: 0 }, cause: { kind: "tile_defense", attackPower: weakAttack, defense: expect.any(Number) } });
  });

  it("dies with zero tiles claimed when even the first unowned tile in range can't be beaten", () => {
    const tweaks = loadRealTweaks();
    const path: Axial[] = [{ q: 0, r: 0 }, { q: 100, r: 0 }];
    const result = stepCorridorWalk(tweaks, path, 0, path.length - 1, [base], base, 0, noHordes);
    expect(result.resolvedIndex).toBe(0);
    expect(result.claimedTiles).toEqual([]);
    expect(result.death?.tile).toEqual({ q: 100, r: 0 });
  });

  it("resumes from a non-zero resolvedIndex without re-fighting already-resolved tiles", () => {
    const tweaks = loadRealTweaks();
    const path: Axial[] = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: 3, r: 0 }];
    // First step only advances to index 1.
    const first = stepCorridorWalk(tweaks, path, 0, 1, [], base, 1_000_000, noHordes);
    expect(first.resolvedIndex).toBe(1);
    expect(first.claimedTiles).toEqual([path[1]]);
    // Second step resumes from index 1 and finishes the route — only the
    // remaining tiles are claimed, path[1] isn't re-fought or re-claimed.
    const second = stepCorridorWalk(tweaks, path, first.resolvedIndex, path.length - 1, [], base, 1_000_000, noHordes);
    expect(second.death).toBeNull();
    expect(second.resolvedIndex).toBe(path.length - 1);
    expect(second.claimedTiles).toEqual([path[2], path[3]]);
  });

  it("a horde occupying the next tile kills the party outright, before any defense check — even one it could otherwise beat", () => {
    const tweaks = loadRealTweaks();
    const path: Axial[] = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
    const hordeSizeByKey = new Map([[axialKey(path[1]), 5]]);
    const result = stepCorridorWalk(tweaks, path, 0, path.length - 1, [], base, 1_000_000, hordeSizeByKey, ASSAULT_CORRIDOR);
    expect(result.resolvedIndex).toBe(0);
    expect(result.claimedTiles).toEqual([]);
    expect(result.death).toEqual({ tile: path[1], cause: { kind: "horde_blocked", hordeSize: 5 } });
  });

  it("an already-owned tile is still free passage even when a horde occupies a later tile on the same step", () => {
    const tweaks = loadRealTweaks();
    const path: Axial[] = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
    const hordeSizeByKey = new Map([[axialKey(path[2]), 5]]);
    // attackPower of 0 would fail path[1]'s fight if it weren't owned.
    const result = stepCorridorWalk(tweaks, path, 0, path.length - 1, [path[1]], base, 0, hordeSizeByKey, ASSAULT_CORRIDOR);
    expect(result.resolvedIndex).toBe(1); // free-passed path[1], then died at the horde on path[2]
    expect(result.claimedTiles).toEqual([]);
    expect(result.death).toEqual({ tile: path[2], cause: { kind: "horde_blocked", hordeSize: 5 } });
  });
});

describe("stepCorridorWalk territory mode", () => {
  const base = { q: 0, r: 0 };
  const noHordes = new Map<string, number>();

  it("free-claims unowned scouted tiles without a tileDefense fight", () => {
    const tweaks = loadRealTweaks();
    const path: Axial[] = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 100, r: 0 }];
    const result = stepCorridorWalk(
      tweaks,
      path,
      0,
      path.length - 1,
      [base],
      base,
      0,
      noHordes,
      TERRITORY_CORRIDOR,
    );
    expect(result.death).toBeNull();
    expect(result.resolvedIndex).toBe(path.length - 1);
    expect(result.claimedTiles).toEqual([path[1], path[2]]);
  });

  it("clears a weaker horde and continues with no losses", () => {
    const tweaks = loadRealTweaks();
    const path: Axial[] = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
    const hordeSizeByKey = new Map([[axialKey(path[1]), 5]]);
    const result = stepCorridorWalk(
      tweaks,
      path,
      0,
      path.length - 1,
      [base],
      base,
      10,
      hordeSizeByKey,
      TERRITORY_CORRIDOR,
    );
    expect(result.death).toBeNull();
    expect(result.clearedHordeKeys).toEqual([axialKey(path[1])]);
    expect(result.claimedTiles).toEqual([path[1], path[2]]);
    expect(result.resolvedIndex).toBe(path.length - 1);
  });

  it("wipes when a path horde outguns the party", () => {
    const tweaks = loadRealTweaks();
    const path: Axial[] = [{ q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }];
    const hordeSizeByKey = new Map([[axialKey(path[1]), 50]]);
    const result = stepCorridorWalk(
      tweaks,
      path,
      0,
      path.length - 1,
      [base],
      base,
      10,
      hordeSizeByKey,
      TERRITORY_CORRIDOR,
    );
    expect(result.death).toEqual({ tile: path[1], cause: { kind: "horde_blocked", hordeSize: 50 } });
    expect(result.claimedTiles).toEqual([]);
  });
});

describe("provisionsRefund", () => {
  it("refunds half when recalled halfway through a 20-tile outbound", () => {
    expect(provisionsRefund(100, 10, 20)).toBe(50);
  });

  it("refunds nothing when outbound is complete (arrival recall)", () => {
    expect(provisionsRefund(100, 20, 20)).toBe(0);
  });

  it("refunds everything when nothing has been resolved yet", () => {
    expect(provisionsRefund(100, 0, 20)).toBe(100);
  });
});

describe("reinforce quotes", () => {
  it("halves provisions and travel vs a normal expedition quote", () => {
    const tweaks = loadRealTweaks();
    const fullFood = expeditionProvisionsCost(tweaks, 10, 5);
    const fullMs = expeditionTravelDurationMs(tweaks, 5, 1);
    expect(reinforceProvisionsCost(tweaks, 10, 5)).toBeCloseTo(fullFood * tweaks.expeditions.reinforce_cost_multiplier);
    expect(reinforceTravelDurationMs(tweaks, 5, 1)).toBeCloseTo(fullMs * tweaks.expeditions.reinforce_cost_multiplier);
  });
});

describe("stationExpeditionAsGarrison", () => {
  it("merges the party into a garrison at the destination and removes the expedition", () => {
    const dest = { q: 3, r: -1 };
    const expedition: Expedition = {
      id: "exp-1",
      target: dest,
      origin: { q: 0, r: 0 },
      path: [{ q: 0, r: 0 }, { q: 1, r: 0 }, dest],
      militiaCommitted: 4,
      junkyardKnightCommitted: 1,
      crossBowSniperCommitted: 2,
      departedAt: 0,
      arriveAt: 1000,
      resolvedIndex: 2,
      phase: "awaitingOrders",
      provisionsPaid: 40,
      outboundTileCount: 2,
      decisionDeadlineAt: 5000,
      joinExpeditionId: null,
    };
    const other: Expedition = { ...expedition, id: "exp-2", militiaCommitted: 1, junkyardKnightCommitted: 0, crossBowSniperCommitted: 0 };
    const result = stationExpeditionAsGarrison(expedition, [], [expedition, other]);
    expect(result.expeditions.map((e) => e.id)).toEqual(["exp-2"]);
    expect(axialKey(result.coord)).toBe(axialKey(dest));
    expect(garrisonAt(result.garrisons, dest)).toEqual({
      coord: dest,
      militiaCount: 4,
      junkyardKnightCount: 1,
      crossBowSniperCount: 2,
    });
  });

  it("stacks onto an existing garrison at the same hex", () => {
    const dest = { q: 2, r: 2 };
    const expedition: Expedition = {
      id: "exp-1",
      target: dest,
      origin: { q: 0, r: 0 },
      path: [dest],
      militiaCommitted: 3,
      junkyardKnightCommitted: 0,
      crossBowSniperCommitted: 0,
      departedAt: 0,
      arriveAt: 1000,
      resolvedIndex: 0,
      phase: "awaitingOrders",
      provisionsPaid: 10,
      outboundTileCount: 0,
      decisionDeadlineAt: null,
      joinExpeditionId: null,
    };
    const result = stationExpeditionAsGarrison(
      expedition,
      [{ coord: dest, militiaCount: 2, junkyardKnightCount: 1, crossBowSniperCount: 0 }],
      [expedition],
    );
    expect(result.garrisons).toHaveLength(1);
    expect(garrisonAt(result.garrisons, dest)).toEqual({
      coord: dest,
      militiaCount: 5,
      junkyardKnightCount: 1,
      crossBowSniperCount: 0,
    });
  });
});
