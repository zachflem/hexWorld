import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import type { WanderingScoutRecord } from "../data/wanderingScouts";
import { axialKey, axialNeighbors, axialSpiral, axialToPixel, isWithinMapBounds, type Axial } from "./hexCoords";
import { terrainAt } from "./terrain";
import { advanceWanderingScouts } from "./wanderingScouts";
import { bearingStepScore } from "./lab";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

const gridSize = 128;

/** A land tile with at least one land neighbor, so a scout spawned there can actually move. */
function findLandCoord(seed: number): Axial {
  for (const coord of axialSpiral({ q: 64, r: 64 }, 40)) {
    if (terrainAt(seed, coord) !== "water" && axialNeighbors(coord).some((n) => terrainAt(seed, n) !== "water")) {
      return coord;
    }
  }
  throw new Error("no suitable land coord found near map center for this seed");
}

function makeScout(coord: Axial, overrides: Partial<WanderingScoutRecord> = {}): WanderingScoutRecord {
  return {
    id: "scout-1",
    coord,
    homeBarracksCoord: coord,
    prevCoord: null,
    spawnedAt: 0,
    buildStartedAt: null,
    stepProgressSeconds: 0,
    ...overrides,
  };
}

/** Runs `steps` single-step advances, threading scout/scoutedTiles state through, and returns the recorded coord path (including the start). */
function walk(
  tweaks: ReturnType<typeof loadRealTweaks>,
  seed: number,
  start: Axial,
  steps: number,
): { path: Axial[]; scoutedTiles: Axial[] } {
  let scouts: WanderingScoutRecord[] = [makeScout(start)];
  let scoutedTiles: Axial[] = [];
  const path: Axial[] = [start];

  for (let i = 0; i < steps; i++) {
    const result = advanceWanderingScouts(tweaks, scouts, scoutedTiles, seed, gridSize, tweaks.units.wandering_scout.seconds_per_step);
    scouts = result.scouts;
    scoutedTiles = result.scoutedTiles;
    path.push(scouts[0].coord);
  }

  return { path, scoutedTiles };
}

describe("advanceWanderingScouts", () => {
  it("only ever steps onto land tiles", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findLandCoord(seed);

    const { path } = walk(tweaks, seed, start, 20);

    for (const coord of path) {
      expect(terrainAt(seed, coord)).not.toBe("water");
    }
  });

  it("excludes the tile it just came from when another land option exists — no pure back-and-forth", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findLandCoord(seed);

    const { path } = walk(tweaks, seed, start, 30);

    for (let i = 2; i < path.length; i++) {
      if (axialKey(path[i - 2]) !== axialKey(path[i])) continue;
      const landNeighbors = axialNeighbors(path[i - 1]).filter((n) => terrainAt(seed, n) !== "water");
      expect(landNeighbors.length).toBeLessThanOrEqual(1);
    }
  });

  it("appends every newly-visited tile to scoutedTiles exactly once, even if revisited later", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findLandCoord(seed);

    const { scoutedTiles } = walk(tweaks, seed, start, 25);

    const keys = scoutedTiles.map(axialKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("is deterministic given the same seed and inputs", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findLandCoord(seed);
    const scouts = [makeScout(start)];

    const first = advanceWanderingScouts(tweaks, scouts, [], seed, gridSize, tweaks.units.wandering_scout.seconds_per_step * 10);
    const second = advanceWanderingScouts(tweaks, scouts, [], seed, gridSize, tweaks.units.wandering_scout.seconds_per_step * 10);

    expect(second.scouts).toEqual(first.scouts);
    expect(second.scoutedTiles).toEqual(first.scoutedTiles);
  });

  it("does nothing for zero or sub-step elapsed time, or no scouts", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findLandCoord(seed);
    const scouts = [makeScout(start)];
    const stepSec = tweaks.units.wandering_scout.seconds_per_step;

    const zero = advanceWanderingScouts(tweaks, scouts, [], seed, gridSize, 0);
    expect(zero.scouts).toBe(scouts);

    const subStep = advanceWanderingScouts(tweaks, scouts, [], seed, gridSize, stepSec - 1);
    expect(axialKey(subStep.scouts[0].coord)).toBe(axialKey(start));
    expect(subStep.scouts[0].stepProgressSeconds).toBe(stepSec - 1);
    expect(subStep.scoutedTiles).toEqual([]);

    const noScouts = advanceWanderingScouts(tweaks, [], [], seed, gridSize, 100);
    expect(noScouts.scouts).toEqual([]);
  });

  it("accumulates live 1s ticks into a step (regression: floor(1/seconds_per_step) discarded progress)", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findLandCoord(seed);
    const stepSec = tweaks.units.wandering_scout.seconds_per_step;
    let scouts = [makeScout(start)];

    for (let i = 0; i < stepSec - 1; i++) {
      const mid = advanceWanderingScouts(tweaks, scouts, [], seed, gridSize, 1);
      scouts = mid.scouts;
      expect(axialKey(scouts[0].coord)).toBe(axialKey(start));
    }

    const result = advanceWanderingScouts(tweaks, scouts, [], seed, gridSize, 1);
    expect(axialKey(result.scouts[0].coord)).not.toBe(axialKey(start));
    expect(result.scouts[0].stepProgressSeconds).toBe(0);
  });

  it("does not move or scout a scout still under construction (buildStartedAt set)", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findLandCoord(seed);
    const scouts = [makeScout(start, { buildStartedAt: 0 })];

    const result = advanceWanderingScouts(tweaks, scouts, [], seed, gridSize, tweaks.units.wandering_scout.seconds_per_step * 10);

    expect(result.scouts).toEqual(scouts);
    expect(result.scoutedTiles).toEqual([]);
    expect(result.labRevealed).toBe(false);
  });

  it("never awards lab clues — reveals tiles only", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findLandCoord(seed);
    const result = advanceWanderingScouts(
      tweaks,
      [makeScout(start)],
      [],
      seed,
      gridSize,
      tweaks.units.wandering_scout.seconds_per_step * 40,
      {
        signal: null,
        base: start,
        labCoord: { q: 0, r: 0 },
      },
    );
    expect(result.scoutedTiles.length).toBeGreaterThan(0);
    expect(result).not.toHaveProperty("clueAwarded");
  });
});

describe("watchtower signal bias", () => {
  it("bearingStepScore prefers neighbors aligned with the signal", () => {
    const from = { q: 0, r: 0 };
    const northish = { q: 0, r: -1 };
    const southish = { q: 0, r: 1 };
    expect(bearingStepScore(from, northish, "north")).toBeGreaterThan(bearingStepScore(from, southish, "north"));
  });

  it("with a northern signal, scouts take more northward steps than without", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findLandCoord(seed);
    const steps = 80;
    const stepSec = tweaks.units.wandering_scout.seconds_per_step;
    // Lab far north so sector bias and lab-approach pull reinforce each other.
    const farNorthLab = { q: start.q, r: start.r - 40 };

    function northDelta(path: Axial[]): number {
      let sum = 0;
      for (let i = 1; i < path.length; i++) {
        const a = axialToPixel(path[i - 1], 1);
        const b = axialToPixel(path[i], 1);
        sum += a.y - b.y;
      }
      return sum;
    }

    const control = walk(tweaks, seed, start, steps);
    let scouts = [makeScout(start)];
    let scoutedTiles: Axial[] = [];
    const biasedPath: Axial[] = [start];
    for (let i = 0; i < steps; i++) {
      const result = advanceWanderingScouts(tweaks, scouts, scoutedTiles, seed, gridSize, stepSec, {
        signal: { bearing: "north", setAt: 0 },
        base: start,
        labCoord: farNorthLab,
      });
      scouts = result.scouts;
      scoutedTiles = result.scoutedTiles;
      biasedPath.push(scouts[0].coord);
    }

    expect(northDelta(biasedPath)).toBeGreaterThan(northDelta(control.path));
  });

  it("with a signal, prefers stepping onto an adjacent unscouted lab", () => {
    const tweaks = loadRealTweaks();
    const seed = 5;
    const start = findLandCoord(seed);
    const labNeighbor = axialNeighbors(start).find(
      (n) => isWithinMapBounds(n, gridSize) && terrainAt(seed, n) !== "water",
    );
    expect(labNeighbor).toBeDefined();

    // Many single-step trials — guided search should land on the lab often.
    let hits = 0;
    const trials = 40;
    for (let i = 0; i < trials; i++) {
      const result = advanceWanderingScouts(
        tweaks,
        [makeScout(start, { spawnedAt: i })],
        [],
        seed,
        gridSize,
        tweaks.units.wandering_scout.seconds_per_step,
        {
          signal: { bearing: "north", setAt: 0 },
          base: start,
          labCoord: labNeighbor!,
        },
      );
      if (result.labRevealed) hits += 1;
    }
    expect(hits).toBeGreaterThan(trials * 0.5);
  });
});
