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
import { findResourceTileConnection, throughputMultiplierForChain, transportRateMultiplier } from "./paths";
import { storageCapacity } from "./storage";
import { totalUpkeepPerSecond } from "./units";
import { yieldPerSecond } from "./tick";
import { dockYieldPerSecond } from "./docks";

/**
 * Live per-resource net rate (units/sec, may be negative) for the HUD's
 * `+84`/`-12` delta chips — mirrors `accrueResources`/`accrueDockResources`
 * (engine/tick.ts, engine/docks.ts) exactly, rather than a naive per-tile
 * yield sum, so the displayed number matches what actually lands in the
 * shared pool: transport-tier and mountain-throughput losses apply, a
 * disconnected tile contributes nothing (only the connected-per-hub search
 * order those functions use decides which hub "claims" a tile), a resource
 * already at storage cap contributes nothing further, and standing-unit food
 * upkeep is subtracted.
 *
 * `transportRateMultiplier` is NOT "delivered rate as a multiple of
 * production" — for a goat track (0.5x) it is, but stone_road (2x) and
 * highway (1000x) instead represent transport *capacity* far exceeding
 * production, so `accrueResources` caps actual transfer at
 * `Math.min(tile.stockpile, transportable, roomAtHub)`. In true steady
 * state a hub can never receive more per second than a tile *produces* per
 * second — transport can only ever be the bottleneck, never a multiplier
 * above 1x — so each tile's contribution is clamped at its own raw yield.
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
): ResourceAmounts {
  const grossInflow: ResourceAmounts = { food: 0, wood: 0, stone: 0, steel: 0, power: 0 };

  const claimed = new Set<string>();
  for (const hubCoord of hubCoords) {
    for (const tile of extractionTiles) {
      if (!isStructureActive(tile)) continue;
      const key = axialKey(tile.coord);
      if (claimed.has(key)) continue;

      const connection = findResourceTileConnection(extractionTiles, pathTiles, hubCoord, tile.coord);
      if (!connection) continue;
      claimed.add(key);

      const rate = yieldPerSecond(tweaks, tile, seed);
      const throughput = throughputMultiplierForChain(tweaks, seed, connection.chain);
      const transportCapacity = rate * transportRateMultiplier(tweaks, connection.tier) * throughput;
      grossInflow[tile.resource] += Math.min(rate, transportCapacity);
    }
  }

  for (const dock of docks) {
    if (dock.buildStartedAt) continue;
    grossInflow.food += dockYieldPerSecond(tweaks, dock);
  }

  const netRates: ResourceAmounts = { food: 0, wood: 0, stone: 0, steel: 0, power: 0 };
  for (const type of Object.keys(grossInflow) as ResourceType[]) {
    const cap = storageCapacity(tweaks, storageLevels[type]);
    netRates[type] = resources[type] >= cap ? 0 : grossInflow[type];
  }

  netRates.food -= totalUpkeepPerSecond(tweaks, units);

  return netRates;
}
