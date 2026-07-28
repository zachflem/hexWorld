import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { remainingResourceAt } from "../data/hexResourcePools";
import { idleScrapperTrip, type ScrapYardRecord } from "../data/scrapYards";
import type { ScrapStashRecord } from "../data/scrapStashes";
import { tweaksSchema } from "../data/tweaksSchema";
import { axialKey } from "./hexCoords";
import type { PowerNetworkSnapshot } from "./power";
import {
  advanceScrappers,
  assignScrapperStash,
  recallScrapperToYard,
  scrapYardYieldPerSecond,
} from "./scrappers";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/profiles/default/tweaks.jsonc"), "utf-8");
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
    artVariant: 1,
    ...partial,
  };
}

function poolsFor(entries: Array<[ScrapStashRecord, number]>): Record<string, number> {
  return Object.fromEntries(entries.map(([s, remaining]) => [axialKey(s.coord), remaining]));
}

class AlwaysPoweredSet extends Set<string> {
  override has(): boolean {
    return true;
  }
}

const UNLIMITED_POWER: PowerNetworkSnapshot = {
  poweredTiles: new AlwaysPoweredSet(),
  totalCapacity: 1e9,
  totalDraw: 0,
  factor: 1,
  cutoff: 0.5,
};

const OFFLINE_POWER: PowerNetworkSnapshot = {
  poweredTiles: new Set(),
  totalCapacity: 0,
  totalDraw: 10,
  factor: 0,
  cutoff: 0.5,
};

describe("scrappers", () => {
  it("assign → arrive stash picks steel → return deposits to yard stockpile", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const yardCoord = { q: 1, r: 0 };
    const stashCoord = { q: 2, r: 0 };
    const owned = [base, yardCoord, stashCoord];
    const territory = { base, owned };
    const seed = 1;
    const gridSize = 32;
    const now = 1_000;
    const stashRecord = stash({ coord: stashCoord });
    const pools = poolsFor([[stashRecord, 40]]);

    const startedYard = assignScrapperStash(
      tweaks,
      seed,
      yard({ coord: yardCoord }),
      stashRecord,
      pools,
      territory,
      [],
      gridSize,
      now,
    );
    expect(startedYard).not.toBeNull();

    const arriveStashAt = startedYard!.scrapper!.arriveAt;
    const afterPickup = advanceScrappers(
      tweaks,
      seed,
      [startedYard!],
      [stashRecord],
      pools,
      territory,
      [],
      gridSize,
      arriveStashAt,
      UNLIMITED_POWER,
    );

    const cap = tweaks.scrap_yards.scrapper.capacity_by_level[1] ?? 8;
    const expectedCargo = Math.min(cap, 40);
    expect(remainingResourceAt(seed, stashCoord, afterPickup.hexResourcePools, tweaks)).toBe(40 - expectedCargo);
    expect(afterPickup.scrapYards[0]!.scrapper?.phase).toBe("toYard");
    expect(afterPickup.scrapYards[0]!.scrapper?.cargo).toBe(expectedCargo);

    const afterDeliver = advanceScrappers(
      tweaks,
      seed,
      afterPickup.scrapYards,
      afterPickup.scrapStashes,
      afterPickup.hexResourcePools,
      afterPickup.territory,
      afterPickup.scoutedTiles,
      gridSize,
      afterPickup.scrapYards[0]!.scrapper!.arriveAt,
      UNLIMITED_POWER,
    );

    expect(afterDeliver.scrapYards[0]!.stockpile).toBe(expectedCargo);
    expect(afterDeliver.scrapYards[0]!.scrapper?.phase).toBe("toStash");
  });

  it("recall at the yard clears the stash assignment and idles immediately", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const yardCoord = { q: 1, r: 0 };
    const stashCoord = { q: 2, r: 0 };
    const territory = { base, owned: [base, yardCoord, stashCoord] };
    const seed = 1;
    const now = 1_000;
    const stashRecord = stash({ coord: stashCoord });
    const startedYard = assignScrapperStash(
      tweaks,
      seed,
      yard({ coord: yardCoord }),
      stashRecord,
      poolsFor([[stashRecord, 40]]),
      territory,
      [],
      32,
      now,
    );
    const recalled = recallScrapperToYard(tweaks, seed, startedYard!, territory, [], 32, now + 1);
    expect(recalled!.scrapper?.phase).toBe("idle");
    expect(recalled!.scrapper?.assignedStashId).toBeNull();
  });

  it("recall mid-route clears assignment so arrival does not auto-redeploy", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const yardCoord = { q: 1, r: 0 };
    const stashCoord = { q: 2, r: 0 };
    const territory = { base, owned: [base, yardCoord, stashCoord] };
    const seed = 1;
    const now = 1_000;
    const stashRecord = stash({ coord: stashCoord });
    const startedYard = assignScrapperStash(
      tweaks,
      seed,
      yard({ coord: yardCoord }),
      stashRecord,
      poolsFor([[stashRecord, 40]]),
      territory,
      [],
      32,
      now,
    );
    const recalled = recallScrapperToYard(
      tweaks,
      seed,
      startedYard!,
      territory,
      [],
      32,
      startedYard!.scrapper!.arriveAt,
    );
    const afterHome = advanceScrappers(
      tweaks,
      seed,
      [recalled!],
      [stashRecord],
      poolsFor([[stashRecord, 40]]),
      territory,
      [],
      32,
      recalled!.scrapper!.arriveAt,
      UNLIMITED_POWER,
    );
    expect(afterHome.scrapYards[0]!.scrapper?.phase).toBe("idle");
  });

  it("stops looping and idles when the assigned stash is empty", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const yardCoord = { q: 1, r: 0 };
    const stashCoord = { q: 2, r: 0 };
    const territory = { base, owned: [base, yardCoord, stashCoord] };
    const seed = 1;
    const cap = tweaks.scrap_yards.scrapper.capacity_by_level[1] ?? 8;
    const stashRecord = stash({ coord: stashCoord });
    const pools = poolsFor([[stashRecord, cap]]);

    const startedYard = assignScrapperStash(
      tweaks,
      seed,
      yard({ coord: yardCoord }),
      stashRecord,
      pools,
      territory,
      [],
      32,
      1_000,
    );
    const afterPickup = advanceScrappers(
      tweaks,
      seed,
      [startedYard!],
      [stashRecord],
      pools,
      territory,
      [],
      32,
      startedYard!.scrapper!.arriveAt,
      UNLIMITED_POWER,
    );
    expect(remainingResourceAt(seed, stashCoord, afterPickup.hexResourcePools, tweaks)).toBe(0);

    const afterDeliver = advanceScrappers(
      tweaks,
      seed,
      afterPickup.scrapYards,
      afterPickup.scrapStashes,
      afterPickup.hexResourcePools,
      afterPickup.territory,
      afterPickup.scoutedTiles,
      32,
      afterPickup.scrapYards[0]!.scrapper!.arriveAt,
      UNLIMITED_POWER,
    );
    expect(afterDeliver.scrapYards[0]!.scrapper?.phase).toBe("idle");
  });

  it("L2+ yards without power freeze the Scrapper mid-route (cargo kept)", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const yardCoord = { q: 1, r: 0 };
    const stashCoord = { q: 2, r: 0 };
    const territory = { base, owned: [base, yardCoord, stashCoord] };
    const seed = 1;
    const stashRecord = stash({ coord: stashCoord });
    const startedYard = assignScrapperStash(
      tweaks,
      seed,
      yard({ coord: yardCoord, level: 2 }),
      stashRecord,
      poolsFor([[stashRecord, 40]]),
      territory,
      [],
      32,
      1_000,
    );
    const frozen = advanceScrappers(
      tweaks,
      seed,
      [startedYard!],
      [stashRecord],
      poolsFor([[stashRecord, 40]]),
      territory,
      [],
      32,
      startedYard!.scrapper!.arriveAt,
      OFFLINE_POWER,
    );
    expect(frozen.scrapYards[0]!.scrapper?.phase).toBe("toStash");
    expect(remainingResourceAt(seed, stashCoord, frozen.hexResourcePools, tweaks)).toBe(40);
  });

  it("scrapYardYieldPerSecond estimates steel/sec from capacity and round-trip to a known stash", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const yardCoord = { q: 1, r: 0 };
    const stashCoord = { q: 2, r: 0 };
    const territory = { base, owned: [base, yardCoord, stashCoord] };
    const stashRecord = stash({ coord: stashCoord });
    const rate = scrapYardYieldPerSecond(
      tweaks,
      1,
      yard({ coord: yardCoord }),
      [stashRecord],
      poolsFor([[stashRecord, 400]]),
      territory,
      [],
      32,
      UNLIMITED_POWER,
    );
    expect(rate).toBeGreaterThan(0);
  });
});
