import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import {
  attackableRadius,
  baseRelocationCost,
  baseRelocationDurationMs,
  baseRepairCost,
  baseReinforcementHp,
  baseReinforcementRepairDurationMs,
  baseReinforcementUpgradeDurationMs,
  baseUpgradeCost,
  baseUpgradeDurationMs,
  baseUpgradeTimeMinutes,
  canRelocateBase,
  isBaseBusy,
  isBaseHubBusy,
  isBaseRelocationComplete,
  isBaseUpgradeComplete,
  maxReinforcementLevel,
  reinforcementUpgradeCost,
  resolveBaseAction,
} from "./base";
import { initialBase } from "../data/base";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

describe("baseUpgradeCost", () => {
  it("applies Formula B to each cost_base resource", () => {
    const tweaks = loadRealTweaks();
    const cost = baseUpgradeCost(tweaks, 2);
    expect(cost.food).toBeCloseTo(500 * 0.5 * 1.2);
    expect(cost.wood).toBeCloseTo(300 * 0.5 * 1.2);
    expect(cost.stone).toBeCloseTo(200 * 0.5 * 1.2);
  });
});

describe("baseUpgradeTimeMinutes", () => {
  it("matches time(targetLevel) = first_upgrade_time_minutes * growth^(targetLevel-2)", () => {
    const tweaks = loadRealTweaks();
    expect(baseUpgradeTimeMinutes(tweaks, 2)).toBeCloseTo(9);
    expect(baseUpgradeTimeMinutes(tweaks, 3)).toBeCloseTo(9 * 1.2);
    expect(baseUpgradeTimeMinutes(tweaks, 4)).toBeCloseTo(9 * 1.2 * 1.2);
  });
});

describe("isBaseUpgradeComplete", () => {
  it("is false before the duration elapses and true at/after it", () => {
    const tweaks = loadRealTweaks();
    const startedAt = 1_000_000;
    const durationMs = baseUpgradeDurationMs(tweaks, 2);
    const upgrade = { targetLevel: 2, startedAt };

    expect(isBaseUpgradeComplete(tweaks, upgrade, startedAt + durationMs - 1)).toBe(false);
    expect(isBaseUpgradeComplete(tweaks, upgrade, startedAt + durationMs)).toBe(true);
  });

  it("resolves correctly even after a long offline gap", () => {
    const tweaks = loadRealTweaks();
    const startedAt = 1_000_000;
    const durationMs = baseUpgradeDurationMs(tweaks, 2);
    const upgrade = { targetLevel: 2, startedAt };

    expect(isBaseUpgradeComplete(tweaks, upgrade, startedAt + durationMs + 1000 * 60 * 60 * 24)).toBe(true);
  });
});

describe("attackableRadius", () => {
  it("starts generous at base level 1 and grows linearly per level", () => {
    const tweaks = loadRealTweaks();
    const { attack_radius_cap_base, attack_radius_cap_per_level } = tweaks.base_upgrades;
    expect(attackableRadius(tweaks, 1)).toBe(attack_radius_cap_base);
    expect(attackableRadius(tweaks, 2)).toBe(attack_radius_cap_base + attack_radius_cap_per_level);
    expect(attackableRadius(tweaks, 5)).toBe(attack_radius_cap_base + attack_radius_cap_per_level * 4);
  });
});

describe("baseReinforcementHp", () => {
  it("is the flat baseline at reinforcement level 0 — DESIGN.md §13's 'if there were no defences'", () => {
    const tweaks = loadRealTweaks();
    expect(baseReinforcementHp(tweaks, 0)).toBe(tweaks.base_reinforcement.base_hp);
  });

  it("gains a flat amount per reinforcement level", () => {
    const tweaks = loadRealTweaks();
    const { base_hp, hp_gain_per_level } = tweaks.base_reinforcement;
    expect(baseReinforcementHp(tweaks, 3)).toBe(base_hp + hp_gain_per_level * 3);
  });
});

describe("maxReinforcementLevel", () => {
  it("is capped by base level", () => {
    expect(maxReinforcementLevel(1)).toBe(1);
    expect(maxReinforcementLevel(4)).toBe(4);
  });
});

describe("reinforcementUpgradeCost", () => {
  it("applies Formula B to each cost_base resource", () => {
    const tweaks = loadRealTweaks();
    const cost = reinforcementUpgradeCost(tweaks, 2);
    expect(cost.wood).toBeCloseTo(200 * 0.5 * 1.2);
    expect(cost.stone).toBeCloseTo(100 * 0.5 * 1.2);
  });
});

describe("baseRepairCost", () => {
  it("is free at full HP", () => {
    const tweaks = loadRealTweaks();
    const maxHp = baseReinforcementHp(tweaks, 2);
    const cost = baseRepairCost(tweaks, maxHp, maxHp, 2);
    expect(cost.wood).toBeCloseTo(0);
    expect(cost.stone).toBeCloseTo(0);
  });

  it("scales with the fraction of HP missing, against reinforcementUpgradeCost's cost_base at the current level", () => {
    const tweaks = loadRealTweaks();
    const maxHp = baseReinforcementHp(tweaks, 2);
    const halfCost = baseRepairCost(tweaks, maxHp / 2, maxHp, 2);
    const fullCost = reinforcementUpgradeCost(tweaks, 2);
    expect(halfCost.wood).toBeCloseTo((fullCost.wood ?? 0) * 0.5);
    expect(halfCost.stone).toBeCloseTo((fullCost.stone ?? 0) * 0.5);
  });

  it("costs the full reinforcement-upgrade amount at 0 HP", () => {
    const tweaks = loadRealTweaks();
    const maxHp = baseReinforcementHp(tweaks, 1);
    const cost = baseRepairCost(tweaks, 0, maxHp, 1);
    const fullCost = reinforcementUpgradeCost(tweaks, 1);
    expect(cost.wood).toBeCloseTo(fullCost.wood ?? 0);
    expect(cost.stone).toBeCloseTo(fullCost.stone ?? 0);
  });
});

describe("canRelocateBase", () => {
  it("is false below min_base_level and true at/above it", () => {
    const tweaks = loadRealTweaks();
    const minLevel = tweaks.base_relocation.min_base_level;
    expect(canRelocateBase(tweaks, minLevel - 1)).toBe(false);
    expect(canRelocateBase(tweaks, minLevel)).toBe(true);
    expect(canRelocateBase(tweaks, minLevel + 1)).toBe(true);
  });
});

describe("isBaseHubBusy", () => {
  it("is true while base.action, relocation, or any storage upgrade is pending", () => {
    const tweaks = loadRealTweaks();
    const idle = initialBase(tweaks);
    const emptyStorage = {};

    expect(isBaseHubBusy(idle, emptyStorage)).toBe(false);
    expect(
      isBaseHubBusy({ ...idle, action: { kind: "level_upgrade", targetLevel: 2, startedAt: 0 } }, emptyStorage),
    ).toBe(true);
    expect(
      isBaseHubBusy(
        { ...idle, relocation: { destination: { q: 1, r: 0 }, startedAt: 0 } },
        emptyStorage,
      ),
    ).toBe(true);
    expect(
      isBaseHubBusy(idle, { food: { targetLevel: 2, startedAt: 0 } }),
    ).toBe(true);
  });
});

describe("isBaseBusy / resolveBaseAction", () => {
  it("isBaseBusy is true only while base.action is set", () => {
    const tweaks = loadRealTweaks();
    const idle = initialBase(tweaks);
    expect(isBaseBusy(idle)).toBe(false);
    expect(isBaseBusy({ ...idle, action: { kind: "level_upgrade", targetLevel: 2, startedAt: 0 } })).toBe(true);
  });

  it("resolves a completed level upgrade and clears action", () => {
    const tweaks = loadRealTweaks();
    const startedAt = 1_000_000;
    const durationMs = baseUpgradeDurationMs(tweaks, 2);
    const base = {
      ...initialBase(tweaks),
      action: { kind: "level_upgrade" as const, targetLevel: 2, startedAt },
    };
    expect(resolveBaseAction(tweaks, base, startedAt + durationMs - 1)).toBe(base);
    const resolved = resolveBaseAction(tweaks, base, startedAt + durationMs);
    expect(resolved.level).toBe(2);
    expect(resolved.action).toBeNull();
  });

  it("resolves a completed reinforcement upgrade and restores HP", () => {
    const tweaks = loadRealTweaks();
    const startedAt = 1_000_000;
    const durationMs = baseReinforcementUpgradeDurationMs(tweaks, 1);
    const base = {
      ...initialBase(tweaks),
      currentHp: 1,
      action: { kind: "reinforcement_upgrade" as const, targetLevel: 1, startedAt },
    };
    const resolved = resolveBaseAction(tweaks, base, startedAt + durationMs);
    expect(resolved.reinforcementLevel).toBe(1);
    expect(resolved.currentHp).toBe(baseReinforcementHp(tweaks, 1));
    expect(resolved.action).toBeNull();
  });

  it("resolves a completed reinforcement repair", () => {
    const tweaks = loadRealTweaks();
    const maxHp = baseReinforcementHp(tweaks, 0);
    const startedAt = 1_000_000;
    const durationMs = baseReinforcementRepairDurationMs(tweaks, maxHp / 2, maxHp);
    const base = {
      ...initialBase(tweaks),
      currentHp: maxHp / 2,
      action: { kind: "reinforcement_repair" as const, startedAt },
    };
    const resolved = resolveBaseAction(tweaks, base, startedAt + durationMs);
    expect(resolved.currentHp).toBe(maxHp);
    expect(resolved.action).toBeNull();
  });
});

describe("baseRelocationCost", () => {
  it("scales linearly with distance across every cost_per_tile_distance resource", () => {
    const tweaks = loadRealTweaks();
    const cost = baseRelocationCost(tweaks, 5);
    for (const [res, amount] of Object.entries(tweaks.base_relocation.cost_per_tile_distance)) {
      expect(cost[res as keyof typeof cost]).toBeCloseTo(amount * 5);
    }
  });

  it("is 0 at distance 0", () => {
    const tweaks = loadRealTweaks();
    const cost = baseRelocationCost(tweaks, 0);
    for (const amount of Object.values(cost)) {
      expect(amount).toBe(0);
    }
  });
});

describe("baseRelocationDurationMs", () => {
  it("scales linearly with distance", () => {
    const tweaks = loadRealTweaks();
    expect(baseRelocationDurationMs(tweaks, 5)).toBeCloseTo(5 * tweaks.base_relocation.seconds_per_tile_distance * 1000);
  });

  it("is 0 at distance 0", () => {
    const tweaks = loadRealTweaks();
    expect(baseRelocationDurationMs(tweaks, 0)).toBe(0);
  });
});

describe("isBaseRelocationComplete", () => {
  it("is false before the duration elapses and true at/after it", () => {
    const tweaks = loadRealTweaks();
    const startedAt = 1_000_000;
    const distanceTiles = 5;
    const durationMs = baseRelocationDurationMs(tweaks, distanceTiles);
    const relocation = { destination: { q: 10, r: 10 }, startedAt };

    expect(isBaseRelocationComplete(tweaks, relocation, distanceTiles, startedAt + durationMs - 1)).toBe(false);
    expect(isBaseRelocationComplete(tweaks, relocation, distanceTiles, startedAt + durationMs)).toBe(true);
  });

  it("resolves correctly even after a long offline gap", () => {
    const tweaks = loadRealTweaks();
    const startedAt = 1_000_000;
    const distanceTiles = 5;
    const durationMs = baseRelocationDurationMs(tweaks, distanceTiles);
    const relocation = { destination: { q: 10, r: 10 }, startedAt };

    expect(
      isBaseRelocationComplete(tweaks, relocation, distanceTiles, startedAt + durationMs + 1000 * 60 * 60 * 24),
    ).toBe(true);
  });
});
