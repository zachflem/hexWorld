import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import stripJsonComments from "strip-json-comments";
import { describe, expect, it } from "vitest";
import type { Axial } from "./hexCoords";
import type { DenAssaultRecord, DenAssaultsRecord } from "../data/denAssaults";
import type { Expedition, ExpeditionsRecord } from "../data/expeditions";
import type { Garrison, GarrisonsRecord } from "../data/garrisons";
import type { GarrisonRecallRecord, GarrisonRecallsRecord } from "../data/garrisonRecalls";
import type { LabAssaultRecord, LabAssaultsRecord } from "../data/labAssaults";
import type { UnitsRecord } from "../data/units";
import type { Wall } from "../data/walls";
import { tweaksSchema } from "../data/tweaksSchema";
import {
  availableCrossBowSnipers,
  availableJunkyardKnights,
  availableMilitia,
  garrisonAt,
  garrisonAttackPower,
  garrisonDefense,
  garrisonWallRangeBonus,
  garrisonedCrossBowSniperTotal,
  garrisonedJunkyardKnightTotal,
  garrisonedMilitiaTotal,
  isHordeReachableFromGarrison,
  resolveCapturedGarrisons,
} from "./garrisons";

function loadRealTweaks() {
  const raw = readFileSync(resolve(__dirname, "../../public/tweaks.jsonc"), "utf-8");
  return tweaksSchema.parse(JSON.parse(stripJsonComments(raw)));
}

function makeGarrison(coord: Axial, overrides: Partial<Garrison> = {}): Garrison {
  return { coord, militiaCount: 0, junkyardKnightCount: 0, crossBowSniperCount: 0, ...overrides };
}

function makeExpedition(overrides: Partial<Expedition> = {}): Expedition {
  return {
    id: "expedition-test",
    target: { q: 9, r: 9 },
    path: [],
    militiaCommitted: 0,
    junkyardKnightCommitted: 0,
    crossBowSniperCommitted: 0,
    departedAt: 0,
    arriveAt: 0,
    resolvedIndex: 0,
    ...overrides,
  };
}

function makeDenAssault(overrides: Partial<DenAssaultRecord> = {}): DenAssaultRecord {
  return {
    id: "denAssault-test",
    denId: "den-1",
    target: { q: 9, r: 9 },
    path: [],
    militiaCommitted: 0,
    junkyardKnightCommitted: 0,
    crossBowSniperCommitted: 0,
    departedAt: 0,
    arriveAt: 0,
    resolvedIndex: 0,
    ...overrides,
  };
}

function makeLabAssault(overrides: Partial<LabAssaultRecord> = {}): LabAssaultRecord {
  return {
    id: "labAssault-test",
    target: { q: 9, r: 9 },
    path: [],
    militiaCommitted: 0,
    junkyardKnightCommitted: 0,
    crossBowSniperCommitted: 0,
    departedAt: 0,
    arriveAt: 0,
    resolvedIndex: 0,
    ...overrides,
  };
}

function makeGarrisonRecall(overrides: Partial<GarrisonRecallRecord> = {}): GarrisonRecallRecord {
  return {
    id: "recall-test",
    coord: { q: 9, r: 9 },
    militiaCommitted: 0,
    junkyardKnightCommitted: 0,
    crossBowSniperCommitted: 0,
    departedAt: 0,
    arriveAt: 0,
    ...overrides,
  };
}

const units = (overrides: Partial<UnitsRecord> = {}): UnitsRecord => ({
  scoutStockpile: 0,
  militiaCount: 0,
  junkyardKnightCount: 0,
  crossBowSniperCount: 0,
  ...overrides,
});

describe("garrisonAt", () => {
  it("finds the garrison at a coord, or null if none", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 1, r: 0 }, { militiaCount: 3 })];
    expect(garrisonAt(garrisons, { q: 1, r: 0 })?.militiaCount).toBe(3);
    expect(garrisonAt(garrisons, { q: 2, r: 0 })).toBeNull();
  });
});

describe("garrisonedMilitiaTotal / availableMilitia", () => {
  it("sums militia across every garrison", () => {
    const garrisons: GarrisonsRecord = [
      makeGarrison({ q: 0, r: 0 }, { militiaCount: 3 }),
      makeGarrison({ q: 1, r: 0 }, { militiaCount: 5 }),
    ];
    expect(garrisonedMilitiaTotal(garrisons)).toBe(8);
  });

  it("is 0 with no garrisons", () => {
    expect(garrisonedMilitiaTotal([])).toBe(0);
  });

  it("subtracts every garrison's militia from the standing army total", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { militiaCount: 4 })];
    expect(availableMilitia(units({ militiaCount: 10 }), garrisons, [], [], [], [])).toBe(6);
  });

  it("never goes negative, even if garrisons somehow exceed the total (defensive floor)", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { militiaCount: 20 })];
    expect(availableMilitia(units({ militiaCount: 10 }), garrisons, [], [], [], [])).toBe(0);
  });

  it("also subtracts militia committed to any pending expedition", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { militiaCount: 4 })];
    const expeditions: ExpeditionsRecord = [makeExpedition({ militiaCommitted: 3 })];
    expect(availableMilitia(units({ militiaCount: 10 }), garrisons, expeditions, [], [], [])).toBe(3);
  });

  it("never goes negative when garrison + expedition commitments exceed the total", () => {
    const expeditions: ExpeditionsRecord = [makeExpedition({ militiaCommitted: 20 })];
    expect(availableMilitia(units({ militiaCount: 10 }), [], expeditions, [], [], [])).toBe(0);
  });

  it("also subtracts militia committed to any pending den assault", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { militiaCount: 4 })];
    const denAssaults: DenAssaultsRecord = [makeDenAssault({ militiaCommitted: 3 })];
    expect(availableMilitia(units({ militiaCount: 10 }), garrisons, [], denAssaults, [], [])).toBe(3);
  });

  it("also subtracts militia marching home after a recall, not yet arrived", () => {
    const garrisonRecalls: GarrisonRecallsRecord = [makeGarrisonRecall({ militiaCommitted: 3 })];
    expect(availableMilitia(units({ militiaCount: 10 }), [], [], [], garrisonRecalls, [])).toBe(7);
  });

  it("also subtracts militia committed to any pending lab assault", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { militiaCount: 4 })];
    const labAssaults: LabAssaultsRecord = [makeLabAssault({ militiaCommitted: 3 })];
    expect(availableMilitia(units({ militiaCount: 10 }), garrisons, [], [], [], labAssaults)).toBe(3);
  });
});

describe("garrisonedJunkyardKnightTotal / availableJunkyardKnights", () => {
  it("sums junkyard knights across every garrison", () => {
    const garrisons: GarrisonsRecord = [
      makeGarrison({ q: 0, r: 0 }, { junkyardKnightCount: 2 }),
      makeGarrison({ q: 1, r: 0 }, { junkyardKnightCount: 3 }),
    ];
    expect(garrisonedJunkyardKnightTotal(garrisons)).toBe(5);
  });

  it("subtracts garrisoned junkyard knights from the standing army total", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { junkyardKnightCount: 4 })];
    expect(availableJunkyardKnights(units({ junkyardKnightCount: 10 }), garrisons, [], [], [], [])).toBe(6);
  });

  it("also subtracts junkyard knights committed to any pending expedition", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { junkyardKnightCount: 4 })];
    const expeditions: ExpeditionsRecord = [makeExpedition({ junkyardKnightCommitted: 2 })];
    expect(availableJunkyardKnights(units({ junkyardKnightCount: 10 }), garrisons, expeditions, [], [], [])).toBe(4);
  });

  it("also subtracts junkyard knights committed to any pending den assault", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { junkyardKnightCount: 4 })];
    const denAssaults: DenAssaultsRecord = [makeDenAssault({ junkyardKnightCommitted: 2 })];
    expect(availableJunkyardKnights(units({ junkyardKnightCount: 10 }), garrisons, [], denAssaults, [], [])).toBe(4);
  });

  it("also subtracts junkyard knights marching home after a recall, not yet arrived", () => {
    const garrisonRecalls: GarrisonRecallsRecord = [makeGarrisonRecall({ junkyardKnightCommitted: 2 })];
    expect(availableJunkyardKnights(units({ junkyardKnightCount: 10 }), [], [], [], garrisonRecalls, [])).toBe(8);
  });

  it("also subtracts junkyard knights committed to any pending lab assault", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { junkyardKnightCount: 4 })];
    const labAssaults: LabAssaultsRecord = [makeLabAssault({ junkyardKnightCommitted: 2 })];
    expect(availableJunkyardKnights(units({ junkyardKnightCount: 10 }), garrisons, [], [], [], labAssaults)).toBe(4);
  });
});

describe("garrisonedCrossBowSniperTotal / availableCrossBowSnipers", () => {
  it("sums cross-bow snipers across every garrison", () => {
    const garrisons: GarrisonsRecord = [
      makeGarrison({ q: 0, r: 0 }, { crossBowSniperCount: 1 }),
      makeGarrison({ q: 1, r: 0 }, { crossBowSniperCount: 2 }),
    ];
    expect(garrisonedCrossBowSniperTotal(garrisons)).toBe(3);
  });

  it("subtracts garrisoned cross-bow snipers from the standing army total", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { crossBowSniperCount: 4 })];
    expect(availableCrossBowSnipers(units({ crossBowSniperCount: 10 }), garrisons, [], [], [], [])).toBe(6);
  });

  it("also subtracts cross-bow snipers committed to any pending expedition", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { crossBowSniperCount: 4 })];
    const expeditions: ExpeditionsRecord = [makeExpedition({ crossBowSniperCommitted: 1 })];
    expect(availableCrossBowSnipers(units({ crossBowSniperCount: 10 }), garrisons, expeditions, [], [], [])).toBe(5);
  });

  it("also subtracts cross-bow snipers committed to any pending den assault", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { crossBowSniperCount: 4 })];
    const denAssaults: DenAssaultsRecord = [makeDenAssault({ crossBowSniperCommitted: 1 })];
    expect(availableCrossBowSnipers(units({ crossBowSniperCount: 10 }), garrisons, [], denAssaults, [], [])).toBe(5);
  });

  it("also subtracts cross-bow snipers marching home after a recall, not yet arrived", () => {
    const garrisonRecalls: GarrisonRecallsRecord = [makeGarrisonRecall({ crossBowSniperCommitted: 1 })];
    expect(availableCrossBowSnipers(units({ crossBowSniperCount: 10 }), [], [], [], garrisonRecalls, [])).toBe(9);
  });

  it("also subtracts cross-bow snipers committed to any pending lab assault", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { crossBowSniperCount: 4 })];
    const labAssaults: LabAssaultsRecord = [makeLabAssault({ crossBowSniperCommitted: 1 })];
    expect(availableCrossBowSnipers(units({ crossBowSniperCount: 10 }), garrisons, [], [], [], labAssaults)).toBe(5);
  });
});

describe("garrisonDefense", () => {
  it("is militiaCount * defense_per_unit for a militia-only garrisoned tile", () => {
    const tweaks = loadRealTweaks();
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { militiaCount: 4 })];
    expect(garrisonDefense(tweaks, garrisons, { q: 0, r: 0 })).toBe(4 * tweaks.units.militia.defense_per_unit);
  });

  it("sums defense across militia, junkyard knights, and cross-bow snipers", () => {
    const tweaks = loadRealTweaks();
    const garrisons: GarrisonsRecord = [
      makeGarrison({ q: 0, r: 0 }, { militiaCount: 4, junkyardKnightCount: 2, crossBowSniperCount: 1 }),
    ];
    const expected =
      4 * tweaks.units.militia.defense_per_unit +
      2 * tweaks.units.junkyard_knight.defense_per_unit +
      1 * tweaks.units.cross_bow_sniper.defense_per_unit;
    expect(garrisonDefense(tweaks, garrisons, { q: 0, r: 0 })).toBeCloseTo(expected);
  });

  it("is 0 for a tile with no garrison", () => {
    const tweaks = loadRealTweaks();
    expect(garrisonDefense(tweaks, [], { q: 0, r: 0 })).toBe(0);
  });
});

describe("garrisonAttackPower", () => {
  it("sums attack power across militia, junkyard knights, and cross-bow snipers", () => {
    const tweaks = loadRealTweaks();
    const garrison = makeGarrison({ q: 0, r: 0 }, { militiaCount: 5, junkyardKnightCount: 2, crossBowSniperCount: 1 });
    const expected =
      5 * tweaks.units.militia.attack_per_unit +
      2 * tweaks.units.junkyard_knight.attack_per_unit +
      1 * tweaks.units.cross_bow_sniper.attack_per_unit;
    expect(garrisonAttackPower(tweaks, garrison)).toBeCloseTo(expected);
  });

  it("is 0 for an empty garrison", () => {
    const tweaks = loadRealTweaks();
    expect(garrisonAttackPower(tweaks, makeGarrison({ q: 0, r: 0 }))).toBe(0);
  });
});

function makeWall(coord: Axial, overrides: Partial<Wall> = {}): Wall {
  return { coord, tier: "wood", durability: 0, totalInvested: {}, action: null, buildCost: {}, damaged: false, ...overrides };
}

describe("isHordeReachableFromGarrison", () => {
  it("reaches the garrison's own tile", () => {
    const tweaks = loadRealTweaks();
    expect(isHordeReachableFromGarrison(tweaks, [], { q: 5, r: 5 }, { q: 5, r: 5 })).toBe(true);
  });

  it("reaches a directly adjacent tile", () => {
    const tweaks = loadRealTweaks();
    expect(isHordeReachableFromGarrison(tweaks, [], { q: 5, r: 5 }, { q: 6, r: 5 })).toBe(true);
  });

  it("does not reach two tiles away, with no wall bonus", () => {
    const tweaks = loadRealTweaks();
    expect(isHordeReachableFromGarrison(tweaks, [], { q: 5, r: 5 }, { q: 7, r: 5 })).toBe(false);
  });

  it("reaches further out when garrisoned on a non-damaged wall — +garrison_range_bonus_tiles", () => {
    const tweaks = loadRealTweaks();
    const walls = [makeWall({ q: 5, r: 5 })];
    const extendedDistance = 1 + tweaks.walls.garrison_range_bonus_tiles;
    const farCoord = { q: 5 + extendedDistance, r: 5 };
    expect(isHordeReachableFromGarrison(tweaks, walls, { q: 5, r: 5 }, farCoord)).toBe(true);
    expect(isHordeReachableFromGarrison(tweaks, walls, { q: 5, r: 5 }, { q: 5 + extendedDistance + 1, r: 5 })).toBe(false);
  });

  it("gets no bonus from a damaged wall", () => {
    const tweaks = loadRealTweaks();
    const walls = [makeWall({ q: 5, r: 5 }, { damaged: true })];
    expect(isHordeReachableFromGarrison(tweaks, walls, { q: 5, r: 5 }, { q: 7, r: 5 })).toBe(false);
  });
});

describe("garrisonWallRangeBonus", () => {
  it("is 0 with no wall at the coord", () => {
    const tweaks = loadRealTweaks();
    expect(garrisonWallRangeBonus(tweaks, [], { q: 0, r: 0 })).toBe(0);
  });

  it("is tweaks.walls.garrison_range_bonus_tiles when a non-damaged wall sits at the coord", () => {
    const tweaks = loadRealTweaks();
    const walls = [makeWall({ q: 0, r: 0 })];
    expect(garrisonWallRangeBonus(tweaks, walls, { q: 0, r: 0 })).toBe(tweaks.walls.garrison_range_bonus_tiles);
  });

  it("is 0 for a damaged wall", () => {
    const tweaks = loadRealTweaks();
    const walls = [makeWall({ q: 0, r: 0 }, { damaged: true })];
    expect(garrisonWallRangeBonus(tweaks, walls, { q: 0, r: 0 })).toBe(0);
  });
});

describe("resolveCapturedGarrisons", () => {
  it("wipes a garrison sitting on a captured tile and reports units lost per type", () => {
    const garrisons: GarrisonsRecord = [
      makeGarrison({ q: 0, r: 0 }, { militiaCount: 4 }),
      makeGarrison({ q: 1, r: 0 }, { militiaCount: 2, junkyardKnightCount: 1, crossBowSniperCount: 3 }),
    ];
    const result = resolveCapturedGarrisons(garrisons, [{ q: 1, r: 0 }]);
    expect(result.garrisons).toEqual([makeGarrison({ q: 0, r: 0 }, { militiaCount: 4 })]);
    expect(result.militiaLost).toBe(2);
    expect(result.junkyardKnightLost).toBe(1);
    expect(result.crossBowSniperLost).toBe(3);
  });

  it("returns the same array reference and 0 lost when nothing was captured", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { militiaCount: 4 })];
    const result = resolveCapturedGarrisons(garrisons, []);
    expect(result.garrisons).toBe(garrisons);
    expect(result.militiaLost).toBe(0);
    expect(result.junkyardKnightLost).toBe(0);
    expect(result.crossBowSniperLost).toBe(0);
  });

  it("returns the same array reference and 0 lost when no garrison sits on a captured tile", () => {
    const garrisons: GarrisonsRecord = [makeGarrison({ q: 0, r: 0 }, { militiaCount: 4 })];
    const result = resolveCapturedGarrisons(garrisons, [{ q: 9, r: 9 }]);
    expect(result.garrisons).toBe(garrisons);
    expect(result.militiaLost).toBe(0);
  });
});
