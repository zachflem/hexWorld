import type { CourierTrip } from "../data/couriers";
import type { ResourceAmounts, ResourceType } from "../data/resources";
import type { TerritoryRecord } from "../data/territory";
import type { StorageLevels } from "../data/storageLevels";
import type { Tweaks } from "../data/tweaksSchema";
import type { Axial } from "./hexCoords";
import { expeditionTravelDurationMs, findExpeditionRouteFrom } from "./expeditions";
import { storageCapacity } from "./storage";

/** M26: automation unlocks at structure level ≥ 2 (extraction mid/large). */
export function structureHasCourierAutomation(level: number): boolean {
  return level >= 2;
}

/** One-way travel ms from structure → base (null if no owned∪scouted route). */
export function courierOneWayDurationMs(
  tweaks: Tweaks,
  seed: number,
  from: Axial,
  base: Axial,
  territory: TerritoryRecord,
  scoutedTiles: Axial[],
  gridSize: number,
  speedMultiplier = 1,
): number | null {
  const route = findExpeditionRouteFrom(tweaks, seed, from, base, territory, scoutedTiles, gridSize);
  if (!route) return null;
  return expeditionTravelDurationMs(tweaks, route.cost, speedMultiplier);
}

const MAX_COURIER_RESOLUTIONS_PER_TICK = 64;

export interface CourierSiteState {
  stockpile: number;
  courier: CourierTrip | null | undefined;
}

/**
 * Advance an implied courier through `now`: complete arrivals, deposit cargo, return,
 * and start new trips while idle with stockpile. Yield should already be applied.
 */
export function advanceCourierSite(
  tweaks: Tweaks,
  seed: number,
  siteCoord: Axial,
  resource: ResourceType,
  site: CourierSiteState,
  resources: ResourceAmounts,
  storageLevels: StorageLevels,
  now: number,
  baseCoord: Axial,
  territory: TerritoryRecord,
  scoutedTiles: Axial[],
  gridSize: number,
  automationUnlocked: boolean,
): { site: CourierSiteState; resources: ResourceAmounts } {
  if (!automationUnlocked) {
    return { site: { stockpile: site.stockpile, courier: null }, resources };
  }

  let stockpile = site.stockpile;
  let courier = site.courier ?? null;
  let nextResources = { ...resources };
  let resolutions = 0;
  /** Simulation cursor — advances as legs complete so offline catch-up chains trips. */
  let cursor = now;

  const oneWayMs = () =>
    courierOneWayDurationMs(tweaks, seed, siteCoord, baseCoord, territory, scoutedTiles, gridSize);

  const startOutbound = (at: number): boolean => {
    if (stockpile <= 0) return false;
    const duration = oneWayMs();
    if (duration == null || duration <= 0) return false;
    const hubCap = storageCapacity(tweaks, storageLevels[resource]);
    const roomAtHub = Math.max(0, hubCap - nextResources[resource]);
    const cargo = Math.min(stockpile, roomAtHub);
    if (cargo <= 0) return false;
    stockpile -= cargo;
    courier = { phase: "toBase", departedAt: at, arriveAt: at + duration, cargo };
    return true;
  };

  while (resolutions < MAX_COURIER_RESOLUTIONS_PER_TICK) {
    resolutions += 1;

    if (!courier) {
      const startAt = Math.min(cursor, now);
      if (!startOutbound(startAt)) break;
      if (courier!.arriveAt > now) break;
      cursor = courier!.arriveAt;
      continue;
    }

    if (courier.arriveAt > now) break;

    cursor = courier.arriveAt;

    if (courier.phase === "toBase") {
      const hubCap = storageCapacity(tweaks, storageLevels[resource]);
      const roomAtHub = Math.max(0, hubCap - nextResources[resource]);
      const delivered = Math.min(courier.cargo, roomAtHub);
      nextResources = { ...nextResources, [resource]: nextResources[resource] + delivered };
      const leftover = courier.cargo - delivered;
      if (leftover > 0) stockpile += leftover;

      const duration = oneWayMs();
      if (duration == null || duration <= 0) {
        courier = null;
        continue;
      }
      courier = {
        phase: "returning",
        departedAt: cursor,
        arriveAt: cursor + duration,
        cargo: 0,
      };
      continue;
    }

    // Returning complete — idle, then maybe reload at return arrival time.
    courier = null;
  }

  return { site: { stockpile, courier }, resources: nextResources };
}
