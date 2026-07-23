import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import type { ResearchRecord } from "../data/research";
import { initialBase } from "../data/base";
import { isBaseHubAtTaskCap } from "./base";
import {
  countBaseHubTasks,
  countLandStructureTasks,
  isLandStructureAtTaskCap,
} from "./structureBusy";
import { structureTaskSlotCap } from "./research";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("structureTaskSlotCap / parallel_upgrades", () => {
  it("defaults to one timed task per structure", () => {
    expect(structureTaskSlotCap({ completed: [], pending: null })).toBe(1);
  });

  it("raises the cap to two once parallel_upgrades is researched", () => {
    const research: ResearchRecord = { completed: ["parallel_upgrades"], pending: null };
    expect(structureTaskSlotCap(research)).toBe(2);
  });

  it("allows a second land-structure task when parallel_upgrades is active", () => {
    const research: ResearchRecord = { completed: ["parallel_upgrades"], pending: null };
    const busy = { upgrade: { targetTier: "medium", startedAt: 0 }, damageRepair: { startedAt: 1 } };
    expect(countLandStructureTasks(busy)).toBe(2);
    expect(isLandStructureAtTaskCap(busy, { completed: [], pending: null })).toBe(true);
    expect(isLandStructureAtTaskCap(busy, research)).toBe(true);
    expect(isLandStructureAtTaskCap({ upgrade: { targetTier: "medium", startedAt: 0 } }, research)).toBe(false);
  });

  it("lets the base hub start a second task with parallel_upgrades", () => {
    const tweaks = loadRealTweaks();
    const base = initialBase(tweaks);
    const research: ResearchRecord = { completed: ["parallel_upgrades"], pending: null };
    const withAction = { ...base, action: { kind: "level_upgrade" as const, targetLevel: 2, startedAt: 0 } };
    expect(isBaseHubAtTaskCap(withAction, {}, research)).toBe(false);
    expect(isBaseHubAtTaskCap(withAction, {}, { completed: [], pending: null })).toBe(true);
  });
});
