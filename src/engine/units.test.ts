import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import type { UnitsRecord } from "../data/units";
import {
  applyUpkeepTick,
  crossBowSniperAttackPower,
  crossBowSniperDefensePower,
  crossBowSniperTrainDurationMs,
  junkyardKnightAttackPower,
  junkyardKnightDefensePower,
  junkyardKnightTrainDurationMs,
  militiaAttackPower,
  militiaDefensePower,
  militiaTrainDurationMs,
  resolveTrainingQueue,
  type TrainingQueueProgress,
} from "./units";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("militiaAttackPower / militiaDefensePower", () => {
  it("scales linearly with militia count", () => {
    const tweaks = loadRealTweaks();
    expect(militiaAttackPower(tweaks, 10)).toBe(10 * tweaks.units.militia.attack_per_unit);
    expect(militiaDefensePower(tweaks, 10)).toBe(10 * tweaks.units.militia.defense_per_unit);
  });

  it("is 0 with no militia", () => {
    const tweaks = loadRealTweaks();
    expect(militiaAttackPower(tweaks, 0)).toBe(0);
    expect(militiaDefensePower(tweaks, 0)).toBe(0);
  });
});

describe("junkyardKnightAttackPower / junkyardKnightDefensePower", () => {
  it("scales linearly with count", () => {
    const tweaks = loadRealTweaks();
    expect(junkyardKnightAttackPower(tweaks, 10)).toBe(10 * tweaks.units.junkyard_knight.attack_per_unit);
    expect(junkyardKnightDefensePower(tweaks, 10)).toBe(10 * tweaks.units.junkyard_knight.defense_per_unit);
  });

  it("is 0 with no junkyard knights", () => {
    const tweaks = loadRealTweaks();
    expect(junkyardKnightAttackPower(tweaks, 0)).toBe(0);
    expect(junkyardKnightDefensePower(tweaks, 0)).toBe(0);
  });
});

describe("crossBowSniperAttackPower / crossBowSniperDefensePower", () => {
  it("scales linearly with count", () => {
    const tweaks = loadRealTweaks();
    expect(crossBowSniperAttackPower(tweaks, 10)).toBe(10 * tweaks.units.cross_bow_sniper.attack_per_unit);
    expect(crossBowSniperDefensePower(tweaks, 10)).toBe(10 * tweaks.units.cross_bow_sniper.defense_per_unit);
  });

  it("is 0 with no cross-bow snipers", () => {
    const tweaks = loadRealTweaks();
    expect(crossBowSniperAttackPower(tweaks, 0)).toBe(0);
    expect(crossBowSniperDefensePower(tweaks, 0)).toBe(0);
  });
});

describe("applyUpkeepTick", () => {
  it("deducts upkeep from food when there's enough to cover it", () => {
    const tweaks = loadRealTweaks();
    const units: UnitsRecord = {
      militiaCount: 4,
      junkyardKnightCount: 0,
      crossBowSniperCount: 0,
    };
    const upkeepPerMin = 4 * tweaks.units.militia.upkeep_food_per_min;

    const result = applyUpkeepTick(tweaks, units, 1000, 60);

    expect(result.food).toBeCloseTo(1000 - upkeepPerMin);
    expect(result.units).toEqual(units);
  });

  it("clamps food at 0 and deserts one militia when upkeep can't be covered", () => {
    const tweaks = loadRealTweaks();
    const units: UnitsRecord = {
      militiaCount: 3,
      junkyardKnightCount: 0,
      crossBowSniperCount: 0,
    };

    const result = applyUpkeepTick(tweaks, units, 0.001, 60);

    expect(result.food).toBe(0);
    expect(result.units.militiaCount).toBe(2);
  });

  it("deserts a junkyard knight before a cross-bow sniper, once militia is gone", () => {
    const tweaks = loadRealTweaks();
    const units: UnitsRecord = {
      militiaCount: 0,
      junkyardKnightCount: 2,
      crossBowSniperCount: 1,
    };

    const result = applyUpkeepTick(tweaks, units, 0, 60);

    expect(result.units.junkyardKnightCount).toBe(1);
    expect(result.units.crossBowSniperCount).toBe(1);
  });

  it("deserts a cross-bow sniper once militia and junkyard knights are gone", () => {
    const tweaks = loadRealTweaks();
    const units: UnitsRecord = {
      militiaCount: 0,
      junkyardKnightCount: 0,
      crossBowSniperCount: 1,
    };

    const result = applyUpkeepTick(tweaks, units, 0, 60);

    expect(result.units.crossBowSniperCount).toBe(0);
  });

  it("does nothing for zero or negative elapsed time", () => {
    const tweaks = loadRealTweaks();
    const units: UnitsRecord = {
      militiaCount: 3,
      junkyardKnightCount: 0,
      crossBowSniperCount: 0,
    };
    const result = applyUpkeepTick(tweaks, units, 500, 0);
    expect(result).toEqual({ food: 500, units });
  });

  it("does nothing when there are no units at all", () => {
    const tweaks = loadRealTweaks();
    const units: UnitsRecord = {
      militiaCount: 0,
      junkyardKnightCount: 0,
      crossBowSniperCount: 0,
    };
    const result = applyUpkeepTick(tweaks, units, 500, 3600);
    expect(result).toEqual({ food: 500, units });
  });
});

describe("resolveTrainingQueue", () => {
  const perUnitDurationMs = 20_000;

  it("delivers nothing before a single unit's duration has elapsed", () => {
    const queue: TrainingQueueProgress = { remaining: 3, currentUnitStartedAt: 1000 };
    const result = resolveTrainingQueue(queue, perUnitDurationMs, 1000 + perUnitDurationMs - 1);
    expect(result.delivered).toBe(0);
    expect(result.queue).toBe(queue);
  });

  it("delivers exactly one unit and rolls the clock forward by one duration", () => {
    const queue: TrainingQueueProgress = { remaining: 3, currentUnitStartedAt: 1000 };
    const result = resolveTrainingQueue(queue, perUnitDurationMs, 1000 + perUnitDurationMs);
    expect(result.delivered).toBe(1);
    expect(result.queue).toEqual({ remaining: 2, currentUnitStartedAt: 1000 + perUnitDurationMs });
  });

  it("preserves partial progress toward the next unit rather than resetting it", () => {
    const queue: TrainingQueueProgress = { remaining: 3, currentUnitStartedAt: 1000 };
    const now = 1000 + perUnitDurationMs + 7000; // one full unit plus 7s into the next
    const result = resolveTrainingQueue(queue, perUnitDurationMs, now);
    expect(result.delivered).toBe(1);
    expect(result.queue?.currentUnitStartedAt).toBe(1000 + perUnitDurationMs);
    // 7s of progress toward the next unit should still be reflected in the gap to `now`.
    expect(now - (result.queue?.currentUnitStartedAt ?? 0)).toBe(7000);
  });

  it("nulls the queue out exactly when the last unit is delivered", () => {
    const queue: TrainingQueueProgress = { remaining: 1, currentUnitStartedAt: 1000 };
    const result = resolveTrainingQueue(queue, perUnitDurationMs, 1000 + perUnitDurationMs);
    expect(result.delivered).toBe(1);
    expect(result.queue).toBeNull();
  });

  it("delivers multiple units at once after a long offline gap, clamped to `remaining`", () => {
    const queue: TrainingQueueProgress = { remaining: 3, currentUnitStartedAt: 1000 };
    const now = 1000 + perUnitDurationMs * 100; // way more than enough for all 3
    const result = resolveTrainingQueue(queue, perUnitDurationMs, now);
    expect(result.delivered).toBe(3);
    expect(result.queue).toBeNull();
  });

  it("returns delivered: 0 and queue: null for an already-empty queue", () => {
    expect(resolveTrainingQueue(null, perUnitDurationMs, 1_000_000)).toEqual({ queue: null, delivered: 0 });
  });
});

describe("militiaTrainDurationMs", () => {
  it("convert the configured per-unit seconds to milliseconds, for a single barracks", () => {
    const tweaks = loadRealTweaks();
    expect(militiaTrainDurationMs(tweaks, 1)).toBe(tweaks.units.militia.train_time_seconds * 1000);
  });

  it("scales inversely with the barracks's own level — L2 trains twice as fast as L1", () => {
    const tweaks = loadRealTweaks();
    expect(militiaTrainDurationMs(tweaks, 4)).toBeCloseTo((tweaks.units.militia.train_time_seconds * 1000) / 4);
  });

  it("floors at level 1 — never divides by zero or speeds up below the base rate", () => {
    const tweaks = loadRealTweaks();
    expect(militiaTrainDurationMs(tweaks, 0)).toBe(tweaks.units.militia.train_time_seconds * 1000);
  });
});

describe("junkyardKnightTrainDurationMs / crossBowSniperTrainDurationMs", () => {
  it("convert the configured per-unit seconds to milliseconds, for a single barracks", () => {
    const tweaks = loadRealTweaks();
    expect(junkyardKnightTrainDurationMs(tweaks, 1)).toBe(tweaks.units.junkyard_knight.train_time_seconds * 1000);
    expect(crossBowSniperTrainDurationMs(tweaks, 1)).toBe(tweaks.units.cross_bow_sniper.train_time_seconds * 1000);
  });

  it("scales inversely with barracks level", () => {
    const tweaks = loadRealTweaks();
    expect(junkyardKnightTrainDurationMs(tweaks, 2)).toBeCloseTo((tweaks.units.junkyard_knight.train_time_seconds * 1000) / 2);
    expect(crossBowSniperTrainDurationMs(tweaks, 4)).toBeCloseTo((tweaks.units.cross_bow_sniper.train_time_seconds * 1000) / 4);
  });
});
