import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import type { PowerStation } from "../data/powerStations";
import { tweaksSchema } from "../data/tweaksSchema";
import {
  computePowerNetwork,
  emptyPowerAlertMemory,
  powerAlertStepThresholds,
  powerAlertToastText,
  powerFactor,
  powerPerformanceFactor,
  powerStationAoeRadius,
  powerStationCapacity,
  reconcilePowerAlerts,
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

describe("reconcilePowerAlerts", () => {
  it("lists 10% steps above cutoff", () => {
    expect(powerAlertStepThresholds(0.5)).toEqual([0.9, 0.8, 0.7, 0.6]);
    expect(powerAlertStepThresholds(0.25)).toEqual([0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]);
  });

  it("fires brownout once, then step warnings, imminent at last step, then blackout", () => {
    let memory = emptyPowerAlertMemory();

    let result = reconcilePowerAlerts(0.95, 0.5, memory);
    expect(result.alerts.map((a) => a.kind)).toEqual(["brownout"]);
    memory = result.next;

    result = reconcilePowerAlerts(0.85, 0.5, memory);
    expect(result.alerts).toEqual([{ kind: "step", supplyPercent: 85, thresholdPercent: 90 }]);
    memory = result.next;

    result = reconcilePowerAlerts(0.85, 0.5, memory);
    expect(result.alerts).toEqual([]);

    result = reconcilePowerAlerts(0.55, 0.5, memory);
    expect(result.alerts.map((a) => a.kind)).toEqual(["imminent"]);
    expect(result.alerts[0]).toMatchObject({ kind: "imminent", cutoffPercent: 50 });
    memory = result.next;

    result = reconcilePowerAlerts(0.4, 0.5, memory);
    expect(result.alerts.map((a) => a.kind)).toEqual(["blackout"]);
    memory = result.next;

    result = reconcilePowerAlerts(0.3, 0.5, memory);
    expect(result.alerts).toEqual([]);
  });

  it("collapses a sudden drop to brownout + most severe new step", () => {
    const result = reconcilePowerAlerts(0.65, 0.5, emptyPowerAlertMemory());
    expect(result.alerts.map((a) => a.kind)).toEqual(["brownout", "step"]);
    expect(result.alerts[1]).toMatchObject({ kind: "step", thresholdPercent: 70 });
  });

  it("resets when supply recovers to full, and re-warns on a later drop", () => {
    let memory = reconcilePowerAlerts(0.8, 0.5, emptyPowerAlertMemory()).next;
    memory = reconcilePowerAlerts(1, 0.5, memory).next;
    expect(memory).toEqual(emptyPowerAlertMemory());

    const again = reconcilePowerAlerts(0.8, 0.5, memory);
    expect(again.alerts.map((a) => a.kind)).toEqual(["brownout", "step"]);
  });

  it("formats toast copy", () => {
    expect(powerAlertToastText({ kind: "brownout", supplyPercent: 92 })).toBe(
      "Brownout — power demand exceeds supply",
    );
    expect(powerAlertToastText({ kind: "step", supplyPercent: 84, thresholdPercent: 90 })).toBe(
      "Power supply below 90%",
    );
    expect(powerAlertToastText({ kind: "imminent", supplyPercent: 55, cutoffPercent: 50 })).toBe(
      "Power critical — blackout at 50%",
    );
    expect(powerAlertToastText({ kind: "blackout", supplyPercent: 40, cutoffPercent: 50 })).toBe(
      "Blackout — power grid failed (below 50%)",
    );
  });
});
