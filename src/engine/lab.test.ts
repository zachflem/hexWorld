import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import type { LabRecord } from "../data/lab";
import { tweaksSchema } from "../data/tweaksSchema";
import { axialDistance, axialKey } from "./hexCoords";
import { labClueText, labSearchZoneCenter, labSearchZoneTileKeys, resolveLabAssault, rollWatchtowerSignal, watchtowerSignalChance, compass4Bearing, coordInCompass4Sector, makeWatchtowerSignal, WATCHTOWER_SIGNAL_MIN_LEVEL } from "./lab";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("resolveLabAssault", () => {
  const lab: LabRecord = { coord: { q: 5, r: 5 }, secured: false, cluesCollected: 0, guardianDefense: 200 };

  it("secures the lab on a win, all-or-nothing (no partial state)", () => {
    const tweaks = loadRealTweaks();
    const { lab: after, won } = resolveLabAssault(tweaks, lab, lab.guardianDefense + 1);
    expect(won).toBe(true);
    expect(after.secured).toBe(true);
  });

  it("leaves the lab untouched on a loss", () => {
    const tweaks = loadRealTweaks();
    const { lab: after, won } = resolveLabAssault(tweaks, lab, lab.guardianDefense - 1);
    expect(won).toBe(false);
    expect(after).toEqual(lab);
  });

  it("wins on an exact tie (resolveHordeTileFight's >=, same as every other fight)", () => {
    const tweaks = loadRealTweaks();
    const { won } = resolveLabAssault(tweaks, lab, lab.guardianDefense);
    expect(won).toBe(true);
  });
});

describe("labClueText", () => {
  const base = { q: 0, r: 0 };

  it("returns null when no clues have been collected", () => {
    expect(labClueText(0, base, { q: 10, r: 0 })).toBeNull();
  });

  it("points north for a lab due north of base", () => {
    // r decreasing moves north in pointy-top axial pixel space (axialToPixel).
    expect(labClueText(1, base, { q: 0, r: -10 })).toContain("north");
  });

  it("points south for a lab due south of base", () => {
    expect(labClueText(1, base, { q: 0, r: 10 })).toContain("south");
  });

  it("gives a coarser reading (fewer distinct words) at clue 1 than at clue 5", () => {
    const coarse = labClueText(1, base, { q: 10, r: -4 })!;
    const precise = labClueText(5, base, { q: 10, r: -4 })!;
    expect(precise.split("-").length).toBeGreaterThanOrEqual(coarse.split("-").length);
  });
});

describe("labSearchZoneCenter", () => {
  it("is deterministic for a given seed", () => {
    const seed = 42;
    const labCoord = { q: 30, r: -10 };
    const first = labSearchZoneCenter(seed, labCoord, 6, 128);
    const second = labSearchZoneCenter(seed, labCoord, 6, 128);
    expect(second).toEqual(first);
  });

  it("stays within the given radius of the true lab coord", () => {
    const seed = 42;
    const labCoord = { q: 30, r: -10 };
    const radius = 6;
    const center = labSearchZoneCenter(seed, labCoord, radius, 128);
    expect(axialDistance(center, labCoord)).toBeLessThanOrEqual(radius);
  });
});

describe("labSearchZoneTileKeys", () => {
  const labCoord = { q: 40, r: 40 };

  it("is null until all clues are collected", () => {
    const tweaks = loadRealTweaks();
    const lab: LabRecord = {
      coord: labCoord,
      secured: false,
      cluesCollected: tweaks.lab_clues.total_clues - 1,
      guardianDefense: 200,
    };
    expect(labSearchZoneTileKeys(42, lab, tweaks, 128)).toBeNull();
  });

  it("force previews the zone before clues are collected", () => {
    const tweaks = loadRealTweaks();
    const lab: LabRecord = {
      coord: labCoord,
      secured: false,
      cluesCollected: 0,
      guardianDefense: 200,
    };
    const keys = labSearchZoneTileKeys(42, lab, tweaks, 128, { force: true });
    expect(keys).not.toBeNull();
    expect(keys!.has(axialKey(lab.coord))).toBe(true);
  });

  it("covers the true lab once all clues are in", () => {
    const tweaks = loadRealTweaks();
    const lab: LabRecord = {
      coord: labCoord,
      secured: false,
      cluesCollected: tweaks.lab_clues.total_clues,
      guardianDefense: 200,
    };
    const keys = labSearchZoneTileKeys(42, lab, tweaks, 128);
    expect(keys).not.toBeNull();
    expect(keys!.has(axialKey(lab.coord))).toBe(true);
  });

  it("clears after the lab is secured", () => {
    const tweaks = loadRealTweaks();
    const lab: LabRecord = {
      coord: labCoord,
      secured: true,
      cluesCollected: tweaks.lab_clues.total_clues,
      guardianDefense: 200,
    };
    expect(labSearchZoneTileKeys(42, lab, tweaks, 128)).toBeNull();
  });
});

describe("watchtower signals", () => {
  const base = { q: 0, r: 0 };
  const towerCoord = { q: 1, r: 0 };

  it("L1 never has a signal chance", () => {
    const tweaks = loadRealTweaks();
    expect(watchtowerSignalChance(tweaks, 1)).toBe(0);
    expect(WATCHTOWER_SIGNAL_MIN_LEVEL).toBe(2);
    expect(rollWatchtowerSignal(tweaks, 42, towerCoord, 1, 0, 1000)).toBe(false);
  });

  it("L4 chance is base × multiplier", () => {
    const tweaks = loadRealTweaks();
    const baseChance = tweaks.lab_clues.passive_surfacing.per_watchtower_tick_base_chance;
    const mult = tweaks.lab_clues.passive_surfacing.watchtower_intel_tier_multiplier;
    expect(watchtowerSignalChance(tweaks, 2)).toBe(baseChance);
    expect(watchtowerSignalChance(tweaks, 3)).toBe(baseChance);
    expect(watchtowerSignalChance(tweaks, 4)).toBe(baseChance * mult);
  });

  it("rollWatchtowerSignal is deterministic", () => {
    const tweaks = loadRealTweaks();
    const a = rollWatchtowerSignal(tweaks, 99, towerCoord, 4, 12345, 50);
    const b = rollWatchtowerSignal(tweaks, 99, towerCoord, 4, 12345, 50);
    expect(b).toBe(a);
  });

  it("compass4Bearing / sector match for cardinal labs", () => {
    expect(compass4Bearing(base, { q: 0, r: -10 })).toBe("north");
    expect(coordInCompass4Sector(base, { q: 0, r: -5 }, "north")).toBe(true);
    expect(coordInCompass4Sector(base, { q: 0, r: 5 }, "north")).toBe(false);
    const signal = makeWatchtowerSignal(base, { q: 0, r: -10 }, 1);
    expect(signal.bearing).toBe("north");
  });
});
