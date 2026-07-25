import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import type { PowerStation } from "../data/powerStations";
import { tweaksSchema } from "../data/tweaksSchema";
import {
  computePowerNetwork,
  powerFactor,
  powerPerformanceFactor,
  powerStationAoeRadius,
  powerStationCapacity,
  structurePowerState,
} from "./power";

function loadTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

function station(coord: { q: number; r: number }, level = 1): PowerStation {
  return {
    coord,
    level,
    totalInvested: {},
    upgrade: null,
    buildCost: {},
    damaged: false,
    damageRepair: null,
    buildStartedAt: null,
  };
}

describe("power stations", () => {
  const tweaks = loadTweaks();

  it("scales capacity and AoE with level", () => {
    expect(powerStationCapacity(tweaks, 1)).toBe(tweaks.power.capacity_base);
    expect(powerStationCapacity(tweaks, 2)).toBe(tweaks.power.capacity_base + tweaks.power.capacity_per_level);
    expect(powerStationAoeRadius(tweaks, 1)).toBe(tweaks.power.aoe_base_tiles);
    expect(powerStationAoeRadius(tweaks, 3)).toBe(
      tweaks.power.aoe_base_tiles + tweaks.power.aoe_per_level * 2,
    );
  });

  it("computes factor and cut-off states", () => {
    expect(powerFactor(20, 0)).toBe(1);
    expect(powerFactor(20, 40)).toBe(0.5);
    expect(powerFactor(5, 40)).toBeCloseTo(0.125);

    const network = computePowerNetwork(tweaks, [station({ q: 0, r: 0 }, 1)], [], [], [], [], [], []);
    expect(network.totalCapacity).toBe(tweaks.power.capacity_base);
    expect(network.poweredTiles.has("0,0")).toBe(true);
    expect(structurePowerState(network, 1, { q: 0, r: 0 })).toBe("exempt");
    expect(structurePowerState(network, 2, { q: 10, r: 10 })).toBe("offline");
    expect(powerPerformanceFactor(network, 1, { q: 10, r: 10 })).toBe(1);
  });

  it("inactive stations contribute neither capacity nor AoE", () => {
    const damaged = { ...station({ q: 0, r: 0 }, 4), damaged: true };
    const network = computePowerNetwork(tweaks, [damaged], [], [], [], [], [], []);
    expect(network.totalCapacity).toBe(0);
    expect(network.poweredTiles.size).toBe(0);
  });
});
