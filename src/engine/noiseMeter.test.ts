import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import {
  accrueNoise,
  addActionNoise,
  noiseCap,
  noiseFloor,
  towerFloorContribution,
  wallFloorContribution,
  wallNoiseDampening,
} from "./noiseMeter";
import type { ExtractionTile } from "../data/extractionTiles";
import type { PathTile } from "../data/pathTiles";
import type { Tower } from "../data/towers";
import type { Wall } from "../data/walls";

const BASE_LEVEL = 1;

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

function extractionTile(overrides: Partial<ExtractionTile> = {}): ExtractionTile {
  return {
    coord: { q: 0, r: 0 },
    resource: "food",
    tier: "small",
    stockpile: 0,
    totalInvested: {},
    upgrade: null,
    buildCost: {},
    damaged: false,
    ...overrides,
  };
}

function pathTile(overrides: Partial<PathTile> = {}): PathTile {
  return {
    coord: { q: 0, r: 0 },
    tier: "goat_track",
    totalInvested: {},
    upgrade: null,
    buildCost: {},
    damaged: false,
    ...overrides,
  };
}

function tower(overrides: Partial<Tower> = {}): Tower {
  return { coord: { q: 0, r: 0 }, level: 1, totalInvested: {}, upgrade: null, buildCost: {}, damaged: false, ...overrides };
}

function wall(overrides: Partial<Wall> = {}): Wall {
  return {
    coord: { q: 0, r: 0 },
    tier: "wood",
    durability: 0,
    totalInvested: {},
    action: null,
    buildCost: {},
    damaged: false,
    ...overrides,
  };
}

describe("noiseCap", () => {
  it("grows linearly with base level", () => {
    const tweaks = loadRealTweaks();
    expect(noiseCap(tweaks, 1)).toBe(tweaks.noise.cap_base);
    expect(noiseCap(tweaks, 3)).toBe(tweaks.noise.cap_base + tweaks.noise.cap_per_level * 2);
  });
});

describe("noiseFloor", () => {
  it("is the ambient minimum with no structures, never 0", () => {
    const tweaks = loadRealTweaks();
    expect(noiseFloor(tweaks, [], [], [], [], BASE_LEVEL)).toBe(tweaks.noise.noise_floor_minimum);
  });

  it("sums per-tile contributions, scaled by tier for extraction tiles", () => {
    const tweaks = loadRealTweaks();
    const food = extractionTile({ coord: { q: 0, r: 0 }, resource: "food", tier: "small" });
    const largeWood = extractionTile({ coord: { q: 1, r: 0 }, resource: "wood", tier: "large" });
    const goatTrack = pathTile({ coord: { q: 2, r: 0 }, tier: "goat_track" });

    const floor = noiseFloor(tweaks, [food, largeWood], [goatTrack], [], [], BASE_LEVEL);

    const expected =
      tweaks.noise.passive_gathering_noise_floor.food +
      tweaks.noise.passive_gathering_noise_floor.wood * tweaks.noise.extraction_tier_noise_multiplier ** 2 +
      tweaks.noise.path_noise_floor.goat_track;
    expect(floor).toBeCloseTo(expected);
  });

  it("ignores extraction and path tiles still under construction", () => {
    const tweaks = loadRealTweaks();
    const underConstructionFood = extractionTile({ coord: { q: 0, r: 0 }, resource: "food", tier: "small", buildStartedAt: 0 });
    const underConstructionPath = pathTile({ coord: { q: 1, r: 0 }, tier: "goat_track", buildStartedAt: 0 });

    expect(noiseFloor(tweaks, [underConstructionFood], [underConstructionPath], [], [], BASE_LEVEL)).toBe(
      tweaks.noise.noise_floor_minimum,
    );
  });

  it("clamps at the noise cap", () => {
    const tweaks = loadRealTweaks();
    const tiles: ExtractionTile[] = Array.from({ length: 50 }, (_, i) =>
      extractionTile({ coord: { q: i, r: 0 }, resource: "power", tier: "large" }),
    );
    expect(noiseFloor(tweaks, tiles, [], [], [], BASE_LEVEL)).toBe(noiseCap(tweaks, BASE_LEVEL));
  });

  it("rises as base level rises, since the cap does", () => {
    const tweaks = loadRealTweaks();
    const tiles: ExtractionTile[] = Array.from({ length: 50 }, (_, i) =>
      extractionTile({ coord: { q: i, r: 0 }, resource: "power", tier: "large" }),
    );
    expect(noiseFloor(tweaks, tiles, [], [], [], 5)).toBe(noiseCap(tweaks, 5));
    expect(noiseFloor(tweaks, tiles, [], [], [], 5)).toBeGreaterThan(noiseFloor(tweaks, tiles, [], [], [], BASE_LEVEL));
  });
});

describe("towerFloorContribution / wallFloorContribution", () => {
  it("scales linearly with tower level, and is a sliver next to an active extraction/path tile", () => {
    const tweaks = loadRealTweaks();
    expect(towerFloorContribution(tweaks, tower({ level: 1 }))).toBeCloseTo(
      tweaks.noise.passive_watch_noise_floor.tower_per_level,
    );
    expect(towerFloorContribution(tweaks, tower({ level: 4 }))).toBeCloseTo(
      tweaks.noise.passive_watch_noise_floor.tower_per_level * 4,
    );
    // "Almost silent" per the design intent — well under the smallest active extraction floor (food).
    expect(towerFloorContribution(tweaks, tower({ level: 4 }))).toBeLessThan(tweaks.noise.passive_gathering_noise_floor.food);
  });

  it("is 0 for a damaged tower — non-functional across the board", () => {
    const tweaks = loadRealTweaks();
    expect(towerFloorContribution(tweaks, tower({ level: 4, damaged: true }))).toBe(0);
  });

  it("scales with wall tier, and is a sliver next to an active extraction/path tile", () => {
    const tweaks = loadRealTweaks();
    expect(wallFloorContribution(tweaks, wall({ tier: "wood" }))).toBeCloseTo(
      tweaks.noise.passive_watch_noise_floor.wall_per_tier_level * 1,
    );
    expect(wallFloorContribution(tweaks, wall({ tier: "steel" }))).toBeCloseTo(
      tweaks.noise.passive_watch_noise_floor.wall_per_tier_level * 3,
    );
    expect(wallFloorContribution(tweaks, wall({ tier: "steel" }))).toBeLessThan(tweaks.noise.passive_gathering_noise_floor.food);
  });

  it("is 0 for a damaged wall", () => {
    const tweaks = loadRealTweaks();
    expect(wallFloorContribution(tweaks, wall({ tier: "steel", damaged: true }))).toBe(0);
  });
});

describe("wallNoiseDampening", () => {
  it("scales with wall tier, per tweaks.walls.noise_dampening_per_tier", () => {
    const tweaks = loadRealTweaks();
    expect(wallNoiseDampening(tweaks, wall({ tier: "wood" }))).toBe(tweaks.walls.noise_dampening_per_tier.wood);
    expect(wallNoiseDampening(tweaks, wall({ tier: "steel" }))).toBe(tweaks.walls.noise_dampening_per_tier.steel);
  });

  it("is 0 for a damaged wall — no dampening from a non-functional wall", () => {
    const tweaks = loadRealTweaks();
    expect(wallNoiseDampening(tweaks, wall({ tier: "steel", damaged: true }))).toBe(0);
  });
});

describe("noiseFloor with towers/walls", () => {
  it("adds tower and wall contributions on top of extraction/path, net of wall noise dampening", () => {
    const tweaks = loadRealTweaks();
    const food = extractionTile({ resource: "food", tier: "small" });
    const t = tower({ level: 2 });
    const w = wall({ tier: "rock" });

    const floor = noiseFloor(tweaks, [food], [], [t], [w], BASE_LEVEL);
    const expected = Math.max(
      tweaks.noise.noise_floor_minimum,
      tweaks.noise.passive_gathering_noise_floor.food +
        towerFloorContribution(tweaks, t) +
        wallFloorContribution(tweaks, w) -
        wallNoiseDampening(tweaks, w),
    );
    expect(floor).toBeCloseTo(expected);
  });

  it("a damaged tower/wall contributes nothing to the shared floor, which settles at the ambient minimum", () => {
    const tweaks = loadRealTweaks();
    const damagedTower = tower({ level: 4, damaged: true });
    const damagedWall = wall({ tier: "steel", damaged: true });
    expect(noiseFloor(tweaks, [], [], [damagedTower], [damagedWall], BASE_LEVEL)).toBe(tweaks.noise.noise_floor_minimum);
  });

  it("more walls read as a quieter base than fewer, holding everything else constant", () => {
    const tweaks = loadRealTweaks();
    const largePower = extractionTile({ resource: "power", tier: "large", coord: { q: 0, r: 0 } });
    const floorWithoutWalls = noiseFloor(tweaks, [largePower], [], [], [], BASE_LEVEL);
    const floorWithWalls = noiseFloor(
      tweaks,
      [largePower],
      [],
      [],
      [wall({ tier: "steel", coord: { q: 1, r: 0 } }), wall({ tier: "steel", coord: { q: 2, r: 0 } })],
      BASE_LEVEL,
    );
    expect(floorWithWalls).toBeLessThan(floorWithoutWalls);
  });
});

describe("accrueNoise", () => {
  it("rolls a spike back down toward the floor over time", () => {
    const tweaks = loadRealTweaks();
    const food = extractionTile({ resource: "food", tier: "small" });
    const floor = noiseFloor(tweaks, [food], [], [], [], BASE_LEVEL);

    const spiked = floor + 50;
    const halfLifeLater = accrueNoise(
      tweaks,
      [food],
      [],
      [],
      [],
      spiked,
      tweaks.noise.floor_convergence_half_life_seconds,
      BASE_LEVEL,
    );

    // After one half-life, half the gap should have closed.
    expect(halfLifeLater).toBeCloseTo(floor + 25, 1);
  });

  it("settles exactly at the floor given enough time", () => {
    const tweaks = loadRealTweaks();
    const food = extractionTile({ resource: "food", tier: "small" });
    const floor = noiseFloor(tweaks, [food], [], [], [], BASE_LEVEL);

    const result = accrueNoise(
      tweaks,
      [food],
      [],
      [],
      [],
      90,
      tweaks.noise.floor_convergence_half_life_seconds * 20,
      BASE_LEVEL,
    );
    expect(result).toBeCloseTo(floor, 3);
  });

  it("rises toward a higher floor if noise starts below it", () => {
    const tweaks = loadRealTweaks();
    const largePower = extractionTile({ resource: "power", tier: "large" });
    const floor = noiseFloor(tweaks, [largePower], [], [], [], BASE_LEVEL);

    const result = accrueNoise(
      tweaks,
      [largePower],
      [],
      [],
      [],
      0,
      tweaks.noise.floor_convergence_half_life_seconds,
      BASE_LEVEL,
    );
    expect(result).toBeCloseTo(floor / 2, 1);
  });

  it("stays low with only level-1 structures (the reported bug)", () => {
    const tweaks = loadRealTweaks();
    const food = extractionTile({ coord: { q: 0, r: 0 }, resource: "food", tier: "small" });
    const wood = extractionTile({ coord: { q: 1, r: 0 }, resource: "wood", tier: "small" });
    const stone = extractionTile({ coord: { q: 2, r: 0 }, resource: "stone", tier: "small" });
    const tracks: PathTile[] = [
      pathTile({ coord: { q: 3, r: 0 }, tier: "goat_track" }),
      pathTile({ coord: { q: 4, r: 0 }, tier: "goat_track" }),
    ];

    // A long time idle should settle at the floor, not keep climbing toward the cap.
    const result = accrueNoise(tweaks, [food, wood, stone], tracks, [], [], 70, 3600, BASE_LEVEL);
    const floor = noiseFloor(tweaks, [food, wood, stone], tracks, [], [], BASE_LEVEL);

    expect(result).toBeCloseTo(floor, 5);
    expect(result).toBeLessThan(noiseCap(tweaks, BASE_LEVEL));
  });

  it("does nothing for zero or negative elapsed time", () => {
    const tweaks = loadRealTweaks();
    expect(accrueNoise(tweaks, [], [], [], [], 42, 0, BASE_LEVEL)).toBe(42);
  });
});

describe("addActionNoise", () => {
  it("adds the configured flat amount for the action", () => {
    const tweaks = loadRealTweaks();
    // Starting from the ambient floor, not 0 — noise can never actually be below noise_floor_minimum.
    expect(addActionNoise(tweaks, tweaks.noise.noise_floor_minimum, "build_extraction_tile", BASE_LEVEL)).toBe(
      tweaks.noise.noise_floor_minimum + tweaks.noise.one_time_action_noise.build_extraction_tile,
    );
  });

  it("clamps at the noise cap", () => {
    const tweaks = loadRealTweaks();
    const cap = noiseCap(tweaks, BASE_LEVEL);
    const result = addActionNoise(tweaks, cap, "build_tower", BASE_LEVEL);
    expect(result).toBe(cap);
  });

  it("clamps at the (higher) cap for a leveled-up base", () => {
    const tweaks = loadRealTweaks();
    const cap = noiseCap(tweaks, 5);
    const result = addActionNoise(tweaks, cap, "build_tower", 5);
    expect(result).toBe(cap);
  });

  it("defaults the multiplier to 1, matching the no-multiplier call", () => {
    const tweaks = loadRealTweaks();
    expect(addActionNoise(tweaks, 0, "train_scout", BASE_LEVEL, 1)).toBe(addActionNoise(tweaks, 0, "train_scout", BASE_LEVEL));
  });

  it("scales the spike by the multiplier — rush training scaling by quantity, unlike every other flat one-time action", () => {
    const tweaks = loadRealTweaks();
    expect(addActionNoise(tweaks, 0, "rush_train_scout", BASE_LEVEL, 5)).toBeCloseTo(
      tweaks.noise.one_time_action_noise.rush_train_scout * 5,
    );
  });

  it("still clamps at the cap even with a large multiplier", () => {
    const tweaks = loadRealTweaks();
    const cap = noiseCap(tweaks, BASE_LEVEL);
    expect(addActionNoise(tweaks, cap, "rush_train_militia", BASE_LEVEL, 999)).toBe(cap);
  });
});
