import type { ScrapStashRecord, ScrapStashesRecord } from "../data/scrapStashes";
import { isActiveScrapStash } from "../data/scrapStashes";
import type { ScrapYardRecord, ScrapperTrip } from "../data/scrapYards";
import { idleScrapperTrip } from "../data/scrapYards";
import type { TerritoryRecord } from "../data/territory";
import type { Tweaks } from "../data/tweaksSchema";
import { axialDistance, axialKey, type Axial } from "./hexCoords";
import {
  expeditionTravelDurationMs,
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
  const duration = expeditionTravelDurationMs(tweaks, route.cost, speedMultiplier);
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
  yard: ScrapYardRecord,
  stashes: ScrapStashesRecord,
  knownKeys: Set<string>,
): ScrapStashRecord | null {
  let best: ScrapStashRecord | null = null;
  let bestDist = Infinity;
  for (const stash of stashes) {
    if (!isActiveScrapStash(stash)) continue;
    if (!knownKeys.has(axialKey(stash.coord))) continue;
    const d = axialDistance(yard.coord, stash.coord);
    if (d < bestDist) {
      bestDist = d;
      best = stash;
    }
  }
  return best;
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
  territory: TerritoryRecord,
  scoutedTiles: Axial[],
  gridSize: number,
  now: number,
): ScrapYardRecord | null {
  if (!yard.scrapperReady || !isStructureActive(yard)) return null;
  if (!isActiveScrapStash(stash)) return null;

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
    trip.assignedStashId,
    "toYard",
    trip.cargo,
  );
  if (!next) return null;
  return { ...yard, scrapper: next };
}

export type AdvanceScrappersResult = {
  scrapYards: ScrapYardRecord[];
  scrapStashes: ScrapStashesRecord;
  territory: TerritoryRecord;
  scoutedTiles: Axial[];
};

/**
 * Advance in-flight Scrappers: pickup at stash, deliver to yard stockpile,
 * Auto L3+ picks next closest known stash (Q58).
 * L2+ yards with no power / below cutoff freeze mid-route (keep cargo); L1 is
 * power-exempt like other structures.
 */
export function advanceScrappers(
  tweaks: Tweaks,
  seed: number,
  yards: ScrapYardRecord[],
  stashes: ScrapStashesRecord,
  territory: TerritoryRecord,
  scoutedTiles: Axial[],
  gridSize: number,
  now: number,
  powerNetwork: PowerNetworkSnapshot,
): AdvanceScrappersResult {
  let nextStashes = stashes;
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
          { freeClaimUnowned: true, engageHordes: false },
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
        if (stash && isActiveScrapStash(stash)) {
          cargo = Math.min(cap, stash.remainingSteel);
          nextStashes = nextStashes.map((s, i) =>
            i === stashIndex ? { ...s, remainingSteel: s.remainingSteel - cargo } : s,
          );
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
        trip = idleScrapperTrip();

        if (scrapperHasAuto(tweaks, yard.level)) {
          const known = new Set([...nextTerritory.owned, ...nextScouted].map(axialKey));
          const next = closestKnownStash(yard, nextStashes, known);
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
    territory: nextTerritory,
    scoutedTiles: nextScouted,
  };
}
