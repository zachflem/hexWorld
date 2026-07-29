import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import type { ScoutSkiffRecord } from "../data/scoutSkiffs";
import { axialKey, axialNeighbors, axialSpiral, isWithinMapBounds, type Axial } from "./hexCoords";
import { terrainAt } from "./terrain";
import { advanceScoutSkiffs } from "./scoutSkiffs";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/profiles/default/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

const gridSize = 128;

/** A water tile with ≥2 water neighbors (open water), so a skiff can actually wander. */
function findWaterCoord(seed: number): Axial {
  for (let r = 0; r < gridSize; r++) {
    for (let col = 0; col < gridSize; col++) {
      const coord: Axial = { q: col - Math.floor(r / 2), r };
      if (terrainAt(seed, coord) !== "water") continue;
      const waterNeighbors = axialNeighbors(coord).filter((n) => terrainAt(seed, n) === "water");
      if (waterNeighbors.length >= 2) return coord;
    }
  }
  throw new Error("no suitable open-water coord found for this seed");
}

function makeSkiff(coord: Axial, overrides: Partial<ScoutSkiffRecord> = {}): ScoutSkiffRecord {
  return {
    id: "skiff-1",
    coord,
    homeDockCoord: coord,
    prevCoord: null,
    spawnedAt: 0,
    buildStartedAt: null,
    stepProgressSeconds: 0,
    ...overrides,
  };
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
    const stepSec = tweaks.docks.scout_skiff.seconds_per_step;

    const zero = advanceScoutSkiffs(tweaks, skiffs, [], seed, gridSize, 0);
    expect(zero.skiffs).toBe(skiffs);

    const subStep = advanceScoutSkiffs(tweaks, skiffs, [], seed, gridSize, stepSec - 1);
    expect(axialKey(subStep.skiffs[0].coord)).toBe(axialKey(start));
    expect(subStep.skiffs[0].stepProgressSeconds).toBe(stepSec - 1);
    expect(subStep.scoutedTiles).toEqual([]);

    const noSkiffs = advanceScoutSkiffs(tweaks, [], [], seed, gridSize, 100);
    expect(noSkiffs.skiffs).toEqual([]);
  });

  it("accumulates live 1s ticks into a step (regression: floor(1/seconds_per_step) discarded progress)", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findWaterCoord(seed);
    const stepSec = tweaks.docks.scout_skiff.seconds_per_step;
    let skiffs = [makeSkiff(start)];

    for (let i = 0; i < stepSec - 1; i++) {
      const mid = advanceScoutSkiffs(tweaks, skiffs, [], seed, gridSize, 1);
      skiffs = mid.skiffs;
      expect(axialKey(skiffs[0].coord)).toBe(axialKey(start));
    }

    const result = advanceScoutSkiffs(tweaks, skiffs, [], seed, gridSize, 1);
    expect(axialKey(result.skiffs[0].coord)).not.toBe(axialKey(start));
    expect(result.skiffs[0].stepProgressSeconds).toBe(0);
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

  it("with revealRadius 1, scouts the stepped tile plus its full ring", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findWaterCoord(seed);

    const result = advanceScoutSkiffs(
      tweaks,
      [makeSkiff(start)],
      [],
      seed,
      gridSize,
      tweaks.docks.scout_skiff.seconds_per_step,
      { revealRadius: 1 },
    );

    const stepped = result.skiffs[0].coord;
    const expectedAll = axialSpiral(stepped, 1).filter((c) => isWithinMapBounds(c, gridSize));
    expect(result.scoutedTiles.map(axialKey).sort()).toEqual(expectedAll.map(axialKey).sort());
    expect(result.scoutedTiles.length).toBeGreaterThan(1);
  });

  it("with claimOwnership, returns claimedTiles matching scouted tiles", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findWaterCoord(seed);

    const result = advanceScoutSkiffs(
      tweaks,
      [makeSkiff(start)],
      [],
      seed,
      gridSize,
      tweaks.docks.scout_skiff.seconds_per_step,
      { claimOwnership: true },
    );

    expect(result.claimedTiles.length).toBeGreaterThan(0);
    expect(result.claimedTiles.map(axialKey)).toEqual([axialKey(result.skiffs[0].coord)]);
  });

  it("with claimOwnership + revealRadius 1, claims the full ring", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findWaterCoord(seed);

    const result = advanceScoutSkiffs(
      tweaks,
      [makeSkiff(start)],
      [],
      seed,
      gridSize,
      tweaks.docks.scout_skiff.seconds_per_step,
      { revealRadius: 1, claimOwnership: true },
    );

    const stepped = result.skiffs[0].coord;
    const expectedAll = axialSpiral(stepped, 1).filter((c) => isWithinMapBounds(c, gridSize));
    expect(result.claimedTiles.map(axialKey).sort()).toEqual(expectedAll.map(axialKey).sort());
  });

  it("claimOwnership skips unclaimableKeys and hordeKeys", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findWaterCoord(seed);

    const result = advanceScoutSkiffs(
      tweaks,
      [makeSkiff(start)],
      [],
      seed,
      gridSize,
      tweaks.docks.scout_skiff.seconds_per_step,
      {
        claimOwnership: true,
        unclaimableKeys: new Set([axialKey(start)]),
        hordeKeys: new Set([axialKey(start)]),
      },
    );

    // The stepped tile is blocked — the skiff moved away from start, so it
    // should still claim the destination tile (which isn't in the blocked sets).
    const steppedKey = axialKey(result.skiffs[0].coord);
    expect(result.claimedTiles.map(axialKey)).toContain(steppedKey);
  });

  it("without claimOwnership, claimedTiles is empty", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findWaterCoord(seed);

    const result = advanceScoutSkiffs(
      tweaks,
      [makeSkiff(start)],
      [],
      seed,
      gridSize,
      tweaks.docks.scout_skiff.seconds_per_step,
    );

    expect(result.claimedTiles).toEqual([]);
  });
});
