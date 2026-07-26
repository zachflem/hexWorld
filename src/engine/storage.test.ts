import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import {
  emptyStorageFullAlertMemory,
  reconcileStorageFullAlerts,
  storageCapacity,
  storageFullAlertToastText,
  storageUpgradeCost,
  storageUpgradeDurationMs,
} from "./storage";
import type { ResourceAmounts } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("storageCapacity", () => {
  it("doubles per level, starting at 1000 for L1", () => {
    const tweaks = loadRealTweaks();
    expect(storageCapacity(tweaks, 1)).toBe(1000);
    expect(storageCapacity(tweaks, 2)).toBe(2000);
    expect(storageCapacity(tweaks, 3)).toBe(4000);
  });
});

describe("storageUpgradeCost", () => {
  it("matches Formula B applied to the resource's own upgrade base cost", () => {
    const tweaks = loadRealTweaks();
    // food L1->L2: (500*0.5)*(1+0.1*2) = 300 wood
    const cost = storageUpgradeCost(tweaks, "food", 1);
    expect(cost.wood).toBeCloseTo(300);
  });
});

describe("storageUpgradeDurationMs", () => {
  it("starts at 2min for L1→L2 and grows 50% per target level", () => {
    const tweaks = loadRealTweaks();
    expect(storageUpgradeDurationMs(tweaks, 2)).toBe(2 * 60_000);
    expect(storageUpgradeDurationMs(tweaks, 3)).toBe(3 * 60_000);
    expect(storageUpgradeDurationMs(tweaks, 4)).toBe(4.5 * 60_000);
  });
});

describe("reconcileStorageFullAlerts", () => {
  const levels: StorageLevels = { food: 1, wood: 1, stone: 1, steel: 1 };

  it("toasts once when hub and a courier site local buffer are both full", () => {
    const tweaks = loadRealTweaks();
    const resources: ResourceAmounts = { food: 1000, wood: 0, stone: 0, steel: 0 };
    const sites = [{ resource: "food" as const, stockpile: 1000, stockpileCap: 1000 }];
    const first = reconcileStorageFullAlerts(
      tweaks,
      resources,
      levels,
      sites,
      emptyStorageFullAlertMemory(),
    );
    expect(first.alerts).toEqual(["food"]);
    expect(storageFullAlertToastText("food")).toMatch(/food storage and stockpile is full/i);

    const second = reconcileStorageFullAlerts(tweaks, resources, levels, sites, first.next);
    expect(second.alerts).toEqual([]);
  });

  it("clears memory when hub has room again so a later fill can re-alert", () => {
    const tweaks = loadRealTweaks();
    const full: ResourceAmounts = { food: 1000, wood: 0, stone: 0, steel: 0 };
    const sites = [{ resource: "food" as const, stockpile: 1000, stockpileCap: 1000 }];
    const afterFull = reconcileStorageFullAlerts(
      tweaks,
      full,
      levels,
      sites,
      emptyStorageFullAlertMemory(),
    );
    const room: ResourceAmounts = { food: 500, wood: 0, stone: 0, steel: 0 };
    const afterRoom = reconcileStorageFullAlerts(tweaks, room, levels, sites, afterFull.next);
    expect(afterRoom.next.has("food")).toBe(false);
    const again = reconcileStorageFullAlerts(tweaks, full, levels, sites, afterRoom.next);
    expect(again.alerts).toEqual(["food"]);
  });
});
