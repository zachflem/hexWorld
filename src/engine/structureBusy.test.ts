import { describe, expect, it } from "vitest";
import type { ResearchRecord } from "../data/research";
import {
  countBarracksTasks,
  countDockTasks,
  countLandStructureTasks,
  countWallTasks,
  isBarracksAtTaskCap,
  isDockAtTaskCap,
  isHordeRepairBlocked,
  isLandStructureAtTaskCap,
  isWallAtTaskCap,
} from "./structureBusy";

const withParallel: ResearchRecord = { completed: ["parallel_upgrades"], pending: null };
const withoutParallel: ResearchRecord = { completed: [], pending: null };

describe("structureBusy slot counts", () => {
  it("isLandStructureAtTaskCap respects parallel_upgrades", () => {
    const oneTask = { upgrade: { targetTier: "medium", startedAt: 0 } };
    expect(isLandStructureAtTaskCap(oneTask, withoutParallel)).toBe(true);
    expect(isLandStructureAtTaskCap(oneTask, withParallel)).toBe(false);
  });

  it("isWallAtTaskCap is false with one task and parallel_upgrades", () => {
    const oneTask = { action: { kind: "repair", startedAt: 0 } };
    expect(isWallAtTaskCap(oneTask, withParallel)).toBe(false);
    expect(isWallAtTaskCap(oneTask, withoutParallel)).toBe(true);
  });

  it("isWallAtTaskCap is true at two tasks even with parallel_upgrades", () => {
    const twoTasks = {
      action: { kind: "repair", startedAt: 0 },
      damageRepair: { startedAt: 1 },
    };
    expect(countWallTasks(twoTasks)).toBe(2);
    expect(isWallAtTaskCap(twoTasks, withParallel)).toBe(true);
  });

  it("isDockAtTaskCap is true at two tasks with parallel_upgrades", () => {
    const twoTasks = { buildStartedAt: 0, fishingBoatUpgrade: { startedAt: 1 } };
    expect(countDockTasks(twoTasks)).toBe(2);
    expect(isDockAtTaskCap(twoTasks, withParallel)).toBe(true);
  });

  it("isBarracksAtTaskCap is true at two tasks with parallel_upgrades", () => {
    const busy = {
      upgrade: { targetLevel: 2, startedAt: 0 },
      trainingQueue: { unitType: "militia", remaining: 1, currentUnitStartedAt: 0 },
    };
    expect(countBarracksTasks(busy)).toBe(2);
    expect(isBarracksAtTaskCap(busy, withParallel)).toBe(true);
  });

  it("countLandStructureTasks covers build, upgrade, and horde repair", () => {
    expect(countLandStructureTasks({})).toBe(0);
    expect(countLandStructureTasks({ buildStartedAt: 0 })).toBe(1);
  });

  it("isHordeRepairBlocked ignores stale upgrade timers on damaged structures", () => {
    expect(
      isHordeRepairBlocked({
        damaged: true,
        upgrade: { targetLevel: 2, startedAt: 0 },
      }),
    ).toBe(false);
    expect(isHordeRepairBlocked({ damaged: true, damageRepair: { startedAt: 0 } })).toBe(true);
  });
});
