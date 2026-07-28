import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "./tweaksSchema";
import type { DenRecord } from "./dens";
import { createOutpostFromDen } from "./outposts";
import { outpostReinforcementHp } from "../engine/outposts";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/profiles/default/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

function makeDen(overrides: Partial<DenRecord> = {}): DenRecord {
  return { id: "den-1", coord: { q: 3, r: 4 }, level: 1, siege: null, ...overrides };
}

describe("createOutpostFromDen", () => {
  it("derives starting reinforcementLevel from (den.level - 1), floored at 0", () => {
    const tweaks = loadRealTweaks();
    const outpost = createOutpostFromDen(tweaks, makeDen({ level: 1 }), 1000);
    expect(outpost.reinforcementLevel).toBe(0);
    expect(outpost.currentHp).toBe(outpostReinforcementHp(tweaks, 0));
  });

  it("scales starting HP with a higher den level", () => {
    const tweaks = loadRealTweaks();
    const outpost = createOutpostFromDen(tweaks, makeDen({ level: 5 }), 1000);
    expect(outpost.reinforcementLevel).toBe(4);
    expect(outpost.currentHp).toBe(outpostReinforcementHp(tweaks, 4));
    expect(outpost.currentHp).toBeGreaterThan(outpostReinforcementHp(tweaks, 0));
  });

  it("carries the den's coord, id (prefixed), original level, and conversion timestamp", () => {
    const tweaks = loadRealTweaks();
    const den = makeDen({ id: "den-7", coord: { q: 9, r: -2 }, level: 3 });
    const outpost = createOutpostFromDen(tweaks, den, 54_321);
    expect(outpost.id).toBe("outpost-den-7");
    expect(outpost.coord).toEqual({ q: 9, r: -2 });
    expect(outpost.originalDenLevel).toBe(3);
    expect(outpost.convertedAt).toBe(54_321);
  });
});
