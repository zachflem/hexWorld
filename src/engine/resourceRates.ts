import type { Axial } from "./hexCoords";
import type { ExtractionTile } from "../data/extractionTiles";
import type { PathTile } from "../data/pathTiles";
import type { DockRecord } from "../data/docks";
import type { ResourceAmounts, ResourceType } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";
import type { UnitsRecord } from "../data/units";
import type { Tweaks } from "../data/tweaksSchema";
import { axialKey } from "./hexCoords";
import { isStructureActive } from "./formulas";
import { findResourceTileConnection, PATH_TIER_LEVEL, throughputMultiplierForChain, transportRateMultiplier } from "./paths";
import { storageCapacity } from "./storage";
import { totalUpkeepPerSecond } from "./units";
import { logisticsPathTiles, yieldPerSecond } from "./tick";
import { dockYieldPerSecond } from "./docks";
import { extractionTierLevel } from "./tiers";
import { powerPerformanceFactor, type PowerNetworkSnapshot } from "./power";

function pathPowerMultiplier(
  pathTiles: PathTile[],
  chain: Axial[],
  powerNetwork: PowerNetworkSnapshot,
): number {
  if (chain.length === 0) return 1;
  const byKey = new Map(pathTiles.map((tile) => [axialKey(tile.coord), tile]));
  let min = 1;
  for (const coord of chain) {
    const tile = byKey.get(axialKey(coord));
    if (!tile) continue;
    min = Math.min(min, powerPerformanceFactor(powerNetwork, PATH_TIER_LEVEL[tile.tier], tile.coord));
  }
  return min;
}

/**
 * Live per-resource net rate (units/sec, may be negative) for the HUD's
 * `+84`/`-12` delta chips — mirrors `accrueResources`/`accrueDockResources`.
 */
export function computeResourceRates(
  tweaks: Tweaks,
  extractionTiles: ExtractionTile[],
  pathTiles: PathTile[],
  docks: DockRecord[],
  hubCoords: Axial[],
  resources: ResourceAmounts,
  storageLevels: StorageLevels,
  units: UnitsRecord,
  seed: number,
  powerNetwork: PowerNetworkSnapshot,
): ResourceAmounts {
  const grossInflow: ResourceAmounts = { food: 0, wood: 0, stone: 0, steel: 0 };
  const usablePaths = logisticsPathTiles(pathTiles, powerNetwork);

  const claimed = new Set<string>();
  for (const hubCoord of hubCoords) {
    for (const tile of extractionTiles) {
      if (!isStructureActive(tile)) continue;
      const key = axialKey(tile.coord);
      if (claimed.has(key)) continue;

      const connection = findResourceTileConnection(extractionTiles, usablePaths, hubCoord, tile.coord);
      if (!connection) continue;
      claimed.add(key);

      const powerMul = powerPerformanceFactor(powerNetwork, extractionTierLevel(tile.tier), tile.coord);
      if (powerMul <= 0) continue;

      const rate = yieldPerSecond(tweaks, tile, seed) * powerMul;
      const throughput =
        throughputMultiplierForChain(tweaks, seed, connection.chain) *
        pathPowerMultiplier(pathTiles, connection.chain, powerNetwork);
      const transportCapacity = rate * transportRateMultiplier(tweaks, connection.tier) * throughput;
      grossInflow[tile.resource] += Math.min(rate, transportCapacity);
    }
  }

  for (const dock of docks) {
    if (dock.buildStartedAt != null) continue;
    // Docks are L1-equivalent — always powered if built.
    grossInflow.food += dockYieldPerSecond(tweaks, dock);
  }

  const netRates: ResourceAmounts = { food: 0, wood: 0, stone: 0, steel: 0 };
  for (const type of Object.keys(grossInflow) as ResourceType[]) {
    const cap = storageCapacity(tweaks, storageLevels[type]);
    netRates[type] = resources[type] >= cap ? 0 : grossInflow[type];
  }

  netRates.food -= totalUpkeepPerSecond(tweaks, units);

  return netRates;
}
