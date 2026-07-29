import type { ScrapStashRecord, ScrapStashesRecord } from "../data/scrapStashes";
import { isActiveScrapStash } from "../data/scrapStashes";
import {
  drainRemainingResource,
  isInfiniteResources,
  remainingResourceAt,
  type HexResourcePoolsRecord,
} from "../data/hexResourcePools";
import type { ScrapYardRecord, ScrapperTrip } from "../data/scrapYards";
import { idleScrapperTrip } from "../data/scrapYards";
import type { TerritoryRecord } from "../data/territory";
import type { Tweaks } from "../data/tweaksSchema";
import { axialDistance, axialEquals, axialKey, type Axial } from "./hexCoords";
import {
  findExpeditionRouteFrom,
  stepCorridorWalk,
} from "./expeditions";
import { isStructureActive } from "./formulas";
import { powerPerformanceFactor, type PowerNetworkSnapshot } from "./power";

export function scrapperCapacity(tweaks: Tweaks, yardLevel: number): number {
  const table = tweaks.scrap_yards.scrapper.capacity_by_level;
  return table[Math.min(yardLevel, table.length - 1)] ?? table[table.length - 1] ?? 8;
}

export function scrapperSpeedMultiplier(tweaks: Tweaks, yardLevel: number): number {
  const table = tweaks.scrap_yards.scrapper.speed_multiplier_by_level;
  return table[Math.min(yardLevel, table.length - 1)] ?? 1;
}

export function scrapperHasAuto(tweaks: Tweaks, yardLevel: number): boolean {
  return yardLevel >= tweaks.scrap_yards.scrapper.auto_next_stash_min_level;
}

/** Scrapper leg duration — uses scrap_yards.scrapper.travel_seconds_per_cost, not expedition pacing. */
export function scrapperTravelDurationMs(
  tweaks: Tweaks,
  pathCost: number,
  speedMultiplier: number,
): number {
  const sec = tweaks.scrap_yards.scrapper.travel_seconds_per_cost;
  return (pathCost * sec * 1000) / Math.max(0.01, speedMultiplier);
}

function startLeg(
  tweaks: Tweaks,
  seed: number,
  from: Axial,
  to: Axial,
  territory: TerritoryRecord,
  scoutedTiles: Axial[],
  gridSize: number,
  now: number,
  speedMultiplier: number,
  assignedStashId: string | null,
  phase: "toStash" | "toYard",
  cargo: number,
): ScrapperTrip | null {
  const route = findExpeditionRouteFrom(tweaks, seed, from, to, territory, scoutedTiles, gridSize);
  if (!route || route.path.length < 2) return null;
  const duration = scrapperTravelDurationMs(tweaks, route.cost, speedMultiplier);
  if (duration <= 0) return null;
  return {
    assignedStashId,
    phase,
    path: route.path,
    departedAt: now,
    arriveAt: now + duration,
    resolvedIndex: 0,
    cargo,
  };
}

/** Current hex for map drawing — mirrors expedition marker indexing. */
export function scrapperPathIndexAt(trip: ScrapperTrip, now: number): number {
  if (trip.path.length === 0 || trip.phase === "idle") return 0;
  const span = Math.max(1, trip.arriveAt - trip.departedAt);
  const t = Math.min(1, Math.max(0, (now - trip.departedAt) / span));
  return Math.min(trip.path.length - 1, Math.floor(t * (trip.path.length - 1)));
}

export function scrapperWorldCoord(yard: ScrapYardRecord, now: number): Axial {
  const trip = yard.scrapper;
  if (!trip || trip.phase === "idle" || trip.path.length === 0) return yard.coord;
  return trip.path[scrapperPathIndexAt(trip, now)] ?? yard.coord;
}

function closestKnownStash(
  tweaks: Tweaks,
  seed: number,
  store: HexResourcePoolsRecord,
  yard: ScrapYardRecord,
  stashes: ScrapStashesRecord,
  knownKeys: Set<string>,
): ScrapStashRecord | null {
  let best: ScrapStashRecord | null = null;
  let bestDist = Infinity;
  for (const stash of stashes) {
    if (!isActiveScrapStash(tweaks, seed, store, stash) || !knownKeys.has(axialKey(stash.coord))) continue;
    const dist = axialDistance(yard.coord, stash.coord);
    if (dist < bestDist) {
      bestDist = dist;
      best = stash;
    }
  }
  return best;
}

/**
 * Estimated steel inflow into the yard stockpile (units/sec) from Scrapper
 * hauling — capacity ÷ round-trip travel to the assigned or nearest known
 * active stash. Mirrors extraction `yieldPerSecond` for tooltips / Info.
 * Returns 0 when idle with no reachable stash, offline, or Scrapper not ready.
 */
export function scrapYardYieldPerSecond(
  tweaks: Tweaks,
  seed: number,
  yard: ScrapYardRecord,
  stashes: ScrapStashesRecord,
  hexResourcePoolsOrTerritory: HexResourcePoolsRecord | TerritoryRecord,
  territoryOrScouted: TerritoryRecord | Axial[],
  scoutedTilesOrGrid: Axial[] | number,
  gridSizeOrPower: number | PowerNetworkSnapshot | undefined,
  powerNetworkMaybe?: PowerNetworkSnapshot,
): number {
  const usingLegacyArgs = Array.isArray(territoryOrScouted);
  const hexResourcePools: HexResourcePoolsRecord = usingLegacyArgs ? {} : (hexResourcePoolsOrTerritory as HexResourcePoolsRecord);
  const territory: TerritoryRecord = usingLegacyArgs
    ? (hexResourcePoolsOrTerritory as TerritoryRecord)
    : (territoryOrScouted as TerritoryRecord);
  const scoutedTiles: Axial[] = usingLegacyArgs
    ? (territoryOrScouted as Axial[])
    : (scoutedTilesOrGrid as Axial[]);
  const gridSize = usingLegacyArgs ? (scoutedTilesOrGrid as number) : (gridSizeOrPower as number);
  const powerNetwork = usingLegacyArgs ? (gridSizeOrPower as PowerNetworkSnapshot | undefined) : powerNetworkMaybe;
  if (!yard.scrapperReady || !isStructureActive(yard)) return 0;
  if (powerNetwork && powerPerformanceFactor(powerNetwork, yard.level, yard.coord) <= 0) {
    return 0;
  }

  const known = new Set([...territory.owned, ...scoutedTiles].map(axialKey));
  const trip = yard.scrapper;
  let stash: ScrapStashRecord | null = null;
  if (trip?.assignedStashId) {
    stash =
      stashes.find(
        (s) => s.id === trip.assignedStashId && isActiveScrapStash(tweaks, seed, hexResourcePools, s),
      ) ?? null;
  }
  if (!stash) stash = closestKnownStash(tweaks, seed, hexResourcePools, yard, stashes, known);
  if (!stash) return 0;

  const route = findExpeditionRouteFrom(
    tweaks,
    seed,
    yard.coord,
    stash.coord,
    territory,
    scoutedTiles,
    gridSize,
  );
  if (!route || route.path.length < 2) return 0;

  const speed = scrapperSpeedMultiplier(tweaks, yard.level);
  const oneWayMs = scrapperTravelDurationMs(tweaks, route.cost, speed);
  const roundTripSec = (2 * oneWayMs) / 1000;
  if (roundTripSec <= 0) return 0;

  const remaining = remainingResourceAt(seed, stash.coord, hexResourcePools, tweaks);
  if (!isInfiniteResources(tweaks) && remaining <= 0) return 0;
  const cargo = Math.min(
    scrapperCapacity(tweaks, yard.level),
    isInfiniteResources(tweaks) ? scrapperCapacity(tweaks, yard.level) : remaining,
  );
  return cargo / roundTripSec;
}

/**
 * Player assigns a known stash — starts outbound haul if Scrapper is idle
 * at the yard, or redirects empty mid-route (Q39).
 */
export function assignScrapperStash(
  tweaks: Tweaks,
  seed: number,
  yard: ScrapYardRecord,
  stash: ScrapStashRecord,
  hexResourcePoolsOrTerritory: HexResourcePoolsRecord | TerritoryRecord,
  territoryOrScouted: TerritoryRecord | Axial[],
  scoutedTilesOrGrid: Axial[] | number,
  gridSizeOrNow: number,
  nowOrUndefined?: number,
): ScrapYardRecord | null {
  const usingLegacyArgs = Array.isArray(territoryOrScouted);
  const hexResourcePools: HexResourcePoolsRecord = usingLegacyArgs ? {} : (hexResourcePoolsOrTerritory as HexResourcePoolsRecord);
  const territory: TerritoryRecord = usingLegacyArgs
    ? (hexResourcePoolsOrTerritory as TerritoryRecord)
    : (territoryOrScouted as TerritoryRecord);
  const scoutedTiles: Axial[] = usingLegacyArgs
    ? (territoryOrScouted as Axial[])
    : (scoutedTilesOrGrid as Axial[]);
  const gridSize = usingLegacyArgs ? (scoutedTilesOrGrid as number) : gridSizeOrNow;
  const now = usingLegacyArgs ? gridSizeOrNow : (nowOrUndefined ?? gridSizeOrNow);

  if (!yard.scrapperReady || !isStructureActive(yard)) return null;
  if (!isActiveScrapStash(tweaks, seed, hexResourcePools, stash)) return null;

  const known = new Set([...territory.owned, ...scoutedTiles].map(axialKey));
  if (!known.has(axialKey(stash.coord))) return null;

  const speed = scrapperSpeedMultiplier(tweaks, yard.level);
  const trip = yard.scrapper ?? idleScrapperTrip();

  // Loaded return: finish to yard first (Q37/Q38).
  if (trip.phase === "toYard" && trip.cargo > 0) return null;

  const from =
    trip.phase === "toStash" && trip.path.length > 0
      ? (trip.path[scrapperPathIndexAt(trip, now)] ?? yard.coord)
      : yard.coord;

  const next = startLeg(
    tweaks,
    seed,
    from,
    stash.coord,
    territory,
    scoutedTiles,
    gridSize,
    now,
    speed,
    stash.id,
    "toStash",
    0,
  );
  if (!next) return null;
  return { ...yard, scrapper: next };
}

/**
 * Pull the Scrapper home and clear its stash assignment (Q47) — on arrival it
 * idles at the yard instead of auto-looping the old stash. Cargo is kept (Q38).
 * If the Scrapper is still on the yard hex (just assigned / not yet moved),
 * clear the assignment and idle immediately — startLeg cannot path yard→yard.
 */
export function recallScrapperToYard(
  tweaks: Tweaks,
  seed: number,
  yard: ScrapYardRecord,
  territory: TerritoryRecord,
  scoutedTiles: Axial[],
  gridSize: number,
  now: number,
): ScrapYardRecord | null {
  if (!yard.scrapperReady || !yard.scrapper) return null;
  const trip = yard.scrapper;
  if (trip.phase === "idle") return null;

  const from =
    trip.path.length > 0 ? (trip.path[scrapperPathIndexAt(trip, now)] ?? yard.coord) : yard.coord;

  // Already home — no return leg needed; drop the stash job and park.
  if (axialEquals(from, yard.coord)) {
    return {
      ...yard,
      scrapper: {
        ...idleScrapperTrip(),
        cargo: trip.cargo,
      },
    };
  }

  const speed = scrapperSpeedMultiplier(tweaks, yard.level);
  const next = startLeg(
    tweaks,
    seed,
    from,
    yard.coord,
    territory,
    scoutedTiles,
    gridSize,
    now,
    speed,
    null,
    "toYard",
    trip.cargo,
  );
  if (!next) return null;
  return { ...yard, scrapper: next };
}

export type AdvanceScrappersResult = {
  scrapYards: ScrapYardRecord[];
  scrapStashes: ScrapStashesRecord;
  hexResourcePools: HexResourcePoolsRecord;
  territory: TerritoryRecord;
  scoutedTiles: Axial[];
};

export type AdvanceScrappersOptions = {
  /** Dens + unsecured lab — never free-claim these hexes on loaded return. */
  unclaimableKeys?: ReadonlySet<string>;
};

/**
 * Advance in-flight Scrappers: pickup at stash, deliver to yard stockpile,
 * then loop the same stash until empty (Q8). Auto L3+ picks the next closest
 * known stash only after the assigned one is depleted (Q58).
 * L2+ yards with no power / below cutoff freeze mid-route (keep cargo); L1 is
 * power-exempt like other structures.
 * Pickup drains shared hex remainingResource (Milestone 27).
 */
export function advanceScrappers(
  tweaks: Tweaks,
  seed: number,
  yards: ScrapYardRecord[],
  stashes: ScrapStashesRecord,
  hexResourcePoolsOrTerritory: HexResourcePoolsRecord | TerritoryRecord,
  territoryOrScouted: TerritoryRecord | Axial[],
  scoutedTilesOrGrid: Axial[] | number,
  gridSizeOrNow: number,
  nowOrPower: number | PowerNetworkSnapshot,
  powerNetworkMaybe?: PowerNetworkSnapshot,
  options?: AdvanceScrappersOptions,
): AdvanceScrappersResult {
  const usingLegacyArgs = Array.isArray(territoryOrScouted);
  const hexResourcePools: HexResourcePoolsRecord = usingLegacyArgs ? {} : (hexResourcePoolsOrTerritory as HexResourcePoolsRecord);
  const territory: TerritoryRecord = usingLegacyArgs
    ? (hexResourcePoolsOrTerritory as TerritoryRecord)
    : (territoryOrScouted as TerritoryRecord);
  const scoutedTiles: Axial[] = usingLegacyArgs
    ? (territoryOrScouted as Axial[])
    : (scoutedTilesOrGrid as Axial[]);
  const gridSize = usingLegacyArgs ? (scoutedTilesOrGrid as number) : gridSizeOrNow;
  const now = usingLegacyArgs ? (gridSizeOrNow as number) : (nowOrPower as number);
  const powerNetwork = usingLegacyArgs ? (nowOrPower as PowerNetworkSnapshot) : (powerNetworkMaybe as PowerNetworkSnapshot);
  let nextStashes = stashes;
  let nextPools = hexResourcePools;
  let nextTerritory = territory;
  let nextScouted = scoutedTiles;

  const nextYards = yards.map((yard) => {
    if (!yard.scrapperReady || !isStructureActive(yard)) return yard;
    if (powerPerformanceFactor(powerNetwork, yard.level, yard.coord) <= 0) return yard;

    let trip = yard.scrapper ?? idleScrapperTrip();
    let stockpile = yard.stockpile;
    const speed = scrapperSpeedMultiplier(tweaks, yard.level);
    const cap = scrapperCapacity(tweaks, yard.level);
    const tileCap = tweaks.storage.capacity_base_per_resource;

    // Loaded return: free-claim scouted hexes as the Scrapper walks (Q28–Q30).
    if (trip.phase === "toYard" && trip.path.length > 1 && trip.cargo > 0) {
      const targetIndex = scrapperPathIndexAt(trip, now);
      if (targetIndex > trip.resolvedIndex) {
        const walk = stepCorridorWalk(
          tweaks,
          trip.path,
          trip.resolvedIndex,
          targetIndex,
          nextTerritory.owned,
          nextTerritory.base,
          Number.MAX_SAFE_INTEGER,
          new Map(),
          { freeClaimUnowned: true, engageHordes: false, unclaimableKeys: options?.unclaimableKeys },
        );
        trip = { ...trip, resolvedIndex: walk.resolvedIndex };
        if (walk.claimedTiles.length > 0) {
          nextTerritory = {
            ...nextTerritory,
            owned: [...nextTerritory.owned, ...walk.claimedTiles],
          };
          const scoutedKeys = new Set(nextScouted.map(axialKey));
          for (const tile of walk.claimedTiles) {
            if (!scoutedKeys.has(axialKey(tile))) nextScouted = [...nextScouted, tile];
          }
        }
      }
    }

    if (trip.phase !== "idle" && now >= trip.arriveAt && trip.path.length > 0) {
      if (trip.phase === "toStash") {
        const stashIndex = nextStashes.findIndex((s) => s.id === trip.assignedStashId);
        const stash = stashIndex >= 0 ? nextStashes[stashIndex]! : null;
        let cargo = 0;
        if (stash && isActiveScrapStash(tweaks, seed, nextPools, stash)) {
          const drained = drainRemainingResource(seed, stash.coord, nextPools, tweaks, cap);
          nextPools = drained.store;
          cargo = drained.taken;
        }
        const fromCoord = stash?.coord ?? trip.path[trip.path.length - 1]!;
        const returnLeg = startLeg(
          tweaks,
          seed,
          fromCoord,
          yard.coord,
          nextTerritory,
          nextScouted,
          gridSize,
          now,
          speed,
          trip.assignedStashId,
          "toYard",
          cargo,
        );
        trip = returnLeg ?? idleScrapperTrip();
      } else if (trip.phase === "toYard") {
        stockpile = Math.min(tileCap, stockpile + trip.cargo);
        const finishedStashId = trip.assignedStashId;
        trip = idleScrapperTrip();

        // Loop the same assigned stash until empty (Q8). Auto L3+ only kicks in
        // after that stash is gone — then pick the next closest known stash (Q58).
        const sameStash =
          finishedStashId != null
            ? nextStashes.find(
                (s) => s.id === finishedStashId && isActiveScrapStash(tweaks, seed, nextPools, s),
              )
            : null;
        if (sameStash) {
          const again = startLeg(
            tweaks,
            seed,
            yard.coord,
            sameStash.coord,
            nextTerritory,
            nextScouted,
            gridSize,
            now,
            speed,
            sameStash.id,
            "toStash",
            0,
          );
          if (again) trip = again;
        } else if (scrapperHasAuto(tweaks, yard.level)) {
          const known = new Set([...nextTerritory.owned, ...nextScouted].map(axialKey));
          const next = closestKnownStash(tweaks, seed, nextPools, yard, nextStashes, known);
          if (next) {
            const auto = startLeg(
              tweaks,
              seed,
              yard.coord,
              next.coord,
              nextTerritory,
              nextScouted,
              gridSize,
              now,
              speed,
              next.id,
              "toStash",
              0,
            );
            if (auto) trip = auto;
          }
        }
      }
    }

    return { ...yard, stockpile, scrapper: trip };
  });

  return {
    scrapYards: nextYards,
    scrapStashes: nextStashes,
    hexResourcePools: nextPools,
    territory: nextTerritory,
    scoutedTiles: nextScouted,
  };
}
