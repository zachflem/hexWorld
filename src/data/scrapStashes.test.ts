import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { axialDistance, axialKey, mapCenter } from "../engine/hexCoords";
import { terrainAt } from "../engine/terrain";
import { createDens } from "./dens";
import { createLab } from "./lab";
import { tweaksForMapSize } from "./mapSize";
import {
  applyWanderingScoutScrapSamples,
  createScrapStashes,
  isActiveScrapStash,
  rollScrapStashCount,
  scrapStashBlocksHex,
} from "./scrapStashes";
import { tweaksSchema } from "./tweaksSchema";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("createScrapStashes", () => {
  const seed = 3;
  const gridSize = 128;

  function place(s = seed, size = gridSize) {
    const base = mapCenter(size);
    const tweaks = tweaksForMapSize(loadRealTweaks(), size);
    const dens = createDens(s, size, base, tweaks);
    const lab = createLab(s, size, base, dens, tweaks);
    const stashes = createScrapStashes(s, size, base, dens, lab, tweaks);
    return { tweaks, dens, lab, stashes, base };
  }

  it("is deterministic for a given seed", () => {
    const a = place();
    const b = place();
    expect(b.stashes).toEqual(a.stashes);
  });

  it("places base count ±1 stashes", () => {
    const { tweaks, stashes } = place();
    const expected = rollScrapStashCount(seed, tweaks.scrap_stashes.count);
    expect(stashes.length).toBe(expected);
  });

  it("never places on water or on dens/lab", () => {
    const { dens, lab, stashes } = place();
    const blocked = new Set([...dens.map((d) => axialKey(d.coord)), axialKey(lab.coord)]);
    for (const stash of stashes) {
      expect(terrainAt(seed, stash.coord)).not.toBe("water");
      expect(blocked.has(axialKey(stash.coord))).toBe(false);
    }
  });

  it("guarantees at least one stash within early_guarantee_max_distance of base", () => {
    const { tweaks, stashes, base } = place();
    const max = tweaks.scrap_stashes.early_guarantee_max_distance;
    expect(stashes.some((s) => axialDistance(base, s.coord) <= max)).toBe(true);
  });

  it("assigns scrap art variants in 1..art_variant_count", () => {
    const { tweaks, stashes } = place();
    for (const stash of stashes) {
      expect(stash.artVariant).toBeGreaterThanOrEqual(1);
      expect(stash.artVariant).toBeLessThanOrEqual(tweaks.scrap_stashes.art_variant_count);
      expect(stash.remainingSteel).toBeGreaterThan(0);
      expect(stash.tileLevel).toBeGreaterThanOrEqual(1);
      expect(stash.tileLevel).toBeLessThanOrEqual(tweaks.scrap_stashes.tile_level_max);
    }
  });

  it("gives every stash a unique id and coord", () => {
    const { stashes } = place();
    expect(new Set(stashes.map((s) => s.id)).size).toBe(stashes.length);
    expect(new Set(stashes.map((s) => axialKey(s.coord))).size).toBe(stashes.length);
  });

  it("scrapStashBlocksHex only while steel remains", () => {
    const stash = {
      id: "scrap-0",
      coord: { q: 1, r: 2 },
      remainingSteel: 10,
      artVariant: 1,
      tileLevel: 2,
    };
    expect(scrapStashBlocksHex([stash], stash.coord)).toBe(true);
    expect(isActiveScrapStash({ ...stash, remainingSteel: 0 })).toBe(false);
    expect(scrapStashBlocksHex([{ ...stash, remainingSteel: 0 }], stash.coord)).toBe(false);
  });

  it("applies wandering-scout steel samples when a scout steps onto a stash", () => {
    const tweaks = loadRealTweaks();
    const stash = {
      id: "scrap-0",
      coord: { q: 2, r: 2 },
      remainingSteel: 10,
      artVariant: 1,
      tileLevel: 1,
    };
    const result = applyWanderingScoutScrapSamples(
      tweaks,
      [stash],
      [{ coord: { q: 1, r: 2 } }],
      [{ coord: { q: 2, r: 2 } }],
    );
    expect(result.steelGained).toBe(tweaks.scrap_stashes.wandering_scout_sample_steel);
    expect(result.scrapStashes[0]!.remainingSteel).toBe(10 - tweaks.scrap_stashes.wandering_scout_sample_steel);
  });
});
