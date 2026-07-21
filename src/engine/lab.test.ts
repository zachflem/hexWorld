import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import type { LabRecord } from "../data/lab";
import { tweaksSchema } from "../data/tweaksSchema";
import { axialDistance } from "./hexCoords";
import { labClueText, labSearchZoneCenter, resolveLabAssault, rollScoutClue } from "./lab";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("resolveLabAssault", () => {
  const lab: LabRecord = { coord: { q: 5, r: 5 }, secured: false, cluesCollected: 0 };

  it("secures the lab on a win, all-or-nothing (no partial state)", () => {
    const tweaks = loadRealTweaks();
    const { lab: after, won } = resolveLabAssault(tweaks, lab, tweaks.lab.guardian_defense + 1);
    expect(won).toBe(true);
    expect(after.secured).toBe(true);
  });

  it("leaves the lab untouched on a loss", () => {
    const tweaks = loadRealTweaks();
    const { lab: after, won } = resolveLabAssault(tweaks, lab, tweaks.lab.guardian_defense - 1);
    expect(won).toBe(false);
    expect(after).toEqual(lab);
  });

  it("wins on an exact tie (resolveHordeTileFight's >=, same as every other fight)", () => {
    const tweaks = loadRealTweaks();
    const { won } = resolveLabAssault(tweaks, lab, tweaks.lab.guardian_defense);
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

describe("rollScoutClue", () => {
  it("is deterministic for a given seed/coord/scoutCount", () => {
    const tweaks = loadRealTweaks();
    const coord = { q: 12, r: -7 };
    const first = rollScoutClue(tweaks, 42, coord, 3);
    const second = rollScoutClue(tweaks, 42, coord, 3);
    expect(second).toBe(first);
  });

  it("varies across scoutCount (not the same roll reused every time)", () => {
    // per_scout_action_chance is ~2%, so 1000 draws makes both outcomes
    // appearing a near-certainty (chance of all-false is ~1 in 500 million).
    const tweaks = loadRealTweaks();
    const coord = { q: 12, r: -7 };
    const rolls = Array.from({ length: 1000 }, (_, i) => rollScoutClue(tweaks, 42, coord, i));
    expect(new Set(rolls).size).toBe(2);
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
