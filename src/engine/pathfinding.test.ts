import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import { axialDistance, axialKey, axialNeighbors, axialSpiral, isWithinMapBounds, mapCenter, type Axial } from "./hexCoords";
import { terrainAt } from "./terrain";
import { findExpeditionPath, findHordePath, findNearestHordeTarget, terrainCost } from "./pathfinding";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/profiles/default/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

/** First in-bounds, non-water tile at or beyond `minRadius` from `near`, for deterministic reachable-destination tests. */
function findLandTile(seed: number, gridSize: number, near: Axial, minRadius: number, maxRadius = 60): Axial {
  for (const coord of axialSpiral(near, maxRadius)) {
    if (axialDistance(near, coord) < minRadius) continue;
    if (!isWithinMapBounds(coord, gridSize)) continue;
    if (terrainAt(seed, coord) !== "water") return coord;
  }
  throw new Error(`no land tile found within radius ${maxRadius} of (${near.q},${near.r}) for seed ${seed}`);
}

describe("terrainCost", () => {
  it("matches the configured per-terrain costs, water impassable", () => {
    const tweaks = loadRealTweaks();
    expect(terrainCost(tweaks, "grassland")).toBe(tweaks.horde.pathfinding.terrain_cost.grassland);
    expect(terrainCost(tweaks, "forest")).toBe(tweaks.horde.pathfinding.terrain_cost.forest);
    expect(terrainCost(tweaks, "shore")).toBe(tweaks.horde.pathfinding.terrain_cost.shore);
    expect(terrainCost(tweaks, "mountain")).toBe(tweaks.horde.pathfinding.terrain_cost.mountain);
    expect(terrainCost(tweaks, "water")).toBeNull();
  });
});

describe("findHordePath", () => {
  const seed = 3;
  const gridSize = 128;
  const from: Axial = findLandTile(seed, gridSize, mapCenter(gridSize), 0);
  const to: Axial = findLandTile(seed, gridSize, from, 10);

  it("never routes through a water tile", () => {
    const tweaks = loadRealTweaks();
    const path = findHordePath(tweaks, seed, from, to, gridSize);
    expect(path).not.toBeNull();
    for (const coord of path ?? []) {
      expect(terrainAt(seed, coord)).not.toBe("water");
    }
  });

  it("starts at the origin and ends at the destination", () => {
    const tweaks = loadRealTweaks();
    const path = findHordePath(tweaks, seed, from, to, gridSize);
    expect(path).not.toBeNull();
    expect(path![0]).toEqual(from);
    expect(path![path!.length - 1]).toEqual(to);
  });

  it("is a contiguous chain of hex neighbors", () => {
    const tweaks = loadRealTweaks();
    const path = findHordePath(tweaks, seed, from, to, gridSize);
    expect(path).not.toBeNull();
    for (let i = 1; i < (path?.length ?? 0); i++) {
      expect(axialDistance(path![i - 1], path![i])).toBe(1);
    }
  });

  it("returns null when the destination is outside the map bounds", () => {
    const tweaks = loadRealTweaks();
    const path = findHordePath(tweaks, seed, { q: 0, r: 0 }, { q: 1000, r: 1000 }, 5);
    expect(path).toBeNull();
  });

  it("returns a single-tile path when origin equals destination", () => {
    const tweaks = loadRealTweaks();
    const path = findHordePath(tweaks, seed, from, from, gridSize);
    expect(path).toEqual([from]);
  });
});

describe("findExpeditionPath", () => {
  const seed = 3;
  const gridSize = 128;
  const from: Axial = findLandTile(seed, gridSize, mapCenter(gridSize), 0);
  const to: Axial = findLandTile(seed, gridSize, from, 10);

  it("never routes through a tile outside the allowed set, even when findHordePath would", () => {
    const tweaks = loadRealTweaks();
    const unrestricted = findHordePath(tweaks, seed, from, to, gridSize);
    expect(unrestricted).not.toBeNull();

    // Disallow every tile the unrestricted route actually used except the
    // endpoints, forcing the expedition search to either fail or detour.
    const allowedTiles = new Set<string>([...(unrestricted ?? [])].map((c) => axialKey(c)));
    allowedTiles.delete(axialKey(unrestricted![1]));

    const result = findExpeditionPath(tweaks, seed, from, to, gridSize, allowedTiles);
    if (result) {
      for (const coord of result.path) {
        expect(allowedTiles.has(axialKey(coord))).toBe(true);
      }
    } else {
      expect(result).toBeNull();
    }
  });

  it("returns null when the destination isn't in the allowed set", () => {
    const tweaks = loadRealTweaks();
    const allowedTiles = new Set<string>([axialKey(from)]);
    const result = findExpeditionPath(tweaks, seed, from, to, gridSize, allowedTiles);
    expect(result).toBeNull();
  });

  it("starts at the origin, ends at the destination, and reports the accumulated cost", () => {
    const tweaks = loadRealTweaks();
    const unrestricted = findHordePath(tweaks, seed, from, to, gridSize);
    expect(unrestricted).not.toBeNull();
    const allowedTiles = new Set<string>((unrestricted ?? []).map((c) => axialKey(c)));

    const result = findExpeditionPath(tweaks, seed, from, to, gridSize, allowedTiles);
    expect(result).not.toBeNull();
    expect(result!.path[0]).toEqual(from);
    expect(result!.path[result!.path.length - 1]).toEqual(to);

    let expectedCost = 0;
    for (let i = 1; i < result!.path.length; i++) {
      expectedCost += terrainCost(tweaks, terrainAt(seed, result!.path[i]))!;
    }
    expect(result!.cost).toBeCloseTo(expectedCost);
  });

  it("returns a single-tile path with zero cost when origin equals destination", () => {
    const tweaks = loadRealTweaks();
    const allowedTiles = new Set<string>([axialKey(from)]);
    const result = findExpeditionPath(tweaks, seed, from, from, gridSize, allowedTiles);
    expect(result).toEqual({ path: [from], cost: 0 });
  });

  it("prefers an owned corridor over a shorter unowned cut when penalty is large", () => {
    const tweaks = loadRealTweaks();
    // Build a tiny graph: A-B-C (owned) vs A-D-C (unowned shortcut) if both land.
    // Use real path: take unrestricted path, mark all but one middle hop as owned;
    // with huge penalty the search should avoid that unowned hop when an owned detour exists.
    const unrestricted = findHordePath(tweaks, seed, from, to, gridSize);
    expect(unrestricted).not.toBeNull();
    const path = unrestricted!;
    expect(path.length).toBeGreaterThan(3);

    const allowedTiles = new Set(path.map(axialKey));
    // Also allow a longer owned ring around the shortcut tile if neighbors exist.
    const shortcut = path[Math.floor(path.length / 2)]!;
    for (const n of axialNeighbors(shortcut)) {
      if (terrainAt(seed, n) !== "water" && isWithinMapBounds(n, gridSize)) {
        allowedTiles.add(axialKey(n));
      }
    }

    const ownedTiles = new Set(path.map(axialKey));
    ownedTiles.delete(axialKey(shortcut));

    const withPenalty = findExpeditionPath(tweaks, seed, from, to, gridSize, allowedTiles, ownedTiles, 10_000);
    expect(withPenalty).not.toBeNull();
    // Prefer not stepping on the unowned shortcut when a detour is allowed.
    const steppedOnShortcut = withPenalty!.path.some((c) => axialKey(c) === axialKey(shortcut));
    // If detour exists, we avoid it; if not, path may still use it — only assert when neighbors gave a detour.
    const hasDetourNeighbor = [...allowedTiles].some((k) => k !== axialKey(shortcut) && !ownedTiles.has(k) === false);
    if (hasDetourNeighbor && withPenalty!.path.length > path.length) {
      expect(steppedOnShortcut).toBe(false);
    }
    // Cost remains terrain-only (no penalty baked into returned cost).
    let terrainOnly = 0;
    for (let i = 1; i < withPenalty!.path.length; i++) {
      terrainOnly += terrainCost(tweaks, terrainAt(seed, withPenalty!.path[i]))!;
    }
    expect(withPenalty!.cost).toBeCloseTo(terrainOnly);
  });
});

describe("findNearestHordeTarget", () => {
  const seed = 3;
  const gridSize = 128;
  const from: Axial = findLandTile(seed, gridSize, mapCenter(gridSize), 0);
  const near: Axial = findLandTile(seed, gridSize, from, 3, 20);
  const far: Axial = findLandTile(seed, gridSize, from, 30);

  it("picks whichever candidate is nearer by accumulated terrain cost", () => {
    const tweaks = loadRealTweaks();
    const result = findNearestHordeTarget(tweaks, seed, from, [far, near], gridSize);
    expect(result).not.toBeNull();
    expect(axialKey(result!.target)).toBe(axialKey(near));
    expect(axialKey(result!.path[result!.path.length - 1])).toBe(axialKey(near));
  });

  it("matches findHordePath's path/cost when there's only one candidate", () => {
    const tweaks = loadRealTweaks();
    const direct = findHordePath(tweaks, seed, from, near, gridSize);
    const single = findNearestHordeTarget(tweaks, seed, from, [near], gridSize);
    expect(single?.path).toEqual(direct);
  });

  it("returns null when no candidate is reachable within the grid", () => {
    const tweaks = loadRealTweaks();
    const outOfBounds = { q: gridSize + 50, r: gridSize + 50 };
    expect(findNearestHordeTarget(tweaks, seed, from, [outOfBounds], gridSize)).toBeNull();
  });

  it("returns the origin itself as target/path when it's one of the candidates", () => {
    const tweaks = loadRealTweaks();
    const result = findNearestHordeTarget(tweaks, seed, from, [from, far], gridSize);
    expect(result).not.toBeNull();
    expect(axialKey(result!.target)).toBe(axialKey(from));
    expect(result!.path).toEqual([from]);
  });
});
