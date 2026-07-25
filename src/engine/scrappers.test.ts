import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import { idleScrapperTrip, type ScrapYardRecord } from "../data/scrapYards";
import type { ScrapStashRecord } from "../data/scrapStashes";
import { advanceScrappers, assignScrapperStash } from "./scrappers";

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
    scrapper: idleScrapperTrip(),
    ...partial,
  };
}

function stash(partial: Partial<ScrapStashRecord> = {}): ScrapStashRecord {
  return {
    id: "stash-1",
    coord: { q: 2, r: 0 },
    remainingSteel: 40,
    artVariant: 1,
    tileLevel: 2,
    ...partial,
  };
}

describe("scrappers", () => {
  it("assign → arrive stash picks steel → return deposits to yard stockpile", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const yardCoord = { q: 1, r: 0 };
    const stashCoord = { q: 2, r: 0 };
    // Short owned corridor so pathfinding always succeeds.
    const owned = [base, yardCoord, stashCoord];
    const territory = { base, owned };
    const seed = 1;
    const gridSize = 32;
    const now = 1_000;

    const startedYard = assignScrapperStash(
      tweaks,
      seed,
      yard({ coord: yardCoord }),
      stash({ coord: stashCoord, remainingSteel: 40 }),
      territory,
      [],
      gridSize,
      now,
    );
    expect(startedYard).not.toBeNull();
    expect(startedYard!.scrapper?.phase).toBe("toStash");
    expect(startedYard!.scrapper!.path.length).toBeGreaterThanOrEqual(2);

    const arriveStashAt = startedYard!.scrapper!.arriveAt;
    const afterPickup = advanceScrappers(
      tweaks,
      seed,
      [startedYard!],
      [stash({ coord: stashCoord, remainingSteel: 40 })],
      territory,
      [],
      gridSize,
      arriveStashAt,
    );

    const cap = tweaks.scrap_yards.scrapper.capacity_by_level[1] ?? 8;
    const expectedCargo = Math.min(cap, 40);
    expect(afterPickup.scrapStashes[0]!.remainingSteel).toBe(40 - expectedCargo);
    expect(afterPickup.scrapYards[0]!.scrapper?.phase).toBe("toYard");
    expect(afterPickup.scrapYards[0]!.scrapper?.cargo).toBe(expectedCargo);
    expect(afterPickup.scrapYards[0]!.stockpile).toBe(0);

    const arriveYardAt = afterPickup.scrapYards[0]!.scrapper!.arriveAt;
    const afterDeliver = advanceScrappers(
      tweaks,
      seed,
      afterPickup.scrapYards,
      afterPickup.scrapStashes,
      afterPickup.territory,
      afterPickup.scoutedTiles,
      gridSize,
      arriveYardAt,
    );

    expect(afterDeliver.scrapYards[0]!.stockpile).toBe(expectedCargo);
    expect(afterDeliver.scrapYards[0]!.scrapper?.phase).toBe("idle");
    expect(afterDeliver.scrapYards[0]!.scrapper?.cargo).toBe(0);
  });
});
