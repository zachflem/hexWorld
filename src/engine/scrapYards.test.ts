import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import type { ScrapYardRecord } from "../data/scrapYards";
import {
  advanceScrapYardCouriers,
  collectScrapYard,
  nextScrapYardLevel,
  scrapYardBuildCost,
  scrapYardUpgradeCost,
} from "./scrapYards";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

function yard(partial: Partial<ScrapYardRecord> = {}): ScrapYardRecord {
  return {
    coord: { q: 1, r: 0 },
    buildStartedAt: null,
    stockpile: 0,
    level: 1,
    upgrade: null,
    courier: null,
    totalInvested: { wood: 400, stone: 300 },
    buildCost: { wood: 400, stone: 300 },
    damaged: false,
    damageRepair: null,
    scrapperReady: true,
    scrapper: null,
    ...partial,
  };
}

describe("scrapYards", () => {
  it("build cost scales with Formula A from scrap_yards.build_cost_base", () => {
    const tweaks = loadRealTweaks();
    const first = scrapYardBuildCost(tweaks, 1);
    const second = scrapYardBuildCost(tweaks, 2);
    expect(first.wood).toBe(tweaks.scrap_yards.build_cost_base.wood);
    expect(second.wood).toBeGreaterThan(first.wood!);
  });

  it("upgrade costs reuse steel mid/large tier tables", () => {
    const tweaks = loadRealTweaks();
    const l2 = scrapYardUpgradeCost(tweaks, 2);
    const l3 = scrapYardUpgradeCost(tweaks, 3);
    expect(l2.steel).toBeGreaterThan(0);
    expect(l3.steel).toBeGreaterThan(l2.steel!);
    expect(nextScrapYardLevel(3)).toBeNull();
  });

  it("collectScrapYard moves steel into the shared pool", () => {
    const tweaks = loadRealTweaks();
    const result = collectScrapYard(
      tweaks,
      yard({ stockpile: 40 }),
      { food: 0, wood: 0, stone: 0, steel: 10 },
      { food: 1, wood: 1, stone: 1, steel: 1 },
    );
    expect(result.resources.steel).toBe(50);
    expect(result.yard.stockpile).toBe(0);
  });

  it("L1 yards stay manual-collect only (no courier)", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const yardCoord = { q: 1, r: 0 };
    const result = advanceScrapYardCouriers(
      tweaks,
      [yard({ coord: yardCoord, level: 1, stockpile: 25 })],
      { food: 0, wood: 0, stone: 0, steel: 0 },
      { food: 1, wood: 1, stone: 1, steel: 1 },
      60_000,
      1,
      base,
      { base, owned: [base, yardCoord] },
      [],
      32,
    );
    expect(result.resources.steel).toBe(0);
    expect(result.scrapYards[0]!.courier).toBeNull();
    expect(result.scrapYards[0]!.stockpile).toBe(25);
  });

  it("advanceScrapYardCouriers deposits stockpile steel to base at L2+ when a route exists", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const yardCoord = { q: 1, r: 0 };
    const owned = [base, yardCoord];
    const territory = { base, owned };
    const storage = { food: 1, wood: 1, stone: 1, steel: 1 };
    const empty = { food: 0, wood: 0, stone: 0, steel: 0 };

    const started = advanceScrapYardCouriers(
      tweaks,
      [yard({ coord: yardCoord, level: 2, stockpile: 25 })],
      empty,
      storage,
      1_000,
      1,
      base,
      territory,
      [],
      32,
    );
    expect(started.resources.steel).toBe(0);
    expect(started.scrapYards[0]!.courier?.phase).toBe("toBase");
    const cargo = started.scrapYards[0]!.courier!.cargo;
    expect(cargo).toBeGreaterThan(0);
    expect(
      started.resources.steel + started.scrapYards[0]!.stockpile + (started.scrapYards[0]!.courier?.cargo ?? 0),
    ).toBe(25);

    const delivered = advanceScrapYardCouriers(
      tweaks,
      started.scrapYards,
      started.resources,
      storage,
      started.scrapYards[0]!.courier!.arriveAt,
      1,
      base,
      territory,
      [],
      32,
    );
    expect(delivered.resources.steel).toBeCloseTo(cargo);
    expect(delivered.scrapYards[0]!.courier?.phase).toBe("returning");
  });
});
