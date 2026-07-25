import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { mapCenter } from "../engine/hexCoords";
import { createDens } from "./dens";
import {
  DEFAULT_MAP_SIZE,
  MAP_SIZE_OPTIONS,
  scaleToMapSize,
  tweaksForMapSize,
  resolveGridSizeForNewGame,
  resolveSeedForNewGame,
  isProfileGridSizeLocked,
  isProfileSeedLocked,
} from "./mapSize";
import { tweaksSchema } from "./tweaksSchema";
import { normalizeWorldRecord } from "./world";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("map size options", () => {
  it("offers 32/64/96/128 with default 32", () => {
    expect([...MAP_SIZE_OPTIONS]).toEqual([32, 64, 96, 128]);
    expect(DEFAULT_MAP_SIZE).toBe(32);
  });
});

describe("scaleToMapSize", () => {
  it("scales linearly from the 128 reference", () => {
    expect(scaleToMapSize(18, 128)).toBe(18);
    expect(scaleToMapSize(14, 32)).toBe(4);
  });

  it("never returns below 1", () => {
    expect(scaleToMapSize(1, 32)).toBe(1);
  });
});

describe("tweaksForMapSize", () => {
  it("sets grid_size and uses the dens-count ladder", () => {
    const base = loadRealTweaks();
    const scaled = tweaksForMapSize(base, 32);
    expect(scaled.game.grid_size).toBe(32);
    expect(scaled.dens.count).toBe(6);
    expect(scaled.dens.min_distance_from_base).toBeLessThan(base.dens.min_distance_from_base);
    expect(scaled.lab.min_distance_from_base).toBeLessThan(base.lab.min_distance_from_base);
  });

  it("uses dens counts 6 / 10 / 14 / 18 for 32 / 64 / 96 / 128", () => {
    const base = loadRealTweaks();
    expect([32, 64, 96, 128].map((size) => tweaksForMapSize(base, size).dens.count)).toEqual([6, 10, 14, 18]);
  });
});

describe("createDens with scaled tweaks", () => {
  it("places fewer dens on a 32×32 map than on 128×128", () => {
    const tweaks = loadRealTweaks();
    const base32 = mapCenter(32);
    const base128 = mapCenter(128);
    const dens32 = createDens(42, 32, base32, tweaksForMapSize(tweaks, 32));
    const dens128 = createDens(42, 128, base128, tweaksForMapSize(tweaks, 128));
    expect(dens32.length).toBeLessThan(dens128.length);
    expect(dens32.length).toBeGreaterThanOrEqual(5);
    expect(dens32.length).toBeLessThanOrEqual(7);
  });
});

describe("normalizeWorldRecord", () => {
  it("defaults missing gridSize to 128", () => {
    expect(normalizeWorldRecord({ seed: 1 })).toEqual({ seed: 1, gridSize: 128 });
  });
});

describe("profile scenario overrides", () => {
  const base = loadRealTweaks();

  it("resolveGridSizeForNewGame prefers locked profile size", () => {
    const scenario = {
      ...base,
      game: { ...base.game, grid_size: 64, grid_size_locked: true },
    };
    expect(isProfileGridSizeLocked(scenario)).toBe(true);
    expect(resolveGridSizeForNewGame(scenario, 128)).toBe(64);
  });

  it("resolveGridSizeForNewGame uses onboarding when not locked", () => {
    expect(resolveGridSizeForNewGame(base, 96)).toBe(96);
  });

  it("resolveSeedForNewGame prefers profile world_seed", () => {
    const scenario = { ...base, game: { ...base.game, world_seed: 4242 } };
    expect(isProfileSeedLocked(scenario)).toBe(true);
    expect(resolveSeedForNewGame(scenario, 999, () => 1)).toBe(4242);
  });

  it("resolveSeedForNewGame uses onboarding or random when unset", () => {
    expect(resolveSeedForNewGame(base, 777, () => 1)).toBe(777);
    expect(resolveSeedForNewGame(base, undefined, () => 1)).toBe(1);
  });
});
