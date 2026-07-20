import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { axialDistance, mapCenter } from "../engine/hexCoords";
import { terrainAt } from "../engine/terrain";
import { tweaksSchema } from "./tweaksSchema";
import { createDens, resolveDen } from "./dens";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("createDens", () => {
  const seed = 3;
  const gridSize = 128;
  const base = mapCenter(gridSize);

  it("is deterministic for a given seed", () => {
    const tweaks = loadRealTweaks();
    const first = createDens(seed, gridSize, base, tweaks);
    const second = createDens(seed, gridSize, base, tweaks);
    expect(second).toEqual(first);
  });

  it("places the configured count of dens", () => {
    const tweaks = loadRealTweaks();
    const dens = createDens(seed, gridSize, base, tweaks);
    expect(dens.length).toBe(tweaks.dens.count);
  });

  it("never places a den on water", () => {
    const tweaks = loadRealTweaks();
    const dens = createDens(seed, gridSize, base, tweaks);
    for (const den of dens) {
      expect(terrainAt(seed, den.coord)).not.toBe("water");
    }
  });

  it("never places a den closer than min_distance_from_base", () => {
    const tweaks = loadRealTweaks();
    const dens = createDens(seed, gridSize, base, tweaks);
    for (const den of dens) {
      expect(axialDistance(base, den.coord)).toBeGreaterThanOrEqual(tweaks.dens.min_distance_from_base);
    }
  });

  it("caps a den's level based on its distance from base", () => {
    const tweaks = loadRealTweaks();
    const dens = createDens(seed, gridSize, base, tweaks);
    for (const den of dens) {
      const distance = axialDistance(base, den.coord);
      const steps = Math.floor(
        (distance - tweaks.dens.min_distance_from_base) / tweaks.dens.level_cap_by_distance.distance_per_level_step,
      );
      const expectedCap = Math.min(tweaks.dens.max_level, Math.max(1, 1 + steps));
      expect(den.level).toBeGreaterThanOrEqual(1);
      expect(den.level).toBeLessThanOrEqual(expectedCap);
    }
  });

  it("gives every den a unique id", () => {
    const tweaks = loadRealTweaks();
    const dens = createDens(seed, gridSize, base, tweaks);
    const ids = new Set(dens.map((d) => d.id));
    expect(ids.size).toBe(dens.length);
  });

  it("starts every den hostile (no siege in progress)", () => {
    const tweaks = loadRealTweaks();
    const dens = createDens(seed, gridSize, base, tweaks);
    for (const den of dens) {
      expect(den.siege).toBeNull();
    }
  });
});

describe("resolveDen", () => {
  it("defaults a pre-siege-system den (missing `siege`) to null, unchanged otherwise", () => {
    const legacyDen = { id: "den-1", coord: { q: 0, r: 0 }, level: 3 } as unknown as Parameters<typeof resolveDen>[0];
    expect(resolveDen(legacyDen)).toEqual({ id: "den-1", coord: { q: 0, r: 0 }, level: 3, siege: null });
  });

  it("leaves an existing siege state untouched", () => {
    const siege = { startedAt: 1, lastWaveAt: 1, waveIndex: 0 };
    const den = { id: "den-1", coord: { q: 0, r: 0 }, level: 3, siege };
    expect(resolveDen(den)).toEqual(den);
  });
});
