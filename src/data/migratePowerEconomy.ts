import type { ExtractionTile } from "./extractionTiles";
import type { PowerStation } from "./powerStations";
import { stripPowerKeys, type ResourceAmounts } from "./resources";
import type { StorageLevels } from "./storageLevels";

type InvestedLike = { totalInvested?: Partial<Record<string, number>>; buildCost?: Partial<Record<string, number>> };

/**
 * One-shot, idempotent migration from stockpile-power saves:
 * - power extraction tiles → L1 power stations
 * - strip resources.power / storageLevels.power
 * - strip power keys from invested/buildCost maps on remaining structures
 */
type LegacyExtractionTile = Omit<ExtractionTile, "resource"> & { resource: string };

export function migratePowerEconomy(input: {
  resources: unknown;
  storageLevels: unknown;
  extractionTiles: LegacyExtractionTile[] | undefined;
  powerStations: PowerStation[] | undefined;
  towers?: InvestedLike[];
  walls?: InvestedLike[];
  barracksList?: InvestedLike[];
  docks?: InvestedLike[];
}): {
  resources: ResourceAmounts;
  storageLevels: StorageLevels;
  extractionTiles: ExtractionTile[];
  powerStations: PowerStation[];
  towers?: InvestedLike[];
  walls?: InvestedLike[];
  barracksList?: InvestedLike[];
  docks?: InvestedLike[];
} {
  const rawResources = (input.resources ?? {}) as Record<string, number>;
  const resources: ResourceAmounts = {
    food: Number(rawResources.food) || 0,
    wood: Number(rawResources.wood) || 0,
    stone: Number(rawResources.stone) || 0,
    steel: Number(rawResources.steel) || 0,
  };

  const rawStorage = (input.storageLevels ?? {}) as Record<string, number>;
  const storageLevels: StorageLevels = {
    food: Number(rawStorage.food) || 1,
    wood: Number(rawStorage.wood) || 1,
    stone: Number(rawStorage.stone) || 1,
    steel: Number(rawStorage.steel) || 1,
  };

  const existingStations = input.powerStations ?? [];
  const occupiedStationKeys = new Set(existingStations.map((s) => `${s.coord.q},${s.coord.r}`));

  const extractionTiles: ExtractionTile[] = [];
  const convertedStations: PowerStation[] = [];

  for (const tile of input.extractionTiles ?? []) {
    if (tile.resource === "power") {
      const key = `${tile.coord.q},${tile.coord.r}`;
      if (!occupiedStationKeys.has(key)) {
        convertedStations.push({
          coord: tile.coord,
          level: 1,
          totalInvested: stripPowerKeys(tile.totalInvested),
          upgrade: null,
          buildCost: stripPowerKeys(tile.buildCost),
          damaged: tile.damaged,
          damageRepair: tile.damageRepair ?? null,
          buildStartedAt: tile.buildStartedAt ?? null,
        });
        occupiedStationKeys.add(key);
      }
      continue;
    }
    extractionTiles.push({
      ...tile,
      resource: tile.resource as ExtractionTile["resource"],
      totalInvested: stripPowerKeys(tile.totalInvested),
      buildCost: stripPowerKeys(tile.buildCost),
    });
  }

  const stripList = <T extends InvestedLike>(list: T[] | undefined): T[] | undefined =>
    list?.map((item) => ({
      ...item,
      totalInvested: stripPowerKeys(item.totalInvested),
      buildCost: stripPowerKeys(item.buildCost),
    }));

  return {
    resources,
    storageLevels,
    extractionTiles,
    powerStations: [...existingStations, ...convertedStations],
    towers: stripList(input.towers),
    walls: stripList(input.walls),
    barracksList: stripList(input.barracksList),
    docks: stripList(input.docks),
  };
}
