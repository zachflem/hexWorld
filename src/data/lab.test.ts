import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { axialDistance, axialKey, mapCenter } from "../engine/hexCoords";
import { terrainAt } from "../engine/terrain";
import { createDens } from "./dens";
import { tweaksSchema } from "./tweaksSchema";
import { createLab } from "./lab";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("createLab", () => {
  const seed = 3;
  const gridSize = 128;
  const base = mapCenter(gridSize);

  it("is deterministic for a given seed", () => {
    const tweaks = loadRealTweaks();
    const dens = createDens(seed, gridSize, base, tweaks);
    const first = createLab(seed, gridSize, base, dens, tweaks);
    const second = createLab(seed, gridSize, base, dens, tweaks);
    expect(second).toEqual(first);
  });

  it("never places the lab on water", () => {
    const tweaks = loadRealTweaks();
    const dens = createDens(seed, gridSize, base, tweaks);
    const lab = createLab(seed, gridSize, base, dens, tweaks);
    expect(terrainAt(seed, lab.coord)).not.toBe("water");
  });

  it("never places the lab closer than lab.min_distance_from_base", () => {
    const tweaks = loadRealTweaks();
    const dens = createDens(seed, gridSize, base, tweaks);
    const lab = createLab(seed, gridSize, base, dens, tweaks);
    expect(axialDistance(base, lab.coord)).toBeGreaterThanOrEqual(tweaks.lab.min_distance_from_base);
  });

  it("never places the lab on a den tile", () => {
    const tweaks = loadRealTweaks();
    const dens = createDens(seed, gridSize, base, tweaks);
    const lab = createLab(seed, gridSize, base, dens, tweaks);
    const denKeys = new Set(dens.map((d) => axialKey(d.coord)));
    expect(denKeys.has(axialKey(lab.coord))).toBe(false);
  });

  it("starts unsecured with no clues collected", () => {
    const tweaks = loadRealTweaks();
    const dens = createDens(seed, gridSize, base, tweaks);
    const lab = createLab(seed, gridSize, base, dens, tweaks);
    expect(lab.secured).toBe(false);
    expect(lab.cluesCollected).toBe(0);
  });
});
