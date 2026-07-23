import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import type { ScoutSkiffRecord } from "../data/scoutSkiffs";
import { axialKey, axialNeighbors, axialSpiral, type Axial } from "./hexCoords";
import { terrainAt } from "./terrain";
import { advanceScoutSkiffs } from "./scoutSkiffs";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

const gridSize = 128;

/** A water tile with at least one water neighbor, so a skiff spawned there can actually move. */
function findWaterCoord(seed: number): Axial {
  for (const coord of axialSpiral({ q: 64, r: 64 }, 40)) {
    if (terrainAt(seed, coord) === "water" && axialNeighbors(coord).some((n) => terrainAt(seed, n) === "water")) {
      return coord;
    }
  }
  throw new Error("no suitable water coord found near map center for this seed");
}

function makeSkiff(coord: Axial, overrides: Partial<ScoutSkiffRecord> = {}): ScoutSkiffRecord {
  return { id: "skiff-1", coord, homeDockCoord: coord, prevCoord: null, spawnedAt: 0, buildStartedAt: null, ...overrides };
}

/** Runs `steps` single-step advances, threading skiff/scoutedTiles state through, and returns the recorded coord path (including the start). */
function walk(
  tweaks: ReturnType<typeof loadRealTweaks>,
  seed: number,
  start: Axial,
  steps: number,
): { path: Axial[]; scoutedTiles: Axial[] } {
  let skiffs: ScoutSkiffRecord[] = [makeSkiff(start)];
  let scoutedTiles: Axial[] = [];
  const path: Axial[] = [start];

  for (let i = 0; i < steps; i++) {
    const result = advanceScoutSkiffs(tweaks, skiffs, scoutedTiles, seed, gridSize, tweaks.docks.scout_skiff.seconds_per_step);
    skiffs = result.skiffs;
    scoutedTiles = result.scoutedTiles;
    path.push(skiffs[0].coord);
  }

  return { path, scoutedTiles };
}

describe("advanceScoutSkiffs", () => {
  it("only ever steps onto water tiles", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findWaterCoord(seed);

    const { path } = walk(tweaks, seed, start, 20);

    for (const coord of path) {
      expect(terrainAt(seed, coord)).toBe("water");
    }
  });

  it("excludes the tile it just came from when another water option exists — no pure back-and-forth", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findWaterCoord(seed);

    const { path } = walk(tweaks, seed, start, 30);

    for (let i = 2; i < path.length; i++) {
      if (axialKey(path[i - 2]) !== axialKey(path[i])) continue;
      // Only acceptable if the tile in between was a dead end (its only
      // water neighbor was the tile the skiff had just come from).
      const waterNeighbors = axialNeighbors(path[i - 1]).filter((n) => terrainAt(seed, n) === "water");
      expect(waterNeighbors.length).toBeLessThanOrEqual(1);
    }
  });

  it("appends every newly-visited tile to scoutedTiles exactly once, even if revisited later", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findWaterCoord(seed);

    const { scoutedTiles } = walk(tweaks, seed, start, 25);

    const keys = scoutedTiles.map(axialKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("is deterministic given the same seed and inputs", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findWaterCoord(seed);
    const skiffs = [makeSkiff(start)];

    const first = advanceScoutSkiffs(tweaks, skiffs, [], seed, gridSize, tweaks.docks.scout_skiff.seconds_per_step * 10);
    const second = advanceScoutSkiffs(tweaks, skiffs, [], seed, gridSize, tweaks.docks.scout_skiff.seconds_per_step * 10);

    expect(second.skiffs).toEqual(first.skiffs);
    expect(second.scoutedTiles).toEqual(first.scoutedTiles);
  });

  it("does nothing for zero or sub-step elapsed time, or no skiffs", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findWaterCoord(seed);
    const skiffs = [makeSkiff(start)];

    const zero = advanceScoutSkiffs(tweaks, skiffs, [], seed, gridSize, 0);
    expect(zero.skiffs).toBe(skiffs);

    const subStep = advanceScoutSkiffs(tweaks, skiffs, [], seed, gridSize, tweaks.docks.scout_skiff.seconds_per_step - 1);
    expect(subStep.skiffs).toBe(skiffs);

    const noSkiffs = advanceScoutSkiffs(tweaks, [], [], seed, gridSize, 100);
    expect(noSkiffs.skiffs).toEqual([]);
  });

  it("does not move or scout a skiff still under construction (buildStartedAt set)", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findWaterCoord(seed);
    const skiffs = [makeSkiff(start, { buildStartedAt: 0 })];

    const result = advanceScoutSkiffs(tweaks, skiffs, [], seed, gridSize, tweaks.docks.scout_skiff.seconds_per_step * 10);

    expect(result.skiffs).toEqual(skiffs);
    expect(result.scoutedTiles).toEqual([]);
  });

  it("wanders when buildStartedAt is missing (legacy saves) — same == null gate as isStructureActive", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findWaterCoord(seed);
    const skiffs = [makeSkiff(start, { buildStartedAt: undefined as unknown as null })];

    const result = advanceScoutSkiffs(tweaks, skiffs, [], seed, gridSize, tweaks.docks.scout_skiff.seconds_per_step * 10);

    expect(axialKey(result.skiffs[0].coord)).not.toBe(axialKey(start));
  });
});
