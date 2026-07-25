import { describe, expect, it } from "vitest";
import {
  SAVE_FILE_FORMAT,
  SAVE_FILE_VERSION,
  buildSaveFile,
  keysToStoredGame,
  parseSaveFile,
  snapshotToKeys,
  suggestSaveFilename,
  type PersistableGameSnapshot,
} from "./gamePersistence";

function minimalSnapshot(overrides: Partial<PersistableGameSnapshot> = {}): PersistableGameSnapshot {
  return {
    player: { name: "Goblin", color: "#863bff" },
    world: { seed: 42, gridSize: 128 },
    territory: { base: { q: 0, r: 0 }, owned: [] },
    base: { level: 1 },
    resources: { food: 10, wood: 20, stone: 30, steel: 0 },
    clock: { lastTickAt: 1_000, virtualNow: 1_000 },
    extractionTiles: [],
    towers: [],
    walls: [],
    barracksList: [],
    powerStations: [],
    units: { militiaCount: 0, junkyardKnightCount: 0, crossBowSniperCount: 0 },
    garrisons: [],
    scoutedTiles: [],
    storageLevels: { food: 1, wood: 1, stone: 1, steel: 1 },
    storageUpgrades: {},
    noise: { value: 0 },
    dens: [],
    scrapStashes: [],
    hordes: [],
    expeditions: [],
    gameStatus: { lost: false, won: false },
    docks: [],
    scoutSkiffs: [],
    wanderingScouts: [],
    denAssaults: [],
    outposts: [],
    garrisonRecalls: [],
    lab: null,
    labAssaults: [],
    research: {},
    tombstones: [],
    ...overrides,
  };
}

describe("buildSaveFile / parseSaveFile", () => {
  it("round-trips a complete snapshot", () => {
    const save = buildSaveFile(minimalSnapshot(), "hard", 1_700_000_000_000);
    expect(save.format).toBe(SAVE_FILE_FORMAT);
    expect(save.version).toBe(SAVE_FILE_VERSION);
    expect(save.profileSlug).toBe("hard");
    expect(save.keys.barracks).toEqual([]);
    expect(save.keys.profileSlug).toBe("hard");

    const parsed = parseSaveFile(JSON.parse(JSON.stringify(save)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.save.profileSlug).toBe("hard");
    expect(parsed.save.keys.player).toEqual({ name: "Goblin", color: "#863bff" });
  });

  it("rejects wrong format / version / incomplete keys", () => {
    const good = buildSaveFile(minimalSnapshot(), "default", 1);
    expect(parseSaveFile(null).ok).toBe(false);
    expect(parseSaveFile({ ...good, format: "other" }).ok).toBe(false);
    expect(parseSaveFile({ ...good, version: 99 }).ok).toBe(false);
    expect(parseSaveFile({ ...good, profileSlug: "" }).ok).toBe(false);
    expect(parseSaveFile({ ...good, keys: { ...good.keys, player: undefined } }).ok).toBe(false);
  });

  it("maps barracksList ↔ barracks key", () => {
    const keys = snapshotToKeys(minimalSnapshot({ barracksList: [{ id: "b1" }] }), "default");
    expect(keys.barracks).toEqual([{ id: "b1" }]);
    const stored = keysToStoredGame(keys, "default");
    expect(stored.barracksList).toEqual([{ id: "b1" }]);
  });

  it("suggests a stable download filename", () => {
    const save = buildSaveFile(minimalSnapshot(), "default", Date.parse("2026-07-24T00:00:00Z"));
    expect(suggestSaveFilename(save)).toBe("hexworld-Goblin-42-2026-07-24.json");
  });
});
