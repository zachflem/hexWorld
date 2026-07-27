import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import { tweaksSchema } from "../data/tweaksSchema";
import { idleScrapperTrip, type ScrapYardRecord } from "../data/scrapYards";
import type { ScrapStashRecord } from "../data/scrapStashes";
import type { PowerNetworkSnapshot } from "./power";
import {
  advanceScrappers,
  assignScrapperStash,
  recallScrapperToYard,
  scrapYardYieldPerSecond,
} from "./scrappers";

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

/** Every tile always reads as powered — these tests aren't about AoE coverage. */
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
      UNLIMITED_POWER,
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
      UNLIMITED_POWER,
    );

    expect(afterDeliver.scrapYards[0]!.stockpile).toBe(expectedCargo);
    expect(afterDeliver.scrapYards[0]!.scrapper?.phase).toBe("toStash");
    expect(afterDeliver.scrapYards[0]!.scrapper?.assignedStashId).toBe("stash-1");
    expect(afterDeliver.scrapYards[0]!.scrapper?.cargo).toBe(0);
  });

  it("recall at the yard clears the stash assignment and idles immediately", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const yardCoord = { q: 1, r: 0 };
    const stashCoord = { q: 2, r: 0 };
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

    // Still on the yard hex one tick later — no yard→yard path; park + clear.
    const recalled = recallScrapperToYard(
      tweaks,
      seed,
      startedYard!,
      territory,
      [],
      gridSize,
      now + 1,
    );
    expect(recalled).not.toBeNull();
    expect(recalled!.scrapper?.phase).toBe("idle");
    expect(recalled!.scrapper?.assignedStashId).toBeNull();
  });

  it("recall mid-route clears assignment so arrival does not auto-redeploy", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const yardCoord = { q: 1, r: 0 };
    const stashCoord = { q: 2, r: 0 };
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
    const trip = startedYard!.scrapper!;
    expect(trip.path.length).toBeGreaterThanOrEqual(2);

    // Advance to the far hex so recall must build a real return leg.
    const midNow = trip.arriveAt;
    const recalled = recallScrapperToYard(
      tweaks,
      seed,
      startedYard!,
      territory,
      [],
      gridSize,
      midNow,
    );
    expect(recalled).not.toBeNull();
    expect(recalled!.scrapper?.phase).toBe("toYard");
    expect(recalled!.scrapper?.assignedStashId).toBeNull();

    const afterHome = advanceScrappers(
      tweaks,
      seed,
      [recalled!],
      [stash({ coord: stashCoord, remainingSteel: 40 })],
      territory,
      [],
      gridSize,
      recalled!.scrapper!.arriveAt,
      UNLIMITED_POWER,
    );
    expect(afterHome.scrapYards[0]!.scrapper?.phase).toBe("idle");
    expect(afterHome.scrapYards[0]!.scrapper?.assignedStashId).toBeNull();
  });

  it("stops looping and idles when the assigned stash is empty", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const yardCoord = { q: 1, r: 0 };
    const stashCoord = { q: 2, r: 0 };
    const owned = [base, yardCoord, stashCoord];
    const territory = { base, owned };
    const seed = 1;
    const gridSize = 32;
    const now = 1_000;
    const cap = tweaks.scrap_yards.scrapper.capacity_by_level[1] ?? 8;

    const startedYard = assignScrapperStash(
      tweaks,
      seed,
      yard({ coord: yardCoord }),
      stash({ coord: stashCoord, remainingSteel: cap }),
      territory,
      [],
      gridSize,
      now,
    );
    expect(startedYard).not.toBeNull();

    const afterPickup = advanceScrappers(
      tweaks,
      seed,
      [startedYard!],
      [stash({ coord: stashCoord, remainingSteel: cap })],
      territory,
      [],
      gridSize,
      startedYard!.scrapper!.arriveAt,
      UNLIMITED_POWER,
    );
    expect(afterPickup.scrapStashes[0]!.remainingSteel).toBe(0);

    const afterDeliver = advanceScrappers(
      tweaks,
      seed,
      afterPickup.scrapYards,
      afterPickup.scrapStashes,
      afterPickup.territory,
      afterPickup.scoutedTiles,
      gridSize,
      afterPickup.scrapYards[0]!.scrapper!.arriveAt,
      UNLIMITED_POWER,
    );

    expect(afterDeliver.scrapYards[0]!.stockpile).toBe(cap);
    expect(afterDeliver.scrapYards[0]!.scrapper?.phase).toBe("idle");
  });

  it("L2+ yards without power freeze the Scrapper mid-route (cargo kept)", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const yardCoord = { q: 1, r: 0 };
    const stashCoord = { q: 2, r: 0 };
    const owned = [base, yardCoord, stashCoord];
    const territory = { base, owned };
    const seed = 1;
    const gridSize = 32;
    const now = 1_000;

    const startedYard = assignScrapperStash(
      tweaks,
      seed,
      yard({ coord: yardCoord, level: 2 }),
      stash({ coord: stashCoord, remainingSteel: 40 }),
      territory,
      [],
      gridSize,
      now,
    );
    expect(startedYard).not.toBeNull();
    const arriveStashAt = startedYard!.scrapper!.arriveAt;

    const frozen = advanceScrappers(
      tweaks,
      seed,
      [startedYard!],
      [stash({ coord: stashCoord, remainingSteel: 40 })],
      territory,
      [],
      gridSize,
      arriveStashAt,
      OFFLINE_POWER,
    );

    expect(frozen.scrapYards[0]!.scrapper?.phase).toBe("toStash");
    expect(frozen.scrapYards[0]!.scrapper?.cargo).toBe(0);
    expect(frozen.scrapStashes[0]!.remainingSteel).toBe(40);
    expect(frozen.scrapYards[0]!.stockpile).toBe(0);
  });

  it("scrapYardYieldPerSecond estimates steel/sec from capacity and round-trip to a known stash", () => {
    const tweaks = loadRealTweaks();
    const base = { q: 0, r: 0 };
    const yardCoord = { q: 1, r: 0 };
    const stashCoord = { q: 2, r: 0 };
    const owned = [base, yardCoord, stashCoord];
    const territory = { base, owned };
    const activeYard = yard({ coord: yardCoord, level: 1 });
    const stashes = [stash({ coord: stashCoord, remainingSteel: 400 })];

    const rate = scrapYardYieldPerSecond(tweaks, 1, activeYard, stashes, territory, [], 32, UNLIMITED_POWER);
    expect(rate).toBeGreaterThan(0);

    const offline = scrapYardYieldPerSecond(
      tweaks,
      1,
      yard({ coord: yardCoord, level: 2 }),
      stashes,
      territory,
      [],
      32,
      OFFLINE_POWER,
    );
    expect(offline).toBe(0);
  });
});
