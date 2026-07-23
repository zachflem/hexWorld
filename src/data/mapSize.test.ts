import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { mapCenter } from "../engine/hexCoords";
import { createDens } from "./dens";
import { scaleToMapSize, tweaksForMapSize, resolveGridSizeForNewGame, resolveSeedForNewGame, isProfileGridSizeLocked, isProfileSeedLocked } from "./mapSize";
import { tweaksSchema } from "./tweaksSchema";
import { normalizeWorldRecord } from "./world";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("scaleToMapSize", () => {
  it("scales linearly from the 128 reference", () => {
    expect(scaleToMapSize(12, 128)).toBe(12);
    expect(scaleToMapSize(12, 96)).toBe(9);
    expect(scaleToMapSize(12, 48)).toBe(5);
    expect(scaleToMapSize(14, 48)).toBe(5);
  });

  it("never returns below 1", () => {
    expect(scaleToMapSize(1, 48)).toBe(1);
  });
});

describe("tweaksForMapSize", () => {
  it("sets grid_size and scales dens/lab distances", () => {
    const base = loadRealTweaks();
    const scaled = tweaksForMapSize(base, 48);
    expect(scaled.game.grid_size).toBe(48);
    expect(scaled.dens.count).toBe(5);
    expect(scaled.dens.min_distance_from_base).toBeLessThan(base.dens.min_distance_from_base);
    expect(scaled.lab.min_distance_from_base).toBeLessThan(base.lab.min_distance_from_base);
  });
});

describe("createDens with scaled tweaks", () => {
  it("places fewer dens on a 48×48 map", () => {
    const tweaks = loadRealTweaks();
    const base = mapCenter(48);
    const scaled = tweaksForMapSize(tweaks, 48);
    const dens = createDens(42, 48, base, scaled);
    expect(dens.length).toBe(scaled.dens.count);
    expect(dens.length).toBeLessThan(tweaks.dens.count);
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
      game: { ...base.game, grid_size: 48, grid_size_locked: true },
    };
    expect(isProfileGridSizeLocked(scenario)).toBe(true);
    expect(resolveGridSizeForNewGame(scenario, 128)).toBe(48);
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
