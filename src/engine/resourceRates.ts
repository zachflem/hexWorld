import type { Axial } from "./hexCoords";
import type { ExtractionTile } from "../data/extractionTiles";
import type { DockRecord } from "../data/docks";
import type { ResourceAmounts, ResourceType } from "../data/resources";
import type { StorageLevels } from "../data/storageLevels";
import type { TerritoryRecord } from "../data/territory";
import type { UnitsRecord } from "../data/units";
import type { Tweaks } from "../data/tweaksSchema";
import { isStructureActive } from "./formulas";
import { storageCapacity } from "./storage";
import { totalUpkeepPerSecond, type UnitCommitments } from "./units";
import { yieldPerSecond } from "./tick";
import { dockLevel, dockYieldPerSecond } from "./docks";
import { extractionTierLevel } from "./tiers";
import { powerPerformanceFactor, type PowerNetworkSnapshot } from "./power";
import { courierOneWayDurationMs, structureHasCourierAutomation } from "./couriers";

/**
 * Live per-resource net rate (units/sec, may be negative) for the HUD's
 * `+84`/`-12` delta chips — approximates courier delivery as full yield when
 * L2+ automation is unlocked and a route to base exists (instantaneous path
 * drain retired in Milestone 26).
 */
export function computeResourceRates(
  tweaks: Tweaks,
  extractionTiles: ExtractionTile[],
  docks: DockRecord[],
  resources: ResourceAmounts,
  storageLevels: StorageLevels,
  units: UnitsRecord,
  seed: number,
  powerNetwork: PowerNetworkSnapshot,
  baseCoord: Axial,
  territory: TerritoryRecord,
  scoutedTiles: Axial[],
  gridSize: number,
  commitments: UnitCommitments = {
    garrisons: [],
    expeditions: [],
    denAssaults: [],
    garrisonRecalls: [],
    labAssaults: [],
  },
): ResourceAmounts {
  const grossInflow: ResourceAmounts = { food: 0, wood: 0, stone: 0, steel: 0 };

  for (const tile of extractionTiles) {
    if (!isStructureActive(tile)) continue;
    const level = extractionTierLevel(tile.tier);
    if (!structureHasCourierAutomation(level)) continue;
    const powerMul = powerPerformanceFactor(powerNetwork, level, tile.coord);
    if (powerMul <= 0) continue;
    const oneWay = courierOneWayDurationMs(
      tweaks,
      seed,
      tile.coord,
      baseCoord,
      territory,
      scoutedTiles,
      gridSize,
    );
    if (oneWay == null) continue;
    grossInflow[tile.resource] += yieldPerSecond(tweaks, tile, seed) * powerMul;
  }

  for (const dock of docks) {
    if (dock.buildStartedAt != null) continue;
    if (!structureHasCourierAutomation(dockLevel(dock))) continue;
    const oneWay = courierOneWayDurationMs(
      tweaks,
      seed,
      dock.coord,
      baseCoord,
      territory,
      scoutedTiles,
      gridSize,
    );
    if (oneWay == null) continue;
    grossInflow.food += dockYieldPerSecond(tweaks, dock);
  }

  const netRates: ResourceAmounts = { food: 0, wood: 0, stone: 0, steel: 0 };
  for (const type of Object.keys(grossInflow) as ResourceType[]) {
    const cap = storageCapacity(tweaks, storageLevels[type]);
    netRates[type] = resources[type] >= cap ? 0 : grossInflow[type];
  }

  netRates.food -= totalUpkeepPerSecond(tweaks, units, commitments);

  return netRates;
}
