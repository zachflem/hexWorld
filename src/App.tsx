import { useCallback, useEffect, useRef, useState } from "react";
import { loadTweaks } from "./data/tweaksLoader";
import type { Tweaks } from "./data/tweaksSchema";
import { PLAYER_DB_KEY, type Player } from "./data/player";
import { WORLD_DB_KEY, generateSeed, type WorldRecord } from "./data/world";
import { TERRITORY_DB_KEY, createStartingTerritory, type TerritoryRecord } from "./data/territory";
import { BASE_DB_KEY, initialBase, type BaseRecord } from "./data/base";
import { RESOURCES_DB_KEY, initialResourceAmounts, type ResourceAmounts } from "./data/resources";
import { CLOCK_DB_KEY, type ClockRecord } from "./data/clock";
import { EXTRACTION_TILES_DB_KEY, type ExtractionTile } from "./data/extractionTiles";
import { PATH_TILES_DB_KEY, type PathTile } from "./data/pathTiles";
import {
  STORAGE_LEVELS_DB_KEY,
  initialStorageLevels,
  type StorageLevels,
} from "./data/storageLevels";
import {
  STORAGE_UPGRADES_DB_KEY,
  initialStorageUpgrades,
  type StorageUpgradesRecord,
} from "./data/storageUpgrades";
import { NOISE_DB_KEY, initialNoise, type NoiseRecord } from "./data/noise";
import { TOWERS_DB_KEY, type Tower } from "./data/towers";
import { WALLS_DB_KEY, type Wall } from "./data/walls";
import { BARRACKS_DB_KEY, type Barracks } from "./data/barracks";
import { UNITS_DB_KEY, initialUnits, type UnitsRecord } from "./data/units";
import { GARRISONS_DB_KEY, type GarrisonsRecord } from "./data/garrisons";
import { SCOUTED_TILES_DB_KEY, type ScoutedTiles } from "./data/scoutedTiles";
import { DENS_DB_KEY, createDens, resolveDen, type DenRecord, type DensRecord } from "./data/dens";
import { DEN_ASSAULTS_DB_KEY, type DenAssaultRecord, type DenAssaultsRecord } from "./data/denAssaults";
import { LAB_DB_KEY, createLab, type LabRecord } from "./data/lab";
import { LAB_ASSAULTS_DB_KEY, type LabAssaultRecord, type LabAssaultsRecord } from "./data/labAssaults";
import { GARRISON_RECALLS_DB_KEY, type GarrisonRecallRecord, type GarrisonRecallsRecord } from "./data/garrisonRecalls";
import { OUTPOSTS_DB_KEY, createOutpostFromDen, type OutpostRecord, type OutpostsRecord } from "./data/outposts";
import { HORDES_DB_KEY, type HordesRecord } from "./data/hordes";
import { DOCKS_DB_KEY, type DocksRecord } from "./data/docks";
import { SCOUT_SKIFFS_DB_KEY, type ScoutSkiffsRecord } from "./data/scoutSkiffs";
import { WANDERING_SCOUTS_DB_KEY, type WanderingScoutsRecord } from "./data/wanderingScouts";
import { EXPEDITIONS_DB_KEY, type Expedition, type ExpeditionsRecord } from "./data/expeditions";
import { TOMBSTONES_DB_KEY, type TombstoneRecord, type TombstonesRecord } from "./data/tombstones";
import { GAME_STATUS_DB_KEY, initialGameStatus, type GameStatusRecord } from "./data/gameStatus";
import { RESEARCH_DB_KEY, initialResearch, type ResearchId, type ResearchRecord } from "./data/research";
import type { ResourceType } from "./data/resources";
import { get, set } from "./persistence/db";
import { axialDistance, axialKey, axialSpiral, isWithinMapBounds, type Axial } from "./engine/hexCoords";
import { accrueResources, collectTile } from "./engine/tick";
import {
  addToInvestment,
  buildSlotCap,
  demolishRefund,
  repairCost,
  scaledCostMap,
  structureRepairDurationMs,
  totalStructureCount,
} from "./engine/formulas";
import {
  baseReinforcementHp,
  baseReinforcementRepairDurationMs,
  baseReinforcementUpgradeDurationMs,
  baseRelocationCost,
  baseRepairCost,
  baseUpgradeCost,
  canRelocateBase,
  isBaseRelocationComplete,
  isBaseUpgradeComplete,
  maxReinforcementLevel,
  reinforcementUpgradeCost,
} from "./engine/base";
import { autoClaimTowerRange, isTileScoutable } from "./engine/territory";
import {
  expeditionPathIndexAt,
  expeditionProvisionsCost,
  expeditionTravelDurationMs,
  findBestExpeditionRoute,
  partyAttackPower,
  recallDurationMs,
  stepCorridorWalk,
  type TombstoneCause,
} from "./engine/expeditions";
import { extractionTileBuildDurationMs, nextTier, tierUpgradeCost, tierUpgradeDurationMs } from "./engine/tiers";
import { storageCapacity, storageUpgradeCost, storageUpgradeDurationMs } from "./engine/storage";
import { isResearchAvailable, researchCost, researchDurationMs, troopSpeedMultiplier, unlockedSpeedRates } from "./engine/research";
import { nextPathTier, pathBuildCost, pathBuildDurationMs, pathUpgradeCost, pathUpgradeDurationMs } from "./engine/paths";
import { isBuildableLand, isTransitionTile, terrainAt } from "./engine/terrain";
import { accrueNoise, addActionNoise } from "./engine/noiseMeter";
import {
  advanceHordes,
  checkHordeSpawns,
  markCapturedStructuresDamaged,
  resolveGarrisonAutoAttacks,
  type HordeHub,
} from "./engine/hordes";
import {
  availableCrossBowSnipers,
  availableJunkyardKnights,
  availableMilitia,
  garrisonAt,
  garrisonDefense,
  resolveCapturedGarrisons,
} from "./engine/garrisons";
import { isTimerComplete } from "./engine/timers";
import { denAssaultSurvivors, denDefense, holdDefenseAt, resolveDenAssault, resolveHoldPeriod } from "./engine/dens";
import { labClueText, resolveLabAssault, rollScoutClue } from "./engine/lab";
import {
  maxOutpostReinforcementLevel,
  outpostReinforcementHp,
  outpostReinforcementRepairDurationMs,
  outpostReinforcementUpgradeCost,
  outpostReinforcementUpgradeDurationMs,
  outpostRepairCost,
  revertOutpostToDen,
} from "./engine/outposts";
import { accrueDockResources, collectDock, dockBuildCost, dockBuildDurationMs } from "./engine/docks";
import { advanceScoutSkiffs } from "./engine/scoutSkiffs";
import { advanceWanderingScouts } from "./engine/wanderingScouts";
import { nextTowerLevel, towerBuildCost, towerBuildDurationMs, towerUpgradeCost, towerUpgradeDurationMs } from "./engine/towers";
import {
  maxWallDurability,
  nextWallTier,
  wallBuildCost,
  wallBuildDurationMs,
  wallRepairCost,
  wallRepairDurationMs,
  wallUpgradeCost,
  wallUpgradeDurationMs,
} from "./engine/walls";
import {
  barracksBuildCost,
  barracksBuildDurationMs,
  barracksTrainingCapacity,
  barracksUpgradeCost,
  barracksUpgradeDurationMs,
  crossBowSniperCapacity,
  junkyardKnightCapacity,
  militiaCapacity,
  nextBarracksLevel,
  scoutCapacity,
} from "./engine/barracks";
import {
  applyUpkeepTick,
  crossBowSniperTrainCost,
  crossBowSniperTrainDurationMs,
  junkyardKnightTrainCost,
  junkyardKnightTrainDurationMs,
  militiaTrainCost,
  militiaTrainDurationMs,
  resolveTrainingQueue,
  scoutTrainCost,
  scoutTrainDurationMs,
} from "./engine/units";
import { GameScreen } from "./ui/GameScreen";
import type { ToastRecord } from "./ui/hud/Toast";
import { GameOverScreen } from "./ui/GameOverScreen";
import { WinScreen } from "./ui/WinScreen";
import { OnboardingScreen } from "./ui/OnboardingScreen";
import "./App.css";

interface GameState {
  player: Player;
  world: WorldRecord;
  territory: TerritoryRecord;
  base: BaseRecord;
  resources: ResourceAmounts;
  clock: ClockRecord;
  extractionTiles: ExtractionTile[];
  pathTiles: PathTile[];
  towers: Tower[];
  walls: Wall[];
  barracksList: Barracks[];
  units: UnitsRecord;
  garrisons: GarrisonsRecord;
  scoutedTiles: ScoutedTiles;
  storageLevels: StorageLevels;
  storageUpgrades: StorageUpgradesRecord;
  noise: NoiseRecord;
  dens: DensRecord;
  hordes: HordesRecord;
  expeditions: ExpeditionsRecord;
  gameStatus: GameStatusRecord;
  docks: DocksRecord;
  scoutSkiffs: ScoutSkiffsRecord;
  wanderingScouts: WanderingScoutsRecord;
  denAssaults: DenAssaultsRecord;
  outposts: OutpostsRecord;
  garrisonRecalls: GarrisonRecallsRecord;
  lab: LabRecord;
  labAssaults: LabAssaultsRecord;
  research: ResearchRecord;
  tombstones: TombstonesRecord;
}

/**
 * Spreads over initialBase() defaults, not just `?? initialBase(tweaks)` — an
 * existing save from before reinforcementLevel/currentHp existed would
 * otherwise load with those fields undefined. currentHp gets special
 * handling: a pre-currentHp save defaults to a FULL-HP pool for whatever
 * reinforcementLevel it had already invested in, not the fresh-base
 * baseline, so an old high-reinforcement save doesn't load looking damaged.
 */
function resolveBase(tweaks: Tweaks, base: BaseRecord | undefined): BaseRecord {
  const resolved = { ...initialBase(tweaks), ...base };
  if (!base || base.currentHp === undefined) {
    resolved.currentHp = baseReinforcementHp(tweaks, resolved.reinforcementLevel);
  }
  return resolved;
}

/**
 * Applies a completed reinforcement upgrade or repair — same virtual-clock-
 * threshold pattern as the wall action block in runTick, but for the base's
 * single reinforcementAction slot. An upgrade both raises reinforcementLevel
 * and fully restores HP to the new max (an upgrade doubles as a full
 * repair, so damage never has to be dealt with twice); a repair just
 * restores HP to the (unchanged) current max.
 */
function resolveBaseReinforcementAction(tweaks: Tweaks, base: BaseRecord, virtualNow: number): BaseRecord {
  const action = base.reinforcementAction;
  if (!action) return base;
  if (action.kind === "upgrade") {
    const durationMs = baseReinforcementUpgradeDurationMs(tweaks, action.targetLevel);
    if (!isTimerComplete(action.startedAt, durationMs, virtualNow)) return base;
    return {
      ...base,
      reinforcementLevel: action.targetLevel,
      currentHp: baseReinforcementHp(tweaks, action.targetLevel),
      reinforcementAction: null,
    };
  }
  const maxHp = baseReinforcementHp(tweaks, base.reinforcementLevel);
  const durationMs = baseReinforcementRepairDurationMs(tweaks, base.currentHp, maxHp);
  if (!isTimerComplete(action.startedAt, durationMs, virtualNow)) return base;
  return { ...base, currentHp: maxHp, reinforcementAction: null };
}

/** Outpost equivalent of resolveBaseReinforcementAction. */
function resolveOutpostReinforcementAction(tweaks: Tweaks, outpost: OutpostRecord, virtualNow: number): OutpostRecord {
  const action = outpost.reinforcementAction;
  if (!action) return outpost;
  if (action.kind === "upgrade") {
    const durationMs = outpostReinforcementUpgradeDurationMs(tweaks, action.targetLevel);
    if (!isTimerComplete(action.startedAt, durationMs, virtualNow)) return outpost;
    return {
      ...outpost,
      reinforcementLevel: action.targetLevel,
      currentHp: outpostReinforcementHp(tweaks, action.targetLevel),
      reinforcementAction: null,
    };
  }
  const maxHp = outpostReinforcementHp(tweaks, outpost.reinforcementLevel);
  const durationMs = outpostReinforcementRepairDurationMs(tweaks, outpost.currentHp, maxHp);
  if (!isTimerComplete(action.startedAt, durationMs, virtualNow)) return outpost;
  return { ...outpost, currentHp: maxHp, reinforcementAction: null };
}

/**
 * Clears `damaged` once a structure's damage-repair timer completes —
 * shared by all 5 structure kinds (extraction tile, path, tower, wall,
 * barracks), which each have their own damaged/damageRepair pair
 * (engine/formulas.ts:structureRepairDurationMs).
 */
function resolveDamageRepair<T extends { damaged: boolean; damageRepair?: { startedAt: number } | null }>(
  structure: T,
  tweaks: Tweaks,
  virtualNow: number,
): T {
  if (!structure.damageRepair) return structure;
  if (!isTimerComplete(structure.damageRepair.startedAt, structureRepairDurationMs(tweaks), virtualNow)) return structure;
  return { ...structure, damaged: false, damageRepair: null };
}

/**
 * Clears `buildStartedAt` once a structure's construction timer completes —
 * shared by all 5 structure kinds (extraction tile, path, tower, wall,
 * barracks), each of which pays its own flat build_time_minutes duration
 * (engine/tiers.ts, engine/paths.ts, engine/towers.ts, engine/walls.ts,
 * engine/barracks.ts) — passed in already-resolved since it's a flat
 * per-kind value, not derived from the structure itself the way
 * resolveDamageRepair's duration is.
 */
function resolveConstruction<T extends { buildStartedAt?: number | null }>(
  structure: T,
  durationMs: number,
  virtualNow: number,
): T {
  if (!structure.buildStartedAt) return structure;
  if (!isTimerComplete(structure.buildStartedAt, durationMs, virtualNow)) return structure;
  return { ...structure, buildStartedAt: null };
}

/** Every owned tile can hold at most one structure of any kind (extraction, path, tower, wall, barracks, or dock). */
function isHexOccupied(game: GameState, coord: Axial): boolean {
  const key = axialKey(coord);
  return (
    game.extractionTiles.some((t) => axialKey(t.coord) === key) ||
    game.pathTiles.some((t) => axialKey(t.coord) === key) ||
    game.towers.some((t) => axialKey(t.coord) === key) ||
    game.walls.some((t) => axialKey(t.coord) === key) ||
    game.barracksList.some((t) => axialKey(t.coord) === key) ||
    game.docks.some((t) => axialKey(t.coord) === key)
  );
}

type BootState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; tweaks: Tweaks; game: GameState | undefined };

export type BuildResult = { ok: true } | { ok: false; reason: string };

/**
 * Playtesting convenience — scales elapsedSeconds for the tick-driven
 * simulation (resource accrual, upkeep, noise, horde spawn/advance) AND, via
 * clock.virtualNow (runTick below), every build/upgrade/training timer too,
 * since those are now anchored to the virtual clock instead of raw
 * Date.now(). The fast-forward button cycles through these rates rather than
 * a plain on/off toggle. 1x is always free; 3x/5x are unlocked by the
 * game_speed research line (engine/research.ts:unlockedSpeedRates) rather
 * than being fixed. The 10x "testing" tier only exists in dev builds
 * (import.meta.env.DEV) — absent from the cycle entirely in production, and
 * unaffected by research either way.
 */
function speedMultiplierRates(tweaks: Tweaks, research: ResearchRecord): number[] {
  return [...unlockedSpeedRates(tweaks, research), ...(import.meta.env.DEV ? [10] : [])];
}

export default function App() {
  const [boot, setBoot] = useState<BootState>({ status: "loading" });
  const bootRef = useRef(boot);
  useEffect(() => {
    bootRef.current = boot;
  }, [boot]);

  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const speedMultiplierRef = useRef(speedMultiplier);
  useEffect(() => {
    speedMultiplierRef.current = speedMultiplier;
  }, [speedMultiplier]);

  /**
   * Ephemeral one-off event toasts (lab clue landed, den cleared, base
   * upgrade completed) — distinct from the ambient countdown rows in
   * NotificationTray. Lives here (not in GameScreen) because the state
   * transitions that trigger a toast are detected inside runTick's
   * before/after diffing, not inside GameScreen.
   */
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const toastSeqRef = useRef(0);
  const pushToast = useCallback((toast: Omit<ToastRecord, "id">) => {
    setToasts((prev) => [...prev, { ...toast, id: `toast-${Date.now()}-${toastSeqRef.current++}` }]);
  }, []);
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [
          tweaks,
          player,
          world,
          territory,
          base,
          resources,
          clock,
          extractionTiles,
          pathTiles,
          towers,
          walls,
          barracksList,
          units,
          garrisons,
          scoutedTiles,
          storageLevels,
          storageUpgrades,
          noise,
          dens,
          hordes,
          expeditions,
          gameStatus,
          docks,
          scoutSkiffs,
          wanderingScouts,
          denAssaults,
          outposts,
          garrisonRecalls,
          lab,
          labAssaults,
          research,
          tombstones,
        ] = await Promise.all([
          loadTweaks(),
          get<Player>(PLAYER_DB_KEY),
          get<WorldRecord>(WORLD_DB_KEY),
          get<TerritoryRecord>(TERRITORY_DB_KEY),
          get<BaseRecord>(BASE_DB_KEY),
          get<ResourceAmounts>(RESOURCES_DB_KEY),
          get<ClockRecord>(CLOCK_DB_KEY),
          get<ExtractionTile[]>(EXTRACTION_TILES_DB_KEY),
          get<PathTile[]>(PATH_TILES_DB_KEY),
          get<Tower[]>(TOWERS_DB_KEY),
          get<Wall[]>(WALLS_DB_KEY),
          get<Barracks[]>(BARRACKS_DB_KEY),
          get<UnitsRecord>(UNITS_DB_KEY),
          get<GarrisonsRecord>(GARRISONS_DB_KEY),
          get<ScoutedTiles>(SCOUTED_TILES_DB_KEY),
          get<StorageLevels>(STORAGE_LEVELS_DB_KEY),
          get<StorageUpgradesRecord>(STORAGE_UPGRADES_DB_KEY),
          get<NoiseRecord>(NOISE_DB_KEY),
          get<DensRecord>(DENS_DB_KEY),
          get<HordesRecord>(HORDES_DB_KEY),
          get<ExpeditionsRecord>(EXPEDITIONS_DB_KEY),
          get<GameStatusRecord>(GAME_STATUS_DB_KEY),
          get<DocksRecord>(DOCKS_DB_KEY),
          get<ScoutSkiffsRecord>(SCOUT_SKIFFS_DB_KEY),
          get<WanderingScoutsRecord>(WANDERING_SCOUTS_DB_KEY),
          get<DenAssaultsRecord>(DEN_ASSAULTS_DB_KEY),
          get<OutpostsRecord>(OUTPOSTS_DB_KEY),
          get<GarrisonRecallsRecord>(GARRISON_RECALLS_DB_KEY),
          get<LabRecord>(LAB_DB_KEY),
          get<LabAssaultsRecord>(LAB_ASSAULTS_DB_KEY),
          get<ResearchRecord>(RESEARCH_DB_KEY),
          get<TombstonesRecord>(TOMBSTONES_DB_KEY),
        ]);
        const resolvedDens = (dens ?? []).map(resolveDen);
        const game =
          player && world && territory && resources && clock && storageLevels
            ? {
                player,
                world,
                territory,
                base: resolveBase(tweaks, base),
                resources,
                // Older saves predate virtualNow — default it to lastTickAt so
                // timers pick up exactly where Date.now()-anchoring left off.
                clock: { ...clock, virtualNow: clock.virtualNow ?? clock.lastTickAt },
                extractionTiles: extractionTiles ?? [],
                pathTiles: pathTiles ?? [],
                towers: towers ?? [],
                walls: walls ?? [],
                barracksList: barracksList ?? [],
                // Spread over initialUnits() defaults, not just `?? initialUnits()` —
                // an existing save from before junkyardKnightCount/crossBowSniperCount
                // existed would otherwise load with those fields undefined.
                units: { ...initialUnits(), ...units },
                garrisons: garrisons ?? [],
                scoutedTiles: scoutedTiles ?? [],
                storageLevels,
                storageUpgrades: storageUpgrades ?? initialStorageUpgrades(),
                noise: noise ?? initialNoise(tweaks),
                // resolveDen spreads siege:null over any pre-M14 den missing it.
                dens: resolvedDens,
                hordes: hordes ?? [],
                // Pre-2026-07-21 saves predate resolvedIndex (real-time
                // incremental corridor resolution) — default it to 0 so an
                // in-flight party from an old save just re-walks its corridor
                // from the start next tick, same as a freshly-dispatched one.
                expeditions: (expeditions ?? []).map((e) => ({ ...e, resolvedIndex: e.resolvedIndex ?? 0 })),
                // Spreads over initialGameStatus() defaults, not just `?? initialGameStatus()`
                // — a pre-M15 save has `lost`/`lostAt` but no `won`/`wonAt`.
                gameStatus: { ...initialGameStatus(), ...gameStatus },
                docks: docks ?? [],
                scoutSkiffs: scoutSkiffs ?? [],
                wanderingScouts: wanderingScouts ?? [],
                denAssaults: (denAssaults ?? []).map((a) => ({ ...a, resolvedIndex: a.resolvedIndex ?? 0 })),
                outposts: outposts ?? [],
                garrisonRecalls: garrisonRecalls ?? [],
                // Pre-M15 saves have no lab yet — create one deterministically
                // from the same world seed, same convention as dens/outposts
                // gaining defaults when their systems first shipped.
                lab: lab ?? createLab(world.seed, tweaks.game.grid_size, territory.base, resolvedDens, tweaks),
                labAssaults: (labAssaults ?? []).map((a) => ({ ...a, resolvedIndex: a.resolvedIndex ?? 0 })),
                research: research ?? initialResearch(),
                tombstones: tombstones ?? [],
              }
            : undefined;
        setBoot({ status: "ready", tweaks, game });
      } catch (err) {
        setBoot({ status: "error", message: err instanceof Error ? err.message : String(err) });
      }
    })();
  }, []);

  // Real-time tick: accrues extraction-tile yield since the last time we
  // checked, whether that was 1 second ago (still playing) or an hour ago
  // (reopened after being closed) — same code path handles both.
  const hasGame = boot.status === "ready" && boot.game !== undefined;
  useEffect(() => {
    if (!hasGame) return;

    function runTick() {
      const current = bootRef.current;
      if (current.status !== "ready" || !current.game) return;
      if (current.game.gameStatus.lost || current.game.gameStatus.won) return; // frozen — DESIGN.md §13 loss/win condition already hit
      const now = Date.now();
      const elapsedSeconds = ((now - current.game.clock.lastTickAt) / 1000) * speedMultiplierRef.current;
      if (elapsedSeconds <= 0) return;
      // Every build/upgrade/training timer is checked against this instead of
      // `now` — it advances at the same speedMultiplier-scaled rate as
      // elapsedSeconds, so fast-forward speeds up timers too, not just
      // resource/noise/horde simulation.
      const virtualNow = current.game.clock.virtualNow + elapsedSeconds * 1000;

      // Base always goes first in this list — accrueResources claims a
      // path-connected tile for whichever hub reaches it first in caller
      // order, but every hub (base or outpost) feeds the same shared
      // `resources` pool now (engine/tick.ts:accrueResources doc comment),
      // so claim order only matters for picking which connection's
      // tier/throughput applies, not who "gets" the resources.
      const economyHubCoords: Axial[] = [current.game.territory.base, ...current.game.outposts.map((o) => o.coord)];
      const { resources: producedResources, tiles: extractionTilesAfterYield } = accrueResources(
        current.tweaks,
        current.game.extractionTiles,
        current.game.pathTiles,
        elapsedSeconds,
        current.game.world.seed,
        current.game.resources,
        current.game.storageLevels,
        economyHubCoords,
      );
      // Later stages (hold-period damage, horde overrun/reversion, fresh
      // conversions) build on top of this array, not current.game.outposts
      // directly. Reinforcement upgrade/repair timers are resolved here too,
      // before hordeHubs below reads currentHp for this tick's combat.
      const outpostsAfterYield: OutpostsRecord = current.game.outposts.map((o) =>
        resolveOutpostReinforcementAction(current.tweaks, o, virtualNow),
      );
      const { resources: producedResourcesWithDocks, docks: docksAfterYield } = accrueDockResources(
        current.tweaks,
        current.game.docks,
        producedResources,
        elapsedSeconds,
        current.game.storageLevels,
      );
      const { food: foodAfterUpkeep, units: unitsAfterUpkeep } = applyUpkeepTick(
        current.tweaks,
        current.game.units,
        producedResourcesWithDocks.food,
        elapsedSeconds,
      );
      const resources = { ...producedResourcesWithDocks, food: foodAfterUpkeep };
      const noise: NoiseRecord = {
        value: accrueNoise(
          current.tweaks,
          current.game.extractionTiles,
          current.game.pathTiles,
          current.game.towers,
          current.game.walls,
          current.game.noise.value,
          elapsedSeconds,
          current.game.base.level,
        ),
      };
      const clock: ClockRecord = { lastTickAt: now, virtualNow };

      // Base-level upgrade timer runs even while offline (TWEAKS.md), checked
      // against the virtual clock (not `now`) so fast-forward speeds it up too.
      // Spreads over current.game.base so a field like `relocation` — added
      // after this ternary was first written — isn't silently dropped when a
      // level-up completes the same tick a relocation happens to be pending.
      const currentUpgrade = current.game.base.upgrade;
      let baseAfterUpgrade: BaseRecord = current.game.base;
      if (currentUpgrade && isBaseUpgradeComplete(current.tweaks, currentUpgrade, virtualNow)) {
        baseAfterUpgrade = { ...current.game.base, level: currentUpgrade.targetLevel, upgrade: null };
        pushToast({ message: `Base upgraded to level ${currentUpgrade.targetLevel}` });
      }

      // Reinforcement (HP) upgrade/repair timer — same virtual-clock-
      // threshold pattern, resolved before hordeHubs below reads currentHp
      // for this tick's combat.
      const baseAfterReinforcement = resolveBaseReinforcementAction(current.tweaks, baseAfterUpgrade, virtualNow);

      // Base relocation timer — same virtual-clock-threshold pattern as the
      // upgrade check above. This is the one place territory.base is ever
      // reassigned; resolved here (before hordeSpawns/advanceHordes/
      // garrisonDefense below) so the rest of this tick's horde logic already
      // sees wherever the base ends up. Everything else (towers, walls,
      // barracks, garrisons, dens) stays exactly where it was — only the
      // base coordinate moves, and the destination tile joins territory.owned
      // if it wasn't already (a base always sits on owned ground).
      const relocation = baseAfterReinforcement.relocation;
      const relocationDistance = relocation ? axialDistance(current.game.territory.base, relocation.destination) : 0;
      const territoryAfterRelocation: TerritoryRecord =
        relocation && isBaseRelocationComplete(current.tweaks, relocation, relocationDistance, virtualNow)
          ? {
              base: relocation.destination,
              owned: current.game.territory.owned.some((o) => axialKey(o) === axialKey(relocation.destination))
                ? current.game.territory.owned
                : [...current.game.territory.owned, relocation.destination],
            }
          : current.game.territory;
      const base: BaseRecord =
        territoryAfterRelocation !== current.game.territory
          ? { ...baseAfterReinforcement, relocation: null }
          : baseAfterReinforcement;

      // Structure upgrade/repair timers — same virtual-clock-threshold
      // pattern as the base-level check above, resolved per structure array.
      // Must map over extractionTilesAfterYield (not
      // current.game.extractionTiles), or this tick's just-accrued stockpile
      // deltas would be silently discarded. Each array gets a second .map
      // resolving damageRepair (structureRepairDurationMs) on top — an
      // independent timer from tier/level upgrades, so a structure can have
      // either (or, for walls, either plus its own separate durability
      // action) in flight without conflict.
      const extractionTiles = extractionTilesAfterYield
        .map((t) =>
          t.upgrade && isTimerComplete(t.upgrade.startedAt, tierUpgradeDurationMs(current.tweaks, t.upgrade.targetTier), virtualNow)
            ? { ...t, tier: t.upgrade.targetTier, upgrade: null }
            : t,
        )
        .map((t) => resolveDamageRepair(t, current.tweaks, virtualNow))
        .map((t) => resolveConstruction(t, extractionTileBuildDurationMs(current.tweaks), virtualNow));
      const pathTiles = current.game.pathTiles
        .map((t) =>
          t.upgrade && isTimerComplete(t.upgrade.startedAt, pathUpgradeDurationMs(current.tweaks, t.upgrade.targetTier), virtualNow)
            ? { ...t, tier: t.upgrade.targetTier, upgrade: null }
            : t,
        )
        .map((t) => resolveDamageRepair(t, current.tweaks, virtualNow))
        .map((t) => resolveConstruction(t, pathBuildDurationMs(current.tweaks), virtualNow));
      const towers = current.game.towers
        .map((t) =>
          t.upgrade && isTimerComplete(t.upgrade.startedAt, towerUpgradeDurationMs(current.tweaks, t.upgrade.targetLevel), virtualNow)
            ? { ...t, level: t.upgrade.targetLevel, upgrade: null }
            : t,
        )
        .map((t) => resolveDamageRepair(t, current.tweaks, virtualNow))
        .map((t) => resolveConstruction(t, towerBuildDurationMs(current.tweaks), virtualNow));
      const barracksList = current.game.barracksList
        .map((b) =>
          b.upgrade &&
          isTimerComplete(b.upgrade.startedAt, barracksUpgradeDurationMs(current.tweaks, b.upgrade.targetLevel), virtualNow)
            ? { ...b, level: b.upgrade.targetLevel, upgrade: null }
            : b,
        )
        .map((b) => resolveDamageRepair(b, current.tweaks, virtualNow))
        .map((b) => resolveConstruction(b, barracksBuildDurationMs(current.tweaks), virtualNow));
      const walls = current.game.walls
        .map((w) => {
          if (!w.action) return w;
          if (w.action.kind === "upgrade") {
            const durationMs = wallUpgradeDurationMs(current.tweaks, w.action.targetTier);
            if (!isTimerComplete(w.action.startedAt, durationMs, virtualNow)) return w;
            return { ...w, tier: w.action.targetTier, durability: maxWallDurability(current.tweaks, w.action.targetTier), action: null };
          }
          const maxHp = maxWallDurability(current.tweaks, w.tier);
          const durationMs = wallRepairDurationMs(current.tweaks, w, maxHp);
          if (!isTimerComplete(w.action.startedAt, durationMs, virtualNow)) return w;
          return { ...w, durability: maxHp, action: null };
        })
        .map((w) => resolveDamageRepair(w, current.tweaks, virtualNow))
        .map((w) => resolveConstruction(w, wallBuildDurationMs(current.tweaks), virtualNow));
      // Must map over docksAfterYield (not current.game.docks), or this
      // tick's just-accrued stockpile deltas would be silently discarded —
      // same reasoning as extractionTiles above.
      const docks = docksAfterYield
        .map((d) =>
          d.fishingBoatUpgrade &&
          isTimerComplete(d.fishingBoatUpgrade.startedAt, current.tweaks.docks.fishing_boat.build_time_minutes * 60_000, virtualNow)
            ? { ...d, fishingBoat: true, fishingBoatUpgrade: null }
            : d,
        )
        .map((d) => resolveConstruction(d, dockBuildDurationMs(current.tweaks), virtualNow));
      const scoutSkiffsAfterBuild = current.game.scoutSkiffs.map((s) =>
        s.buildStartedAt !== null &&
        isTimerComplete(s.buildStartedAt, current.tweaks.docks.scout_skiff.build_time_minutes * 60_000, virtualNow)
          ? { ...s, buildStartedAt: null }
          : s,
      );
      const { skiffs: scoutSkiffs, scoutedTiles: scoutedTilesAfterSkiffs } = advanceScoutSkiffs(
        current.tweaks,
        scoutSkiffsAfterBuild,
        current.game.scoutedTiles,
        current.game.world.seed,
        current.tweaks.game.grid_size,
        elapsedSeconds,
      );
      const wanderingScoutsAfterBuild = current.game.wanderingScouts.map((s) =>
        s.buildStartedAt !== null &&
        isTimerComplete(s.buildStartedAt, current.tweaks.units.wandering_scout.build_time_minutes * 60_000, virtualNow)
          ? { ...s, buildStartedAt: null }
          : s,
      );
      const { scouts: wanderingScouts, scoutedTiles } = advanceWanderingScouts(
        current.tweaks,
        wanderingScoutsAfterBuild,
        scoutedTilesAfterSkiffs,
        current.game.world.seed,
        current.tweaks.game.grid_size,
        elapsedSeconds,
      );

      // Storage-level upgrade timers — same virtual-clock-threshold pattern,
      // but keyed by resource (data/storageUpgrades.ts) rather than a single
      // per-record slot, since every resource can be upgrading at once.
      let storageLevels = current.game.storageLevels;
      let storageUpgrades = current.game.storageUpgrades;
      for (const [resource, pending] of Object.entries(current.game.storageUpgrades) as [
        ResourceType,
        { targetLevel: number; startedAt: number } | undefined,
      ][]) {
        if (!pending || !isTimerComplete(pending.startedAt, storageUpgradeDurationMs(current.tweaks, pending.targetLevel), virtualNow)) {
          continue;
        }
        storageLevels = { ...storageLevels, [resource]: pending.targetLevel };
        const { [resource]: _completed, ...remainingUpgrades } = storageUpgrades;
        storageUpgrades = remainingUpgrades;
      }

      // Research timer — single global pending slot (data/research.ts),
      // same virtual-clock-threshold pattern as storage above.
      let research = current.game.research;
      if (
        research.pending &&
        isTimerComplete(research.pending.startedAt, researchDurationMs(current.tweaks, research.pending.id), virtualNow)
      ) {
        research = { completed: [...research.completed, research.pending.id], pending: null };
      }

      // Unit training queues — closed-form trickle delivery (engine/units.ts).
      // More/higher-level (non-damaged) barracks means faster training, not
      // just more capacity — barracksTrainingCapacity is level-weighted.
      const trainingCapacity = barracksTrainingCapacity(barracksList);
      const scoutQueueResult = resolveTrainingQueue(
        unitsAfterUpkeep.scoutQueue,
        scoutTrainDurationMs(current.tweaks, trainingCapacity),
        virtualNow,
      );
      const militiaQueueResult = resolveTrainingQueue(
        unitsAfterUpkeep.militiaQueue,
        militiaTrainDurationMs(current.tweaks, trainingCapacity),
        virtualNow,
      );
      const junkyardKnightQueueResult = resolveTrainingQueue(
        unitsAfterUpkeep.junkyardKnightQueue,
        junkyardKnightTrainDurationMs(current.tweaks, trainingCapacity),
        virtualNow,
      );
      const crossBowSniperQueueResult = resolveTrainingQueue(
        unitsAfterUpkeep.crossBowSniperQueue,
        crossBowSniperTrainDurationMs(current.tweaks, trainingCapacity),
        virtualNow,
      );
      const units: UnitsRecord = {
        ...unitsAfterUpkeep,
        scoutStockpile: unitsAfterUpkeep.scoutStockpile + scoutQueueResult.delivered,
        scoutQueue: scoutQueueResult.queue,
        militiaCount: unitsAfterUpkeep.militiaCount + militiaQueueResult.delivered,
        militiaQueue: militiaQueueResult.queue,
        junkyardKnightCount: unitsAfterUpkeep.junkyardKnightCount + junkyardKnightQueueResult.delivered,
        junkyardKnightQueue: junkyardKnightQueueResult.queue,
        crossBowSniperCount: unitsAfterUpkeep.crossBowSniperCount + crossBowSniperQueueResult.delivered,
        crossBowSniperQueue: crossBowSniperQueueResult.queue,
      };

      const hordesAfterSpawn = checkHordeSpawns(
        current.tweaks,
        current.game.dens,
        current.game.hordes,
        noise.value,
        base.level,
        current.game.world.seed,
        territoryAfterRelocation,
        outpostsAfterYield,
        current.tweaks.game.grid_size,
        now,
        elapsedSeconds,
      );
      const baseGarrisonDefense = garrisonDefense(current.tweaks, current.game.garrisons, territoryAfterRelocation.base);
      // Every live Outpost is a defended point exactly like the main base —
      // see engine/hordes.ts:HordeHub's doc comment. A horde's route is
      // fixed toward whichever hub was nearest its den at spawn time
      // (checkHordeSpawns/findNearestHordeTarget above); a hub that isn't
      // the target still takes damage here if it happens to sit on the route.
      const gameGarrisons = current.game.garrisons;
      const hordeHubs: HordeHub[] = [
        { coord: territoryAfterRelocation.base, hp: base.currentHp, garrisonDefense: baseGarrisonDefense, kind: "base", id: "base" },
        ...outpostsAfterYield.map((o) => ({
          coord: o.coord,
          hp: o.currentHp,
          garrisonDefense: garrisonDefense(current.tweaks, gameGarrisons, o.coord),
          kind: "outpost" as const,
          id: o.id,
        })),
      ];
      const { hordes, territory, capturedTiles, overrunHubKeys, hubDamage } = advanceHordes(
        current.tweaks,
        hordesAfterSpawn,
        territoryAfterRelocation,
        extractionTiles,
        pathTiles,
        towers,
        walls,
        barracksList,
        current.game.garrisons,
        hordeHubs,
        elapsedSeconds,
      );
      const baseOverrun = overrunHubKeys.includes(axialKey(territoryAfterRelocation.base));
      const baseDamageTaken = hubDamage[axialKey(territoryAfterRelocation.base)] ?? 0;
      const gameStatusAfterHordes: GameStatusRecord = baseOverrun
        ? { ...current.game.gameStatus, lost: true, lostAt: now }
        : current.game.gameStatus;
      // A successful defense still costs HP — repeated assaults demand
      // repair even if none of them individually break through.
      const baseAfterHordes: BaseRecord =
        baseDamageTaken > 0 ? { ...base, currentHp: Math.max(0, base.currentHp - baseDamageTaken) } : base;

      // An outpost overrun doesn't end the game — it reverts to a hostile
      // den instead (engine/outposts.ts:revertOutpostToDen), needing a fresh
      // siege. A merely-damaged (not overrun) outpost just loses HP, same as
      // the base above.
      const outpostsAfterHordes: OutpostsRecord = [];
      const revertedDens: DenRecord[] = [];
      for (const outpost of outpostsAfterYield) {
        const key = axialKey(outpost.coord);
        if (overrunHubKeys.includes(key)) {
          revertedDens.push(revertOutpostToDen(outpost));
          continue;
        }
        const damage = hubDamage[key] ?? 0;
        outpostsAfterHordes.push(damage > 0 ? { ...outpost, currentHp: Math.max(0, outpost.currentHp - damage) } : outpost);
      }

      // Any structure sitting on a tile a horde just captured goes non-
      // functional until reclaimed and repaired — DESIGN.md §12. A no-op
      // (same array reference back) whenever nothing was captured this tick.
      const extractionTilesAfterCapture = markCapturedStructuresDamaged(extractionTiles, capturedTiles);
      const pathTilesAfterCapture = markCapturedStructuresDamaged(pathTiles, capturedTiles);
      const towersAfterCapture = markCapturedStructuresDamaged(towers, capturedTiles);
      const wallsAfterCapture = markCapturedStructuresDamaged(walls, capturedTiles);
      const barracksListAfterCapture = markCapturedStructuresDamaged(barracksList, capturedTiles);

      // A garrison on a captured tile is wiped outright (no luck, same as
      // any other committed force on a loss) — its militia are actually
      // dead, so they come off the standing army total too, not just the
      // garrison list.
      const { garrisons: garrisonsAfterCapture, militiaLost, junkyardKnightLost, crossBowSniperLost } =
        resolveCapturedGarrisons(current.game.garrisons, capturedTiles);
      const unitsAfterCapture: UnitsRecord =
        militiaLost > 0 || junkyardKnightLost > 0 || crossBowSniperLost > 0
          ? {
              ...units,
              militiaCount: Math.max(0, units.militiaCount - militiaLost),
              junkyardKnightCount: Math.max(0, units.junkyardKnightCount - junkyardKnightLost),
              crossBowSniperCount: Math.max(0, units.crossBowSniperCount - crossBowSniperLost),
            }
          : units;

      // Every garrison auto-attacks any horde on its own tile or a neighbor
      // — no manual action needed (engine/hordes.ts:resolveGarrisonAutoAttacks).
      const {
        garrisons: garrisonsAfterAutoAttack,
        hordes: hordesAfterAutoAttack,
        units: unitsAfterAutoAttack,
        anyAutoAttack,
      } = resolveGarrisonAutoAttacks(current.tweaks, garrisonsAfterCapture, hordes, unitsAfterCapture, wallsAfterCapture);
      const noiseAfterAutoAttack: NoiseRecord = anyAutoAttack
        ? { value: addActionNoise(current.tweaks, noise.value, "attack_horde", base.level) }
        : noise;

      // Viewshed-style passive claim: every tile within a (non-damaged)
      // tower's range is automatically owned, growing with tower level
      // (engine/territory.ts:autoClaimTowerRange) — excludes whatever tiles
      // hordes currently occupy so a capture can't be instantly undone by a
      // tower that happens to cover the same ground.
      const hordeOccupiedKeys = new Set(hordesAfterAutoAttack.map((h) => axialKey(h.path[h.pathIndex])));
      const hordeSizeByKey = new Map<string, number>(
        hordesAfterAutoAttack.map((h) => [axialKey(h.path[h.pathIndex]), h.size]),
      );
      const territoryAfterClaim = autoClaimTowerRange(
        current.tweaks,
        towersAfterCapture,
        territory,
        current.tweaks.game.grid_size,
        hordeOccupiedKeys,
      );

      // Expeditions/den-assaults/lab-assaults all resolve their corridor
      // incrementally, EVERY tick, for EVERY in-flight party of that kind —
      // not just the ones whose arriveAt has passed. Each party's real-time
      // progress along its path (engine/expeditions.ts:expeditionPathIndexAt
      // — the same formula HexCanvas uses to place the visual marker) is
      // walked tile-by-tile via stepCorridorWalk: an owned tile is free
      // passage, an unowned one is fought immediately and claimed into
      // territory the instant it's won, and a loss (out-fought, or a horde
      // occupying the tile) stops the party right there, leaving a tombstone
      // (data/tombstones.ts) at the death tile — whatever was claimed before
      // that point stays owned. Parties are processed sorted by departedAt
      // (earliest-committed first), so two parties sharing a corridor still
      // see each other's just-claimed tiles as free passage this same tick —
      // the same intent the old oldest-arrival-first ordering served, now
      // generalized from "only today's arrivals" to "every in-flight party."
      const debitParty = (
        u: UnitsRecord,
        party: { militiaCommitted: number; junkyardKnightCommitted: number; crossBowSniperCommitted: number },
      ): UnitsRecord => ({
        ...u,
        militiaCount: Math.max(0, u.militiaCount - party.militiaCommitted),
        junkyardKnightCount: Math.max(0, u.junkyardKnightCount - party.junkyardKnightCommitted),
        crossBowSniperCount: Math.max(0, u.crossBowSniperCount - party.crossBowSniperCommitted),
      });

      const tombstonesFromThisTick: TombstoneRecord[] = [];
      let tombstoneSeq = 0;
      const makeTombstone = (
        partyKind: TombstoneRecord["partyKind"],
        target: Axial,
        tile: Axial,
        cause: TombstoneCause,
        party: { militiaCommitted: number; junkyardKnightCommitted: number; crossBowSniperCommitted: number },
        attackPower: number,
      ): TombstoneRecord => ({
        id: `tombstone-${axialKey(tile)}-${virtualNow}-${tombstoneSeq++}`,
        coord: tile,
        partyKind,
        target,
        militiaLost: party.militiaCommitted,
        junkyardKnightLost: party.junkyardKnightCommitted,
        crossBowSniperLost: party.crossBowSniperCommitted,
        attackPower,
        cause,
        createdAt: virtualNow,
        expiresAt: virtualNow + current.tweaks.expeditions.tombstone_lifetime_minutes * 60_000,
      });

      let territoryAfterExpeditions = territoryAfterClaim;
      let unitsAfterExpeditions = unitsAfterAutoAttack;
      const nextExpeditions: Expedition[] = [];

      for (const expedition of [...current.game.expeditions].sort((a, b) => a.departedAt - b.departedAt)) {
        const attackPower = partyAttackPower(
          current.tweaks,
          expedition.militiaCommitted,
          expedition.junkyardKnightCommitted,
          expedition.crossBowSniperCommitted,
        );
        const targetIndex = expeditionPathIndexAt(expedition.departedAt, expedition.arriveAt, virtualNow, expedition.path.length);
        const step = stepCorridorWalk(
          current.tweaks,
          expedition.path,
          expedition.resolvedIndex,
          targetIndex,
          territoryAfterExpeditions.owned,
          territoryAfterExpeditions.base,
          attackPower,
          hordeSizeByKey,
        );

        if (step.claimedTiles.length > 0) {
          territoryAfterExpeditions = {
            ...territoryAfterExpeditions,
            owned: [...territoryAfterExpeditions.owned, ...step.claimedTiles],
          };
        }

        if (step.death) {
          unitsAfterExpeditions = debitParty(unitsAfterExpeditions, expedition);
          tombstonesFromThisTick.push(
            makeTombstone("expedition", expedition.target, step.death.tile, step.death.cause, expedition, attackPower),
          );
          continue;
        }

        if (step.resolvedIndex >= expedition.path.length - 1) continue; // arrived home safely, no count change

        nextExpeditions.push({ ...expedition, resolvedIndex: step.resolvedIndex });
      }

      // Den assaults resolve the same corridor-walk mechanism as expeditions
      // (sorted by departedAt) — see App.tsx:handleAssaultDen's doc comment.
      // The corridor leading up to the den (path[0..length-2]) is walked/
      // claimed exactly like an expedition's route, in real time. Once a
      // party's resolvedIndex reaches the corridor's end (alive), the
      // destination fight triggers immediately (not gated on arriveAt
      // directly, though the two normally coincide) and depends on the den's
      // state *right now*, not at dispatch time — the same
      // DenAssaultRecord/denAssaults array is used for both an initial
      // assault AND reinforcing an already-besieged den (or a den that has
      // since converted to an outpost): if the den is still hostile (never
      // sieged, or a past siege failed before this party arrived), it's a
      // real fight against denDefense (engine/dens.ts:resolveDenAssault) with
      // proportional attrition on a win (engine/dens.ts:denAssaultSurvivors)
      // — unlike every other fight in this game, which is all-or-nothing. If
      // the den is already under siege, or has already converted to an
      // outpost, there's nothing to fight — the whole party that survived
      // the corridor just joins the garrison there directly, no attrition
      // (they're marching into already-friendly ground, not storming
      // anything).
      let densAfterAssaults = [...current.game.dens, ...revertedDens];
      let garrisonsAfterSieges = garrisonsAfterAutoAttack;
      let outpostsAfterSieges = outpostsAfterHordes;
      // Guaranteed clue on every den->outpost conversion (DESIGN.md §13),
      // capped at the fixed total — bumped inside the "converted" branch
      // below alongside the den's own resolution.
      let labAfterClues: LabRecord = current.game.lab;

      const mergeIntoGarrison = (
        garrisons: GarrisonsRecord,
        coord: Axial,
        militia: number,
        junkyardKnight: number,
        crossBowSniper: number,
      ): GarrisonsRecord => {
        const existing = garrisonAt(garrisons, coord);
        return existing
          ? garrisons.map((g) =>
              axialKey(g.coord) === axialKey(coord)
                ? {
                    ...g,
                    militiaCount: g.militiaCount + militia,
                    junkyardKnightCount: g.junkyardKnightCount + junkyardKnight,
                    crossBowSniperCount: g.crossBowSniperCount + crossBowSniper,
                  }
                : g,
            )
          : [...garrisons, { coord, militiaCount: militia, junkyardKnightCount: junkyardKnight, crossBowSniperCount: crossBowSniper }];
      };

      const nextDenAssaults: DenAssaultRecord[] = [];

      for (const assault of [...current.game.denAssaults].sort((a, b) => a.departedAt - b.departedAt)) {
        const den = densAfterAssaults.find((d) => d.id === assault.denId);
        const outpost = !den ? outpostsAfterSieges.find((o) => o.id === `outpost-${assault.denId}`) : null;
        if (!den && !outpost) continue; // gone with no outpost either — shouldn't happen, but a harmless no-op if it does

        const attackPower = partyAttackPower(
          current.tweaks,
          assault.militiaCommitted,
          assault.junkyardKnightCommitted,
          assault.crossBowSniperCommitted,
        );

        // The den itself is fought separately from the corridor leading to
        // it (last path element = the den's own coord) — stepCorridorWalk
        // only ever claims ordinary map tiles, so its targetIndex is capped
        // one tile short of the destination.
        const corridorEndIndex = assault.path.length - 2;
        const targetIndex = Math.min(
          expeditionPathIndexAt(assault.departedAt, assault.arriveAt, virtualNow, assault.path.length),
          corridorEndIndex,
        );
        const step = stepCorridorWalk(
          current.tweaks,
          assault.path,
          assault.resolvedIndex,
          targetIndex,
          territoryAfterExpeditions.owned,
          territoryAfterExpeditions.base,
          attackPower,
          hordeSizeByKey,
        );

        if (step.claimedTiles.length > 0) {
          territoryAfterExpeditions = {
            ...territoryAfterExpeditions,
            owned: [...territoryAfterExpeditions.owned, ...step.claimedTiles],
          };
        }

        if (step.death) {
          unitsAfterExpeditions = debitParty(unitsAfterExpeditions, assault);
          tombstonesFromThisTick.push(
            makeTombstone("denAssault", assault.target, step.death.tile, step.death.cause, assault, attackPower),
          );
          continue;
        }

        if (step.resolvedIndex < corridorEndIndex) {
          nextDenAssaults.push({ ...assault, resolvedIndex: step.resolvedIndex });
          continue;
        }

        if (outpost || den?.siege) {
          // Reinforcement: nothing to fight, the whole surviving-the-corridor
          // party joins the garrison at the den/outpost's coord.
          const targetCoord = den ? den.coord : outpost!.coord;
          garrisonsAfterSieges = mergeIntoGarrison(
            garrisonsAfterSieges,
            targetCoord,
            assault.militiaCommitted,
            assault.junkyardKnightCommitted,
            assault.crossBowSniperCommitted,
          );
          continue;
        }

        // Otherwise: den exists and isn't (yet, or anymore) under siege —
        // this is a real assault, a first attempt or a retry after an
        // earlier siege failed.
        const den2 = den!;
        const defense = denDefense(current.tweaks, den2.level);
        const { den: denAfterAssault, won } = resolveDenAssault(current.tweaks, den2, attackPower, virtualNow);
        if (!won) {
          unitsAfterExpeditions = debitParty(unitsAfterExpeditions, assault);
          tombstonesFromThisTick.push(
            makeTombstone("denAssault", assault.target, den2.coord, { kind: "tile_defense", attackPower, defense }, assault, attackPower),
          );
          continue;
        }

        densAfterAssaults = densAfterAssaults.map((d) => (d.id === den2.id ? denAfterAssault : d));
        const holdRing = axialSpiral(den2.coord, current.tweaks.dens.siege.hold_owned_radius);
        const ownedKeysSoFar = new Set(territoryAfterExpeditions.owned.map(axialKey));
        const newlyOwned = holdRing.filter((coord) => !ownedKeysSoFar.has(axialKey(coord)));
        if (newlyOwned.length > 0) {
          territoryAfterExpeditions = {
            ...territoryAfterExpeditions,
            owned: [...territoryAfterExpeditions.owned, ...newlyOwned],
          };
        }

        // Attrition: unlike every other fight in this game, a won den
        // assault isn't all-or-nothing — troops are lost proportional to the
        // den's own defense, and whoever's left stays right there as the
        // den's first garrison instead of "returning home" (engine/dens.ts:
        // denAssaultSurvivors's doc comment).
        const survivors = denAssaultSurvivors(
          attackPower,
          defense,
          assault.militiaCommitted,
          assault.junkyardKnightCommitted,
          assault.crossBowSniperCommitted,
        );
        const lostMilitia = assault.militiaCommitted - survivors.militia;
        const lostJunkyardKnight = assault.junkyardKnightCommitted - survivors.junkyardKnight;
        const lostCrossBowSniper = assault.crossBowSniperCommitted - survivors.crossBowSniper;
        if (lostMilitia > 0 || lostJunkyardKnight > 0 || lostCrossBowSniper > 0) {
          unitsAfterExpeditions = {
            ...unitsAfterExpeditions,
            militiaCount: Math.max(0, unitsAfterExpeditions.militiaCount - lostMilitia),
            junkyardKnightCount: Math.max(0, unitsAfterExpeditions.junkyardKnightCount - lostJunkyardKnight),
            crossBowSniperCount: Math.max(0, unitsAfterExpeditions.crossBowSniperCount - lostCrossBowSniper),
          };
        }
        if (survivors.militia > 0 || survivors.junkyardKnight > 0 || survivors.crossBowSniper > 0) {
          garrisonsAfterSieges = mergeIntoGarrison(
            garrisonsAfterSieges,
            den2.coord,
            survivors.militia,
            survivors.junkyardKnight,
            survivors.crossBowSniper,
          );
        }
      }

      // Siege hold periods advance the same tick as den assaults, using this
      // tick's just-built/just-garrisoned defense (engine/dens.ts:holdDefenseAt)
      // — "ongoing" just updates the wave state; "failed" reverts the den to
      // hostile and wipes whatever garrison was holding its core (same
      // committed-forces-lost-on-a-loss rule resolveCapturedGarrisons already
      // enforces for a horde-captured tile); "converted" becomes a brand-new
      // Outpost (data/outposts.ts:createOutpostFromDen), claiming its own
      // starting ring the same way the assault's hold ring was claimed above.
      densAfterAssaults = densAfterAssaults
        .map((den): DenRecord | null => {
          if (!den.siege) return den;

          const holdDefense = holdDefenseAt(
            current.tweaks,
            den.coord,
            towersAfterCapture,
            wallsAfterCapture,
            garrisonsAfterSieges,
          );
          const { den: denAfterHold, outcome } = resolveHoldPeriod(current.tweaks, den, holdDefense, virtualNow);

          if (outcome === "failed") {
            const {
              garrisons: garrisonsAfterWipe,
              militiaLost,
              junkyardKnightLost,
              crossBowSniperLost,
            } = resolveCapturedGarrisons(garrisonsAfterSieges, [den.coord]);
            garrisonsAfterSieges = garrisonsAfterWipe;
            if (militiaLost > 0 || junkyardKnightLost > 0 || crossBowSniperLost > 0) {
              unitsAfterExpeditions = {
                ...unitsAfterExpeditions,
                militiaCount: Math.max(0, unitsAfterExpeditions.militiaCount - militiaLost),
                junkyardKnightCount: Math.max(0, unitsAfterExpeditions.junkyardKnightCount - junkyardKnightLost),
                crossBowSniperCount: Math.max(0, unitsAfterExpeditions.crossBowSniperCount - crossBowSniperLost),
              };
            }
            return denAfterHold;
          }

          if (outcome === "converted") {
            outpostsAfterSieges = [...outpostsAfterSieges, createOutpostFromDen(current.tweaks, den, virtualNow)];
            pushToast({ message: `Den at (${den.coord.q}, ${den.coord.r}) cleared — converted to an outpost` });
            const startingRing = axialSpiral(den.coord, current.tweaks.outposts.starting_owned_radius);
            const ownedKeysSoFar = new Set(territoryAfterExpeditions.owned.map(axialKey));
            const newlyOwned = startingRing.filter((coord) => !ownedKeysSoFar.has(axialKey(coord)));
            if (newlyOwned.length > 0) {
              territoryAfterExpeditions = {
                ...territoryAfterExpeditions,
                owned: [...territoryAfterExpeditions.owned, ...newlyOwned],
              };
            }
            if (labAfterClues.cluesCollected < current.tweaks.lab_clues.total_clues) {
              labAfterClues = { ...labAfterClues, cluesCollected: labAfterClues.cluesCollected + 1 };
              const clueText = labClueText(labAfterClues.cluesCollected, territoryAfterExpeditions.base, labAfterClues.coord);
              pushToast({ message: `New lab clue (${labAfterClues.cluesCollected}/${current.tweaks.lab_clues.total_clues}): ${clueText}` });
            }
            return null; // the den no longer exists — it's an outpost now
          }

          return denAfterHold;
        })
        .filter((d): d is DenRecord => d !== null);

      // Lab assaults resolve the same corridor-walk mechanism as den assaults
      // above, then a final fight against the guardian (engine/lab.ts:
      // resolveLabAssault) once the corridor is fully walked. Unlike a den
      // assault, this is all-or-nothing (no siege/hold period, no
      // proportional attrition): a win keeps the whole party and secures the
      // lab for good; a loss wipes the whole committed party (and leaves a
      // tombstone at the lab), guardian untouched, retryable any time. If the
      // lab's already secured by the time a party finishes its corridor (an
      // earlier assault this same tick, or an earlier tick entirely), they
      // simply return home safely — nothing left to fight.
      const nextLabAssaults: LabAssaultRecord[] = [];

      for (const assault of [...current.game.labAssaults].sort((a, b) => a.departedAt - b.departedAt)) {
        const attackPower = partyAttackPower(
          current.tweaks,
          assault.militiaCommitted,
          assault.junkyardKnightCommitted,
          assault.crossBowSniperCommitted,
        );

        const corridorEndIndex = assault.path.length - 2;
        const targetIndex = Math.min(
          expeditionPathIndexAt(assault.departedAt, assault.arriveAt, virtualNow, assault.path.length),
          corridorEndIndex,
        );
        const step = stepCorridorWalk(
          current.tweaks,
          assault.path,
          assault.resolvedIndex,
          targetIndex,
          territoryAfterExpeditions.owned,
          territoryAfterExpeditions.base,
          attackPower,
          hordeSizeByKey,
        );

        if (step.claimedTiles.length > 0) {
          territoryAfterExpeditions = {
            ...territoryAfterExpeditions,
            owned: [...territoryAfterExpeditions.owned, ...step.claimedTiles],
          };
        }

        if (step.death) {
          unitsAfterExpeditions = debitParty(unitsAfterExpeditions, assault);
          tombstonesFromThisTick.push(
            makeTombstone("labAssault", assault.target, step.death.tile, step.death.cause, assault, attackPower),
          );
          continue;
        }

        if (step.resolvedIndex < corridorEndIndex) {
          nextLabAssaults.push({ ...assault, resolvedIndex: step.resolvedIndex });
          continue;
        }

        if (labAfterClues.secured) continue;

        const { lab: labAfterAssault, won } = resolveLabAssault(current.tweaks, labAfterClues, attackPower);
        labAfterClues = labAfterAssault;
        if (!won) {
          unitsAfterExpeditions = debitParty(unitsAfterExpeditions, assault);
          tombstonesFromThisTick.push(
            makeTombstone(
              "labAssault",
              assault.target,
              assault.target,
              { kind: "tile_defense", attackPower, defense: current.tweaks.lab.guardian_defense },
              assault,
              attackPower,
            ),
          );
        }
      }

      // A recalled garrison is a pure timer, not a fight — the troops were
      // already pulled off their tile the moment the recall was dispatched
      // (App.tsx:handleRecallMilitia), and were never actually removed from
      // units.*Count (same "reserved, not removed" pattern expeditions/den
      // assaults use), so once a recall's record is dropped here it's
      // automatically back in the available pool — nothing else to resolve.
      const pendingGarrisonRecalls = current.game.garrisonRecalls.filter((r) => virtualNow < r.arriveAt);

      // Tombstones expire on the virtual clock, same idiom as every other
      // timed record above — a party's death is informational, not
      // persistent state, so it just needs to fade after
      // tombstone_lifetime_minutes.
      const tombstonesAfterExpiry = [...current.game.tombstones, ...tombstonesFromThisTick].filter(
        (t) => virtualNow < t.expiresAt,
      );

      // Win condition (DESIGN.md §13): securing the lab ALONE — clearing
      // dens is never required, den-clearing is just one route to the army
      // strong enough to beat the guardian (and a guaranteed clue source).
      const gameStatus: GameStatusRecord =
        labAfterClues.secured && !gameStatusAfterHordes.won
          ? { ...gameStatusAfterHordes, won: true, wonAt: now }
          : gameStatusAfterHordes;

      void Promise.all([
        set(RESOURCES_DB_KEY, resources),
        set(EXTRACTION_TILES_DB_KEY, extractionTilesAfterCapture),
        set(PATH_TILES_DB_KEY, pathTilesAfterCapture),
        set(TOWERS_DB_KEY, towersAfterCapture),
        set(WALLS_DB_KEY, wallsAfterCapture),
        set(BARRACKS_DB_KEY, barracksListAfterCapture),
        set(UNITS_DB_KEY, unitsAfterExpeditions),
        set(GARRISONS_DB_KEY, garrisonsAfterSieges),
        set(NOISE_DB_KEY, noiseAfterAutoAttack),
        set(CLOCK_DB_KEY, clock),
        set(BASE_DB_KEY, baseAfterHordes),
        set(HORDES_DB_KEY, hordesAfterAutoAttack),
        set(TERRITORY_DB_KEY, territoryAfterExpeditions),
        set(EXPEDITIONS_DB_KEY, nextExpeditions),
        set(GAME_STATUS_DB_KEY, gameStatus),
        set(DOCKS_DB_KEY, docks),
        set(SCOUT_SKIFFS_DB_KEY, scoutSkiffs),
        set(WANDERING_SCOUTS_DB_KEY, wanderingScouts),
        set(SCOUTED_TILES_DB_KEY, scoutedTiles),
        set(DENS_DB_KEY, densAfterAssaults),
        set(DEN_ASSAULTS_DB_KEY, nextDenAssaults),
        set(OUTPOSTS_DB_KEY, outpostsAfterSieges),
        set(GARRISON_RECALLS_DB_KEY, pendingGarrisonRecalls),
        set(LAB_DB_KEY, labAfterClues),
        set(LAB_ASSAULTS_DB_KEY, nextLabAssaults),
        set(STORAGE_LEVELS_DB_KEY, storageLevels),
        set(STORAGE_UPGRADES_DB_KEY, storageUpgrades),
        set(RESEARCH_DB_KEY, research),
        set(TOMBSTONES_DB_KEY, tombstonesAfterExpiry),
      ]);
      setBoot((prev) =>
        prev.status === "ready" && prev.game
          ? {
              ...prev,
              game: {
                ...prev.game,
                resources,
                extractionTiles: extractionTilesAfterCapture,
                pathTiles: pathTilesAfterCapture,
                towers: towersAfterCapture,
                walls: wallsAfterCapture,
                barracksList: barracksListAfterCapture,
                units: unitsAfterExpeditions,
                garrisons: garrisonsAfterSieges,
                noise: noiseAfterAutoAttack,
                clock,
                base: baseAfterHordes,
                hordes: hordesAfterAutoAttack,
                territory: territoryAfterExpeditions,
                expeditions: nextExpeditions,
                gameStatus,
                docks,
                scoutSkiffs,
                wanderingScouts,
                scoutedTiles,
                dens: densAfterAssaults,
                denAssaults: nextDenAssaults,
                outposts: outpostsAfterSieges,
                garrisonRecalls: pendingGarrisonRecalls,
                lab: labAfterClues,
                labAssaults: nextLabAssaults,
                storageLevels,
                storageUpgrades,
                research,
                tombstones: tombstonesAfterExpiry,
              },
            }
          : prev,
      );
    }

    runTick();
    const interval = setInterval(runTick, 1000);
    return () => clearInterval(interval);
  }, [hasGame, pushToast]);

  function cycleFastForward() {
    if (boot.status !== "ready" || !boot.game) return;
    const rates = speedMultiplierRates(boot.tweaks, boot.game.research);
    setSpeedMultiplier((m) => {
      const currentIndex = rates.indexOf(m);
      const nextIndex = (currentIndex + 1) % rates.length;
      return rates[nextIndex];
    });
  }

  /**
   * Shared by every "wipe progress and start over" entry point (fresh
   * onboarding, starting a new game as an existing player, restarting the
   * current map) — the only thing that varies between them is which player
   * identity and which world seed get reused vs regenerated.
   */
  async function resetGame(player: Player, seed: number) {
    if (boot.status !== "ready") return;
    const world: WorldRecord = { seed };
    const territory = createStartingTerritory(world.seed, boot.tweaks.game.grid_size);
    const base = initialBase(boot.tweaks);
    const resources = initialResourceAmounts(boot.tweaks);
    const clock: ClockRecord = { lastTickAt: Date.now(), virtualNow: Date.now() };
    const extractionTiles: ExtractionTile[] = [];
    const pathTiles: PathTile[] = [];
    const towers: Tower[] = [];
    const walls: Wall[] = [];
    const barracksList: Barracks[] = [];
    const units = initialUnits();
    const garrisons: GarrisonsRecord = [];
    const scoutedTiles: ScoutedTiles = [];
    const storageLevels = initialStorageLevels();
    const storageUpgrades = initialStorageUpgrades();
    const noise = initialNoise(boot.tweaks);
    const dens = createDens(world.seed, boot.tweaks.game.grid_size, territory.base, boot.tweaks);
    const hordes: HordesRecord = [];
    const expeditions: ExpeditionsRecord = [];
    const gameStatus = initialGameStatus();
    const docks: DocksRecord = [];
    const scoutSkiffs: ScoutSkiffsRecord = [];
    const wanderingScouts: WanderingScoutsRecord = [];
    const denAssaults: DenAssaultsRecord = [];
    const outposts: OutpostsRecord = [];
    const garrisonRecalls: GarrisonRecallsRecord = [];
    const lab = createLab(world.seed, boot.tweaks.game.grid_size, territory.base, dens, boot.tweaks);
    const labAssaults: LabAssaultsRecord = [];
    const research = initialResearch();
    const tombstones: TombstonesRecord = [];

    await Promise.all([
      set(PLAYER_DB_KEY, player),
      set(WORLD_DB_KEY, world),
      set(TERRITORY_DB_KEY, territory),
      set(BASE_DB_KEY, base),
      set(RESOURCES_DB_KEY, resources),
      set(CLOCK_DB_KEY, clock),
      set(EXTRACTION_TILES_DB_KEY, extractionTiles),
      set(PATH_TILES_DB_KEY, pathTiles),
      set(TOWERS_DB_KEY, towers),
      set(WALLS_DB_KEY, walls),
      set(BARRACKS_DB_KEY, barracksList),
      set(UNITS_DB_KEY, units),
      set(GARRISONS_DB_KEY, garrisons),
      set(SCOUTED_TILES_DB_KEY, scoutedTiles),
      set(STORAGE_LEVELS_DB_KEY, storageLevels),
      set(STORAGE_UPGRADES_DB_KEY, storageUpgrades),
      set(NOISE_DB_KEY, noise),
      set(DENS_DB_KEY, dens),
      set(HORDES_DB_KEY, hordes),
      set(EXPEDITIONS_DB_KEY, expeditions),
      set(GAME_STATUS_DB_KEY, gameStatus),
      set(DOCKS_DB_KEY, docks),
      set(SCOUT_SKIFFS_DB_KEY, scoutSkiffs),
      set(WANDERING_SCOUTS_DB_KEY, wanderingScouts),
      set(DEN_ASSAULTS_DB_KEY, denAssaults),
      set(OUTPOSTS_DB_KEY, outposts),
      set(GARRISON_RECALLS_DB_KEY, garrisonRecalls),
      set(LAB_DB_KEY, lab),
      set(LAB_ASSAULTS_DB_KEY, labAssaults),
      set(RESEARCH_DB_KEY, research),
      set(TOMBSTONES_DB_KEY, tombstones),
    ]);

    setBoot((prev) =>
      prev.status === "ready"
        ? {
            ...prev,
            game: {
              player,
              world,
              territory,
              base,
              resources,
              clock,
              extractionTiles,
              pathTiles,
              towers,
              walls,
              barracksList,
              units,
              garrisons,
              scoutedTiles,
              storageLevels,
              storageUpgrades,
              noise,
              dens,
              hordes,
              expeditions,
              gameStatus,
              docks,
              scoutSkiffs,
              wanderingScouts,
              denAssaults,
              outposts,
              garrisonRecalls,
              lab,
              labAssaults,
              research,
              tombstones,
            },
          }
        : prev,
    );
  }

  async function handlePlayerCreated(player: Player, seed?: number) {
    await resetGame(player, seed ?? generateSeed());
  }

  /** Same player AND same world seed — resets progress but replays the identical map, unlike handleStartNewSeed. Reachable from the New Game dialog on both GameScreen and GameOverScreen. */
  async function handleReplayCurrentGame() {
    if (boot.status !== "ready" || !boot.game) return;
    await resetGame(boot.game.player, boot.game.world.seed);
  }

  /** Same player identity, a chosen (freshly-generated or player-entered) world seed. */
  async function handleStartNewSeed(seed: number) {
    if (boot.status !== "ready" || !boot.game) return;
    await resetGame(boot.game.player, seed);
  }

  /** Drops back to onboarding without touching persisted data yet — nothing is actually overwritten until the new player's form is submitted (handlePlayerCreated). */
  function handleNewPlayer() {
    if (boot.status !== "ready" || !boot.game) return;
    setBoot((prev) => (prev.status === "ready" ? { ...prev, game: undefined } : prev));
  }

  async function handleBuildExtractionTile(
    coord: Axial,
    resource: ExtractionTile["resource"],
  ): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    if (!ownedKeys.has(axialKey(coord))) return { ok: false, reason: "Tile not owned" };

    if (axialKey(coord) === axialKey(game.territory.base)) {
      return { ok: false, reason: "Cannot build on the base tile" };
    }

    if (!isBuildableLand(game.world.seed, coord)) {
      return { ok: false, reason: "Cannot build on water" };
    }

    if (isHexOccupied(game, coord)) {
      return { ok: false, reason: "Tile already has a structure" };
    }

    const structureCount = totalStructureCount(
      tweaks,
      game.extractionTiles,
      game.pathTiles,
      game.towers,
      game.walls,
      game.barracksList,
      game.docks,
    );
    if (structureCount >= buildSlotCap(tweaks, game.base.level)) {
      return { ok: false, reason: "Build slot cap reached" };
    }

    const existingOfType = game.extractionTiles.filter((tile) => tile.resource === resource).length;
    const cost = scaledCostMap(tweaks.extraction_tiles[resource].build_cost_base, existingOfType + 1);

    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < amount) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount;
    }
    const extractionTiles = [
      ...game.extractionTiles,
      {
        coord,
        resource,
        tier: "small" as const,
        stockpile: 0,
        totalInvested: cost,
        upgrade: null,
        buildCost: cost,
        damaged: false,
        damageRepair: null,
        buildStartedAt: game.clock.virtualNow,
      },
    ];
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "build_extraction_tile", game.base.level) };

    await Promise.all([
      set(RESOURCES_DB_KEY, resources),
      set(EXTRACTION_TILES_DB_KEY, extractionTiles),
      set(NOISE_DB_KEY, noise),
    ]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? { ...prev, game: { ...prev.game, resources, extractionTiles, noise } }
        : prev,
    );
    return { ok: true };
  }

  async function handleUpgradeExtractionTile(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const tile = game.extractionTiles.find((t) => axialKey(t.coord) === axialKey(coord));
    if (!tile) return { ok: false, reason: "No extraction tile here" };

    if (tile.upgrade) return { ok: false, reason: "Upgrade already in progress" };

    const target = nextTier(tile.tier);
    if (!target) return { ok: false, reason: "Already at max tier" };

    const cost = tierUpgradeCost(tweaks, tile.resource, target);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const extractionTiles = game.extractionTiles.map((t) =>
      axialKey(t.coord) === axialKey(coord)
        ? {
            ...t,
            totalInvested: addToInvestment(t.totalInvested, cost),
            upgrade: { targetTier: target, startedAt: game.clock.virtualNow },
          }
        : t,
    );
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "upgrade_extraction_tile", game.base.level) };

    await Promise.all([
      set(RESOURCES_DB_KEY, resources),
      set(EXTRACTION_TILES_DB_KEY, extractionTiles),
      set(NOISE_DB_KEY, noise),
    ]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? { ...prev, game: { ...prev.game, resources, extractionTiles, noise } }
        : prev,
    );
    return { ok: true };
  }

  async function handleUpgradeStorage(resource: keyof ResourceAmounts): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (game.storageUpgrades[resource as ResourceType]) return { ok: false, reason: "Upgrade already in progress" };

    const currentLevel = game.storageLevels[resource];
    const cost = storageUpgradeCost(tweaks, resource, currentLevel);

    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const storageUpgrades: StorageUpgradesRecord = {
      ...game.storageUpgrades,
      [resource]: { targetLevel: currentLevel + 1, startedAt: game.clock.virtualNow },
    };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(STORAGE_UPGRADES_DB_KEY, storageUpgrades)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? { ...prev, game: { ...prev.game, resources, storageUpgrades } }
        : prev,
    );
    return { ok: true };
  }

  /** Starts research on `id` — single global pending slot, mirrors handleUpgradeStorage above. Sequential-tier gating (tier 3 needs tier 2 completed) is enforced by isResearchAvailable (engine/research.ts). */
  async function handleStartResearch(id: ResearchId): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (game.research.pending) return { ok: false, reason: "Research already in progress" };
    if (!isResearchAvailable(game.research, id)) return { ok: false, reason: "Prerequisite not researched yet" };

    const cost = researchCost(tweaks, id);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const research: ResearchRecord = { ...game.research, pending: { id, startedAt: game.clock.virtualNow } };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(RESEARCH_DB_KEY, research)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, research } } : prev,
    );
    return { ok: true };
  }

  async function handleCollectTile(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const tile = game.extractionTiles.find((t) => axialKey(t.coord) === axialKey(coord));
    if (!tile) return { ok: false, reason: "No extraction tile here" };
    if (tile.stockpile <= 0) return { ok: false, reason: "Nothing to collect" };

    const { resources, tile: collected } = collectTile(tweaks, tile, game.resources, game.storageLevels);
    const extractionTiles = game.extractionTiles.map((t) =>
      axialKey(t.coord) === axialKey(coord) ? collected : t,
    );
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "manual_resource_collection", game.base.level) };

    await Promise.all([
      set(RESOURCES_DB_KEY, resources),
      set(EXTRACTION_TILES_DB_KEY, extractionTiles),
      set(NOISE_DB_KEY, noise),
    ]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? { ...prev, game: { ...prev.game, resources, extractionTiles, noise } }
        : prev,
    );
    return { ok: true };
  }

  /** Docks are owned OR scouted water, not full ownership only — more forgiving than land structures, which all require ownership. */
  async function handleBuildDock(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const claimedKeys = new Set([...game.territory.owned, ...game.scoutedTiles].map(axialKey));
    if (!claimedKeys.has(axialKey(coord))) return { ok: false, reason: "Tile not owned or scouted" };

    if (terrainAt(game.world.seed, coord) !== "water") {
      return { ok: false, reason: "Docks can only be built on water" };
    }
    if (!isTransitionTile(game.world.seed, coord)) {
      return { ok: false, reason: "Docks must be built on water bordering land" };
    }
    if (isHexOccupied(game, coord)) {
      return { ok: false, reason: "Tile already has a structure" };
    }

    const structureCount = totalStructureCount(
      tweaks,
      game.extractionTiles,
      game.pathTiles,
      game.towers,
      game.walls,
      game.barracksList,
      game.docks,
    );
    if (structureCount >= buildSlotCap(tweaks, game.base.level)) {
      return { ok: false, reason: "Build slot cap reached" };
    }

    const cost = dockBuildCost(tweaks, game.docks.length + 1);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < amount) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount;
    }
    const docks: DocksRecord = [
      ...game.docks,
      {
        coord,
        buildStartedAt: game.clock.virtualNow,
        stockpile: 0,
        fishingBoat: false,
        fishingBoatUpgrade: null,
        totalInvested: cost,
        buildCost: cost,
      },
    ];
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "build_dock", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(DOCKS_DB_KEY, docks), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, docks, noise } } : prev,
    );
    return { ok: true };
  }

  async function handleBuildFishingBoat(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const dock = game.docks.find((d) => axialKey(d.coord) === axialKey(coord));
    if (!dock) return { ok: false, reason: "No dock here" };
    if (dock.fishingBoat) return { ok: false, reason: "Fishing boat already built" };
    if (dock.fishingBoatUpgrade) return { ok: false, reason: "Fishing boat already under construction" };

    const cost = tweaks.docks.fishing_boat.cost;
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const docks = game.docks.map((d) =>
      axialKey(d.coord) === axialKey(coord)
        ? {
            ...d,
            totalInvested: addToInvestment(d.totalInvested, cost),
            fishingBoatUpgrade: { startedAt: game.clock.virtualNow },
          }
        : d,
    );
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "build_fishing_boat", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(DOCKS_DB_KEY, docks), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, docks, noise } } : prev,
    );
    return { ok: true };
  }

  async function handleBuildScoutSkiff(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const dock = game.docks.find((d) => axialKey(d.coord) === axialKey(coord));
    if (!dock) return { ok: false, reason: "No dock here" };

    const existingAtDock = game.scoutSkiffs.filter((s) => axialKey(s.homeDockCoord) === axialKey(coord)).length;
    if (existingAtDock >= tweaks.docks.scout_skiff.max_per_dock) {
      return { ok: false, reason: "This dock already has a scout skiff" };
    }

    const cost = tweaks.docks.scout_skiff.cost;
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const scoutSkiffs: ScoutSkiffsRecord = [
      ...game.scoutSkiffs,
      {
        id: `skiff-${axialKey(coord)}-${game.clock.virtualNow}`,
        coord,
        homeDockCoord: coord,
        prevCoord: null,
        spawnedAt: game.clock.virtualNow,
        buildStartedAt: game.clock.virtualNow,
      },
    ];
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "build_scout_skiff", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(SCOUT_SKIFFS_DB_KEY, scoutSkiffs), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, scoutSkiffs, noise } } : prev,
    );
    return { ok: true };
  }

  async function handleCollectDock(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const dock = game.docks.find((d) => axialKey(d.coord) === axialKey(coord));
    if (!dock) return { ok: false, reason: "No dock here" };
    if (dock.stockpile <= 0) return { ok: false, reason: "Nothing to collect" };

    const { resources, dock: collected } = collectDock(tweaks, dock, game.resources, game.storageLevels);
    const docks = game.docks.map((d) => (axialKey(d.coord) === axialKey(coord) ? collected : d));
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "manual_resource_collection", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(DOCKS_DB_KEY, docks), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, docks, noise } } : prev,
    );
    return { ok: true };
  }

  /** Land counterpart of handleBuildScoutSkiff — retires scout_cost regular scouts from the stockpile instead of spending resources, since a trained scout already paid its own train_cost. */
  async function handleBuildWanderingScout(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const barracks = game.barracksList.find((b) => axialKey(b.coord) === axialKey(coord));
    if (!barracks) return { ok: false, reason: "No barracks here" };

    const existingAtBarracks = game.wanderingScouts.filter((s) => axialKey(s.homeBarracksCoord) === axialKey(coord)).length;
    if (existingAtBarracks >= tweaks.units.wandering_scout.max_per_barracks) {
      return { ok: false, reason: "This barracks already has a wandering scout" };
    }

    const scoutCost = tweaks.units.wandering_scout.scout_cost;
    if (game.units.scoutStockpile < scoutCost) {
      return { ok: false, reason: `Not enough scouts (needs ${scoutCost})` };
    }

    const cost = tweaks.units.wandering_scout.cost;
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const units: UnitsRecord = { ...game.units, scoutStockpile: game.units.scoutStockpile - scoutCost };
    const wanderingScouts: WanderingScoutsRecord = [
      ...game.wanderingScouts,
      {
        id: `wandering-scout-${axialKey(coord)}-${game.clock.virtualNow}`,
        coord,
        homeBarracksCoord: coord,
        prevCoord: null,
        spawnedAt: game.clock.virtualNow,
        buildStartedAt: game.clock.virtualNow,
      },
    ];
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "build_wandering_scout", game.base.level) };

    await Promise.all([
      set(RESOURCES_DB_KEY, resources),
      set(UNITS_DB_KEY, units),
      set(WANDERING_SCOUTS_DB_KEY, wanderingScouts),
      set(NOISE_DB_KEY, noise),
    ]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? { ...prev, game: { ...prev.game, resources, units, wanderingScouts, noise } }
        : prev,
    );
    return { ok: true };
  }

  async function handleBuildPath(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    if (!ownedKeys.has(axialKey(coord))) return { ok: false, reason: "Tile not owned" };
    if (axialKey(coord) === axialKey(game.territory.base)) {
      return { ok: false, reason: "Cannot build on the base tile" };
    }
    if (!isBuildableLand(game.world.seed, coord)) {
      return { ok: false, reason: "Cannot build a path on water" };
    }
    if (isHexOccupied(game, coord)) {
      return { ok: false, reason: "Tile already has a structure" };
    }
    const structureCount = totalStructureCount(
      tweaks,
      game.extractionTiles,
      game.pathTiles,
      game.towers,
      game.walls,
      game.barracksList,
      game.docks,
    );
    if (structureCount >= buildSlotCap(tweaks, game.base.level)) {
      return { ok: false, reason: "Build slot cap reached" };
    }

    const cost = pathBuildCost(tweaks);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < amount) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount;
    }
    const pathTiles = [
      ...game.pathTiles,
      {
        coord,
        tier: "goat_track" as const,
        totalInvested: cost,
        upgrade: null,
        buildCost: cost,
        damaged: false,
        damageRepair: null,
        buildStartedAt: game.clock.virtualNow,
      },
    ];
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "build_path_tile", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(PATH_TILES_DB_KEY, pathTiles), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? { ...prev, game: { ...prev.game, resources, pathTiles, noise } }
        : prev,
    );
    return { ok: true };
  }

  async function handleUpgradePath(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const tile = game.pathTiles.find((t) => axialKey(t.coord) === axialKey(coord));
    if (!tile) return { ok: false, reason: "No path here" };

    if (tile.upgrade) return { ok: false, reason: "Upgrade already in progress" };

    const target = nextPathTier(tile.tier);
    if (!target) return { ok: false, reason: "Already at max tier" };

    const cost = pathUpgradeCost(tweaks, target);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const pathTiles = game.pathTiles.map((t) =>
      axialKey(t.coord) === axialKey(coord)
        ? {
            ...t,
            totalInvested: addToInvestment(t.totalInvested, cost),
            upgrade: { targetTier: target, startedAt: game.clock.virtualNow },
          }
        : t,
    );
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "upgrade_infrastructure_tile", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(PATH_TILES_DB_KEY, pathTiles), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? { ...prev, game: { ...prev.game, resources, pathTiles, noise } }
        : prev,
    );
    return { ok: true };
  }

  async function handleBuildTower(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    if (!ownedKeys.has(axialKey(coord))) return { ok: false, reason: "Tile not owned" };
    if (axialKey(coord) === axialKey(game.territory.base)) {
      return { ok: false, reason: "Cannot build on the base tile" };
    }
    if (!isBuildableLand(game.world.seed, coord)) {
      return { ok: false, reason: "Cannot build on water" };
    }
    if (isHexOccupied(game, coord)) {
      return { ok: false, reason: "Tile already has a structure" };
    }
    const structureCount = totalStructureCount(
      tweaks,
      game.extractionTiles,
      game.pathTiles,
      game.towers,
      game.walls,
      game.barracksList,
      game.docks,
    );
    if (structureCount >= buildSlotCap(tweaks, game.base.level)) {
      return { ok: false, reason: "Build slot cap reached" };
    }

    const cost = towerBuildCost(tweaks, game.towers.length + 1);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < amount) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount;
    }
    const towers = [
      ...game.towers,
      {
        coord,
        level: 1,
        totalInvested: cost,
        upgrade: null,
        buildCost: cost,
        damaged: false,
        damageRepair: null,
        buildStartedAt: game.clock.virtualNow,
      },
    ];
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "build_tower", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(TOWERS_DB_KEY, towers), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, towers, noise } } : prev,
    );
    return { ok: true };
  }

  async function handleUpgradeTower(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const tower = game.towers.find((t) => axialKey(t.coord) === axialKey(coord));
    if (!tower) return { ok: false, reason: "No tower here" };

    if (tower.upgrade) return { ok: false, reason: "Upgrade already in progress" };

    const target = nextTowerLevel(tower.level);
    if (!target) return { ok: false, reason: "Already at max level" };

    const cost = towerUpgradeCost(tweaks, target);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const towers = game.towers.map((t) =>
      axialKey(t.coord) === axialKey(coord)
        ? {
            ...t,
            totalInvested: addToInvestment(t.totalInvested, cost),
            upgrade: { targetLevel: target, startedAt: game.clock.virtualNow },
          }
        : t,
    );
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "upgrade_extraction_tile", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(TOWERS_DB_KEY, towers), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, towers, noise } } : prev,
    );
    return { ok: true };
  }

  async function handleBuildWall(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    if (!ownedKeys.has(axialKey(coord))) return { ok: false, reason: "Tile not owned" };
    if (axialKey(coord) === axialKey(game.territory.base)) {
      return { ok: false, reason: "Cannot build on the base tile" };
    }
    if (!isBuildableLand(game.world.seed, coord)) {
      return { ok: false, reason: "Cannot build on water" };
    }
    if (isHexOccupied(game, coord)) {
      return { ok: false, reason: "Tile already has a structure" };
    }
    const structureCount = totalStructureCount(
      tweaks,
      game.extractionTiles,
      game.pathTiles,
      game.towers,
      game.walls,
      game.barracksList,
      game.docks,
    );
    if (structureCount >= buildSlotCap(tweaks, game.base.level)) {
      return { ok: false, reason: "Build slot cap reached" };
    }

    const cost = wallBuildCost(tweaks, game.walls.length + 1);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < amount) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount;
    }
    const walls = [
      ...game.walls,
      {
        coord,
        tier: "wood" as const,
        durability: maxWallDurability(tweaks, "wood"),
        totalInvested: cost,
        action: null,
        buildCost: cost,
        damaged: false,
        damageRepair: null,
        buildStartedAt: game.clock.virtualNow,
      },
    ];
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "build_wall", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(WALLS_DB_KEY, walls), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, walls, noise } } : prev,
    );
    return { ok: true };
  }

  async function handleUpgradeWall(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const wall = game.walls.find((w) => axialKey(w.coord) === axialKey(coord));
    if (!wall) return { ok: false, reason: "No wall here" };

    if (wall.action) return { ok: false, reason: "Already busy (upgrade or repair in progress)" };

    const target = nextWallTier(wall.tier);
    if (!target) return { ok: false, reason: "Already at max tier" };

    const cost = wallUpgradeCost(tweaks, target);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const walls = game.walls.map((w) =>
      axialKey(w.coord) === axialKey(coord)
        ? {
            ...w,
            totalInvested: addToInvestment(w.totalInvested, cost),
            action: { kind: "upgrade" as const, targetTier: target, startedAt: game.clock.virtualNow },
          }
        : w,
    );
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "upgrade_extraction_tile", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(WALLS_DB_KEY, walls), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, walls, noise } } : prev,
    );
    return { ok: true };
  }

  async function handleRepairWall(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const wall = game.walls.find((w) => axialKey(w.coord) === axialKey(coord));
    if (!wall) return { ok: false, reason: "No wall here" };

    if (wall.action) return { ok: false, reason: "Already busy (upgrade or repair in progress)" };

    const maxHp = maxWallDurability(tweaks, wall.tier);
    if (wall.durability >= maxHp) return { ok: false, reason: "Already at full durability" };
    // Peacetime-only gate (ROADMAP M8) — no hordes exist yet (Milestone 9), so it's always peacetime for now.

    const cost = wallRepairCost(wall, maxHp);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const walls = game.walls.map((w) =>
      axialKey(w.coord) === axialKey(coord)
        ? {
            ...w,
            totalInvested: addToInvestment(w.totalInvested, cost),
            action: { kind: "repair" as const, startedAt: game.clock.virtualNow },
          }
        : w,
    );
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "repair_wall", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(WALLS_DB_KEY, walls), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, walls, noise } } : prev,
    );
    return { ok: true };
  }

  async function handleDemolish(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;
    const key = axialKey(coord);

    const extractionTile = game.extractionTiles.find((t) => axialKey(t.coord) === key);
    const pathTile = game.pathTiles.find((t) => axialKey(t.coord) === key);
    const tower = game.towers.find((t) => axialKey(t.coord) === key);
    const wall = game.walls.find((t) => axialKey(t.coord) === key);
    const barracks = game.barracksList.find((t) => axialKey(t.coord) === key);
    const dock = game.docks.find((t) => axialKey(t.coord) === key);
    const structure = extractionTile ?? pathTile ?? tower ?? wall ?? barracks ?? dock;
    if (!structure) return { ok: false, reason: "Nothing to demolish here" };

    const refund = demolishRefund(tweaks, structure.totalInvested);
    const resources = { ...game.resources };
    for (const [resKey, amount] of Object.entries(refund)) {
      const typedKey = resKey as ResourceType;
      const cap = storageCapacity(tweaks, game.storageLevels[typedKey]);
      resources[typedKey] = Math.min(cap, resources[typedKey] + (amount ?? 0));
    }

    const extractionTiles = extractionTile
      ? game.extractionTiles.filter((t) => axialKey(t.coord) !== key)
      : game.extractionTiles;
    const pathTiles = pathTile ? game.pathTiles.filter((t) => axialKey(t.coord) !== key) : game.pathTiles;
    const towers = tower ? game.towers.filter((t) => axialKey(t.coord) !== key) : game.towers;
    const walls = wall ? game.walls.filter((t) => axialKey(t.coord) !== key) : game.walls;
    const barracksList = barracks
      ? game.barracksList.filter((t) => axialKey(t.coord) !== key)
      : game.barracksList;
    // A demolished dock takes any scout skiff based there with it — a skiff
    // with no home dock left makes no sense to keep wandering.
    const docks = dock ? game.docks.filter((t) => axialKey(t.coord) !== key) : game.docks;
    const scoutSkiffs = dock
      ? game.scoutSkiffs.filter((s) => axialKey(s.homeDockCoord) !== key)
      : game.scoutSkiffs;

    await Promise.all([
      set(RESOURCES_DB_KEY, resources),
      set(EXTRACTION_TILES_DB_KEY, extractionTiles),
      set(PATH_TILES_DB_KEY, pathTiles),
      set(TOWERS_DB_KEY, towers),
      set(WALLS_DB_KEY, walls),
      set(BARRACKS_DB_KEY, barracksList),
      set(DOCKS_DB_KEY, docks),
      set(SCOUT_SKIFFS_DB_KEY, scoutSkiffs),
    ]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? { ...prev, game: { ...prev.game, resources, extractionTiles, pathTiles, towers, walls, barracksList, docks, scoutSkiffs } }
        : prev,
    );
    return { ok: true };
  }

  /**
   * Restores a structure a horde captured and the player has since reclaimed
   * — DESIGN.md §12. Distinct from handleRepairWall (that's wall-durability
   * HP restoration, an unrelated pre-existing mechanic); this starts a timer
   * (structureRepairDurationMs, engine/formulas.ts) that clears the `damaged`
   * flag set by markCapturedStructuresDamaged (engine/hordes.ts) — for any of
   * the five structure kinds — once it completes (runTick), at repairCost's
   * 50%-of-original-build-cost price (engine/formulas.ts), paid upfront.
   */
  async function handleRepairStructure(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;
    const key = axialKey(coord);

    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    if (!ownedKeys.has(key)) return { ok: false, reason: "Tile not owned" };

    // A tile can be back in territory.owned (via an expedition claiming it —
    // engine/expeditions.ts, unlike the tower viewshed auto-claim, doesn't
    // check for a live horde) while a horde is still physically standing on
    // it. Repairing a structure a horde is actively occupying makes no sense —
    // it'd just get re-captured/re-damaged, so the horde has to be cleared
    // first (auto-attack from a garrison, or a tower/wall/base fight).
    const hordeOccupiedKeys = new Set(game.hordes.map((h) => axialKey(h.path[h.pathIndex])));
    if (hordeOccupiedKeys.has(key)) return { ok: false, reason: "A horde is still on this tile" };

    const extractionTile = game.extractionTiles.find((t) => axialKey(t.coord) === key);
    const pathTile = game.pathTiles.find((t) => axialKey(t.coord) === key);
    const tower = game.towers.find((t) => axialKey(t.coord) === key);
    const wall = game.walls.find((t) => axialKey(t.coord) === key);
    const barracks = game.barracksList.find((t) => axialKey(t.coord) === key);
    const structure = extractionTile ?? pathTile ?? tower ?? wall ?? barracks;
    if (!structure) return { ok: false, reason: "Nothing to repair here" };
    if (!structure.damaged) return { ok: false, reason: "Not damaged" };
    if (structure.damageRepair) return { ok: false, reason: "Repair already in progress" };

    const cost = repairCost(tweaks, structure.buildCost);
    for (const [resKey, amount] of Object.entries(cost)) {
      if (game.resources[resKey as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${resKey}` };
      }
    }

    const resources = { ...game.resources };
    for (const [resKey, amount] of Object.entries(cost)) {
      resources[resKey as keyof ResourceAmounts] -= amount ?? 0;
    }

    const repair = <
      T extends {
        coord: Axial;
        damaged: boolean;
        damageRepair?: { startedAt: number } | null;
        totalInvested: Partial<Record<ResourceType, number>>;
      },
    >(
      list: T[],
    ): T[] =>
      list.map((t) =>
        axialKey(t.coord) === key
          ? {
              ...t,
              damageRepair: { startedAt: game.clock.virtualNow },
              totalInvested: addToInvestment(t.totalInvested, cost),
            }
          : t,
      );

    const extractionTiles = extractionTile ? repair(game.extractionTiles) : game.extractionTiles;
    const pathTiles = pathTile ? repair(game.pathTiles) : game.pathTiles;
    const towers = tower ? repair(game.towers) : game.towers;
    const walls = wall ? repair(game.walls) : game.walls;
    const barracksList = barracks ? repair(game.barracksList) : game.barracksList;
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "repair_wall", game.base.level) };

    await Promise.all([
      set(RESOURCES_DB_KEY, resources),
      set(EXTRACTION_TILES_DB_KEY, extractionTiles),
      set(PATH_TILES_DB_KEY, pathTiles),
      set(TOWERS_DB_KEY, towers),
      set(WALLS_DB_KEY, walls),
      set(BARRACKS_DB_KEY, barracksList),
      set(NOISE_DB_KEY, noise),
    ]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? { ...prev, game: { ...prev.game, resources, extractionTiles, pathTiles, towers, walls, barracksList, noise } }
        : prev,
    );
    return { ok: true };
  }

  async function handleBuildBarracks(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    if (!ownedKeys.has(axialKey(coord))) return { ok: false, reason: "Tile not owned" };
    if (axialKey(coord) === axialKey(game.territory.base)) {
      return { ok: false, reason: "Cannot build on the base tile" };
    }
    if (!isBuildableLand(game.world.seed, coord)) {
      return { ok: false, reason: "Cannot build on water" };
    }
    if (isHexOccupied(game, coord)) {
      return { ok: false, reason: "Tile already has a structure" };
    }
    const structureCount = totalStructureCount(
      tweaks,
      game.extractionTiles,
      game.pathTiles,
      game.towers,
      game.walls,
      game.barracksList,
      game.docks,
    );
    if (structureCount >= buildSlotCap(tweaks, game.base.level)) {
      return { ok: false, reason: "Build slot cap reached" };
    }

    const cost = barracksBuildCost(tweaks, game.barracksList.length + 1);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < amount) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount;
    }
    const barracksList = [
      ...game.barracksList,
      {
        coord,
        level: 1,
        totalInvested: cost,
        upgrade: null,
        buildCost: cost,
        damaged: false,
        damageRepair: null,
        buildStartedAt: game.clock.virtualNow,
      },
    ];
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "build_barracks", game.base.level) };

    await Promise.all([
      set(RESOURCES_DB_KEY, resources),
      set(BARRACKS_DB_KEY, barracksList),
      set(NOISE_DB_KEY, noise),
    ]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? { ...prev, game: { ...prev.game, resources, barracksList, noise } }
        : prev,
    );
    return { ok: true };
  }

  async function handleUpgradeBarracks(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const barracks = game.barracksList.find((b) => axialKey(b.coord) === axialKey(coord));
    if (!barracks) return { ok: false, reason: "No barracks here" };

    if (barracks.upgrade) return { ok: false, reason: "Upgrade already in progress" };

    const target = nextBarracksLevel(barracks.level);
    if (!target) return { ok: false, reason: "Already at max level" };

    const cost = barracksUpgradeCost(tweaks, target);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const barracksList = game.barracksList.map((b) =>
      axialKey(b.coord) === axialKey(coord)
        ? {
            ...b,
            totalInvested: addToInvestment(b.totalInvested, cost),
            upgrade: { targetLevel: target, startedAt: game.clock.virtualNow },
          }
        : b,
    );
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "upgrade_extraction_tile", game.base.level) };

    await Promise.all([
      set(RESOURCES_DB_KEY, resources),
      set(BARRACKS_DB_KEY, barracksList),
      set(NOISE_DB_KEY, noise),
    ]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? { ...prev, game: { ...prev.game, resources, barracksList, noise } }
        : prev,
    );
    return { ok: true };
  }

  async function handleTrainScouts(quantity: number): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: "Invalid quantity" };
    if (game.units.scoutQueue) return { ok: false, reason: "Training already in progress" };

    const capacity = scoutCapacity(tweaks, game.barracksList);
    if (game.units.scoutStockpile + quantity > capacity) return { ok: false, reason: "Not enough scout capacity" };

    const perUnitCost = scoutTrainCost(tweaks);
    const cost: Record<string, number> = {};
    for (const [key, amount] of Object.entries(perUnitCost)) cost[key] = amount * quantity;
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < amount) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount;
    }
    const units: UnitsRecord = {
      ...game.units,
      scoutQueue: { remaining: quantity, currentUnitStartedAt: game.clock.virtualNow },
    };
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "train_scout", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(UNITS_DB_KEY, units), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, units, noise } } : prev,
    );
    return { ok: true };
  }

  async function handleTrainMilitia(quantity: number): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: "Invalid quantity" };
    if (game.units.militiaQueue) return { ok: false, reason: "Training already in progress" };

    const capacity = militiaCapacity(tweaks, game.barracksList);
    if (game.units.militiaCount + quantity > capacity) return { ok: false, reason: "Not enough militia capacity" };

    const perUnitCost = militiaTrainCost(tweaks);
    const cost: Record<string, number> = {};
    for (const [key, amount] of Object.entries(perUnitCost)) cost[key] = amount * quantity;
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < amount) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount;
    }
    const units: UnitsRecord = {
      ...game.units,
      militiaQueue: { remaining: quantity, currentUnitStartedAt: game.clock.virtualNow },
    };
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "train_militia", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(UNITS_DB_KEY, units), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, units, noise } } : prev,
    );
    return { ok: true };
  }

  /** Mirrors handleTrainMilitia exactly, gated by junkyardKnightCapacity's barracks L2 level gate — see engine/barracks.ts. No rush-train variant (calm queue only). */
  async function handleTrainJunkyardKnight(quantity: number): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: "Invalid quantity" };
    if (game.units.junkyardKnightQueue) return { ok: false, reason: "Training already in progress" };

    const capacity = junkyardKnightCapacity(tweaks, game.barracksList);
    if (game.units.junkyardKnightCount + quantity > capacity) {
      return { ok: false, reason: "Not enough junkyard knight capacity" };
    }

    const perUnitCost = junkyardKnightTrainCost(tweaks);
    const cost: Record<string, number> = {};
    for (const [key, amount] of Object.entries(perUnitCost)) cost[key] = amount * quantity;
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < amount) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount;
    }
    const units: UnitsRecord = {
      ...game.units,
      junkyardKnightQueue: { remaining: quantity, currentUnitStartedAt: game.clock.virtualNow },
    };
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "train_militia", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(UNITS_DB_KEY, units), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, units, noise } } : prev,
    );
    return { ok: true };
  }

  /** Mirrors handleTrainMilitia exactly, gated by crossBowSniperCapacity's barracks L3 level gate — see engine/barracks.ts. No rush-train variant (calm queue only). */
  async function handleTrainCrossBowSniper(quantity: number): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: "Invalid quantity" };
    if (game.units.crossBowSniperQueue) return { ok: false, reason: "Training already in progress" };

    const capacity = crossBowSniperCapacity(tweaks, game.barracksList);
    if (game.units.crossBowSniperCount + quantity > capacity) {
      return { ok: false, reason: "Not enough cross-bow sniper capacity" };
    }

    const perUnitCost = crossBowSniperTrainCost(tweaks);
    const cost: Record<string, number> = {};
    for (const [key, amount] of Object.entries(perUnitCost)) cost[key] = amount * quantity;
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < amount) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount;
    }
    const units: UnitsRecord = {
      ...game.units,
      crossBowSniperQueue: { remaining: quantity, currentUnitStartedAt: game.clock.virtualNow },
    };
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "train_militia", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(UNITS_DB_KEY, units), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, units, noise } } : prev,
    );
    return { ok: true };
  }

  /**
   * Rush training — delivers immediately, no queue/timer at all, at the same
   * resource cost as calm training. The tradeoff is noise, not resources:
   * addActionNoise's multiplier scales the spike by quantity (every other
   * one-time action is a flat spike regardless of how much you did), so
   * rushing a handful of units is loud and rushing a big batch is a full
   * commotion — "very noisy" per playtesting discussion, unlike the queued
   * path's barely-audible train_scout/train_militia.
   */
  async function handleRushTrainScouts(quantity: number): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: "Invalid quantity" };

    const capacity = scoutCapacity(tweaks, game.barracksList);
    if (game.units.scoutStockpile + quantity > capacity) return { ok: false, reason: "Not enough scout capacity" };

    const perUnitCost = scoutTrainCost(tweaks);
    const cost: Record<string, number> = {};
    for (const [key, amount] of Object.entries(perUnitCost)) cost[key] = amount * quantity;
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < amount) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount;
    }
    const units: UnitsRecord = { ...game.units, scoutStockpile: game.units.scoutStockpile + quantity };
    const noise: NoiseRecord = {
      value: addActionNoise(tweaks, game.noise.value, "rush_train_scout", game.base.level, quantity),
    };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(UNITS_DB_KEY, units), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, units, noise } } : prev,
    );
    return { ok: true };
  }

  async function handleRushTrainMilitia(quantity: number): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: "Invalid quantity" };

    const capacity = militiaCapacity(tweaks, game.barracksList);
    if (game.units.militiaCount + quantity > capacity) return { ok: false, reason: "Not enough militia capacity" };

    const perUnitCost = militiaTrainCost(tweaks);
    const cost: Record<string, number> = {};
    for (const [key, amount] of Object.entries(perUnitCost)) cost[key] = amount * quantity;
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < amount) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount;
    }
    const units: UnitsRecord = { ...game.units, militiaCount: game.units.militiaCount + quantity };
    const noise: NoiseRecord = {
      value: addActionNoise(tweaks, game.noise.value, "rush_train_militia", game.base.level, quantity),
    };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(UNITS_DB_KEY, units), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, units, noise } } : prev,
    );
    return { ok: true };
  }

  async function handleScoutTile(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    if (ownedKeys.has(axialKey(coord))) return { ok: false, reason: "Already owned" };
    if (game.scoutedTiles.some((c) => axialKey(c) === axialKey(coord))) {
      return { ok: false, reason: "Already scouted" };
    }
    if (!isTileScoutable(game.world.seed, coord, game.territory.owned, game.scoutedTiles)) {
      return {
        ok: false,
        reason: "Not scoutable — must be adjacent to owned or already-scouted land (no crossing water)",
      };
    }
    if (game.units.scoutStockpile <= 0) return { ok: false, reason: "No scout units available" };

    const units: UnitsRecord = { ...game.units, scoutStockpile: game.units.scoutStockpile - 1 };
    const scoutedTiles = [...game.scoutedTiles, coord];

    // Passive lab-clue roll (DESIGN.md §13) — deterministic per scout action,
    // capped at total_clues (guaranteed den-clear clues, App.tsx's tick loop,
    // can also fill the count independently).
    let lab: LabRecord = game.lab;
    if (
      game.lab.cluesCollected < tweaks.lab_clues.total_clues &&
      rollScoutClue(tweaks, game.world.seed, coord, game.scoutedTiles.length)
    ) {
      lab = { ...game.lab, cluesCollected: game.lab.cluesCollected + 1 };
      const clueText = labClueText(lab.cluesCollected, game.territory.base, lab.coord);
      pushToast({ message: `New lab clue (${lab.cluesCollected}/${tweaks.lab_clues.total_clues}): ${clueText}` });
    }

    await Promise.all([set(UNITS_DB_KEY, units), set(SCOUTED_TILES_DB_KEY, scoutedTiles), set(LAB_DB_KEY, lab)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, units, scoutedTiles, lab } } : prev,
    );
    return { ok: true };
  }

  async function handleUpgradeBase(): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (game.base.upgrade) return { ok: false, reason: "Upgrade already in progress" };

    const targetLevel = game.base.level + 1;
    const cost = baseUpgradeCost(tweaks, targetLevel);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const base: BaseRecord = {
      ...game.base,
      upgrade: { targetLevel, startedAt: game.clock.virtualNow },
    };
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "upgrade_extraction_tile", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(BASE_DB_KEY, base), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, base, noise } } : prev,
    );
    return { ok: true };
  }

  /**
   * Reinforcement HP (DESIGN.md §9/§13) upgrade, capped by base level
   * (maxReinforcementLevel) — timed like every other upgrade (engine/base.ts:
   * baseReinforcementUpgradeDurationMs), sharing one in-progress slot with
   * handleRepairBase (reinforcementAction) so only one can run at a time.
   * Applied by runTick once the timer completes, which also fully restores
   * base.currentHp to the new max — an upgrade doubles as a full repair, so
   * damage never has to be dealt with twice.
   */
  async function handleUpgradeReinforcement(): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (game.base.reinforcementAction) return { ok: false, reason: "Already busy (upgrade or repair in progress)" };

    const targetLevel = game.base.reinforcementLevel + 1;
    if (targetLevel > maxReinforcementLevel(game.base.level)) {
      return { ok: false, reason: "Reinforcement is capped by base level — upgrade the base first" };
    }

    const cost = reinforcementUpgradeCost(tweaks, targetLevel);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const base: BaseRecord = {
      ...game.base,
      reinforcementAction: { kind: "upgrade", targetLevel, startedAt: game.clock.virtualNow },
    };
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "upgrade_extraction_tile", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(BASE_DB_KEY, base), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, base, noise } } : prev,
    );
    return { ok: true };
  }

  /**
   * Repairs base.currentHp back to max — cost scales with how much is
   * missing (engine/base.ts:baseRepairCost), timed like every other repair
   * (baseReinforcementRepairDurationMs), sharing reinforcementAction's single
   * in-progress slot with handleUpgradeReinforcement. Blocked while a horde
   * is still adjacent to the base, same reasoning as handleRepairStructure's
   * hordeOccupiedKeys guard: repairing mid-assault would just get chipped
   * straight back down.
   */
  async function handleRepairBase(): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (game.base.reinforcementAction) return { ok: false, reason: "Already busy (upgrade or repair in progress)" };

    const maxHp = baseReinforcementHp(tweaks, game.base.reinforcementLevel);
    if (game.base.currentHp >= maxHp) return { ok: false, reason: "Not damaged" };

    const baseAdjacentHorde = game.hordes.some(
      (h) => axialDistance(h.path[h.pathIndex], game.territory.base) <= 1,
    );
    if (baseAdjacentHorde) return { ok: false, reason: "A horde is still nearby" };

    const cost = baseRepairCost(tweaks, game.base.currentHp, maxHp, game.base.reinforcementLevel);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const base: BaseRecord = {
      ...game.base,
      reinforcementAction: { kind: "repair", startedAt: game.clock.virtualNow },
    };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(BASE_DB_KEY, base)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, base } } : prev,
    );
    return { ok: true };
  }

  /**
   * Outpost-scoped version of handleUpgradeReinforcement — timed, capped by
   * the player's base level (maxOutpostReinforcementLevel, engine/outposts.ts),
   * same as the main base's track. Paid from the shared main resource pool,
   * same as every other action — an outpost's connected tiles feed that same
   * pool (engine/tick.ts:accrueResources), so there's no separate stockpile
   * to draw from.
   */
  async function handleUpgradeOutpostReinforcement(outpostId: string): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const outpost = game.outposts.find((o) => o.id === outpostId);
    if (!outpost) return { ok: false, reason: "Outpost not found" };
    if (outpost.reinforcementAction) return { ok: false, reason: "Already busy (upgrade or repair in progress)" };

    const targetLevel = outpost.reinforcementLevel + 1;
    if (targetLevel > maxOutpostReinforcementLevel(game.base.level)) {
      return { ok: false, reason: "Reinforcement is capped by base level — upgrade the base first" };
    }

    const cost = outpostReinforcementUpgradeCost(tweaks, targetLevel);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const outposts: OutpostsRecord = game.outposts.map((o) =>
      o.id === outpostId
        ? { ...o, reinforcementAction: { kind: "upgrade", targetLevel, startedAt: game.clock.virtualNow } }
        : o,
    );

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(OUTPOSTS_DB_KEY, outposts)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, outposts } } : prev,
    );
    return { ok: true };
  }

  /**
   * Outpost-scoped version of handleRepairBase — cost scales with how much
   * HP is missing (engine/outposts.ts:outpostRepairCost), timed
   * (outpostReinforcementRepairDurationMs), paid from the shared main
   * resource pool (see handleUpgradeOutpostReinforcement), blocked while a
   * horde is still adjacent, same reasoning as the base.
   */
  async function handleRepairOutpost(outpostId: string): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const outpost = game.outposts.find((o) => o.id === outpostId);
    if (!outpost) return { ok: false, reason: "Outpost not found" };
    if (outpost.reinforcementAction) return { ok: false, reason: "Already busy (upgrade or repair in progress)" };

    const maxHp = outpostReinforcementHp(tweaks, outpost.reinforcementLevel);
    if (outpost.currentHp >= maxHp) return { ok: false, reason: "Not damaged" };

    const outpostAdjacentHorde = game.hordes.some((h) => axialDistance(h.path[h.pathIndex], outpost.coord) <= 1);
    if (outpostAdjacentHorde) return { ok: false, reason: "A horde is still nearby" };

    const cost = outpostRepairCost(tweaks, outpost.currentHp, maxHp, outpost.reinforcementLevel);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const outposts: OutpostsRecord = game.outposts.map((o) =>
      o.id === outpostId ? { ...o, reinforcementAction: { kind: "repair", startedAt: game.clock.virtualNow } } : o,
    );

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(OUTPOSTS_DB_KEY, outposts)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, outposts } } : prev,
    );
    return { ok: true };
  }

  /**
   * Starts a base relocation countdown — territory.base moves to
   * `destination` once it completes (runTick, engine/base.ts:
   * isBaseRelocationComplete). Everything else (structures, garrisons, dens)
   * stays exactly where it is — only the base coordinate moves. Available
   * once base.level reaches tweaks.base_relocation.min_base_level; the
   * countdown itself (cost/duration both scale with distance) is the
   * anti-abuse mechanism that keeps this from being usable to instantly
   * dodge an oncoming horde.
   */
  async function handleRelocateBase(destination: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (!canRelocateBase(tweaks, game.base.level)) {
      return { ok: false, reason: `Requires base level ${tweaks.base_relocation.min_base_level}` };
    }
    if (game.base.relocation) return { ok: false, reason: "Relocation already in progress" };
    if (axialKey(destination) === axialKey(game.territory.base)) {
      return { ok: false, reason: "Already your base" };
    }
    if (!isWithinMapBounds(destination, tweaks.game.grid_size)) return { ok: false, reason: "Out of bounds" };

    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    const scoutedKeys = new Set(game.scoutedTiles.map(axialKey));
    const key = axialKey(destination);
    if (!ownedKeys.has(key) && !scoutedKeys.has(key)) {
      return { ok: false, reason: "Unknown ground — scout it first" };
    }
    if (terrainAt(game.world.seed, destination) === "water") {
      return { ok: false, reason: "Can't relocate onto water" };
    }
    if (isHexOccupied(game, destination)) {
      return { ok: false, reason: "Tile isn't empty" };
    }

    const distance = axialDistance(game.territory.base, destination);
    const cost = baseRelocationCost(tweaks, distance);
    for (const [resKey, amount] of Object.entries(cost)) {
      if (game.resources[resKey as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${resKey}` };
      }
    }

    const resources = { ...game.resources };
    for (const [resKey, amount] of Object.entries(cost)) {
      resources[resKey as keyof ResourceAmounts] -= amount ?? 0;
    }
    const base: BaseRecord = { ...game.base, relocation: { destination, startedAt: game.clock.virtualNow } };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(BASE_DB_KEY, base)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, base } } : prev,
    );
    return { ok: true };
  }

  /**
   * Dispatches a party to fight its way to `target` along the cheapest route
   * from any non-damaged barracks, through owned-or-scouted ground only
   * (engine/expeditions.ts:findBestExpeditionRoute) — replaces the old
   * one-ring-at-a-time instant tile attack entirely (tweaks.jsonc
   * territory_expansion's 2026-07-19 correction note). Provisions are paid
   * upfront, same convention as training costs; the fight itself doesn't
   * happen here — it resolves later in the tick loop once travel time
   * elapses (runTick, above), so a successful return only confirms the
   * party departed, not whether it survives the trip.
   */
  async function handleDispatchExpedition(
    target: Axial,
    militiaCommitted: number,
    junkyardKnightCommitted: number,
    crossBowSniperCommitted: number,
  ): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (!isWithinMapBounds(target, tweaks.game.grid_size)) return { ok: false, reason: "Out of bounds" };

    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    if (ownedKeys.has(axialKey(target))) return { ok: false, reason: "Already owned" };
    // A den isn't ordinary territory — it must be sieged (handleAssaultDen),
    // not claimed via the much weaker generic tileDefense an expedition uses.
    if (game.dens.some((d) => axialKey(d.coord) === axialKey(target))) {
      return { ok: false, reason: "A den stands here — assault it instead" };
    }
    // Same reasoning for the lab — it's guarded by a static defender far
    // beyond tileDefense, not ordinary unowned territory (handleSecureLab).
    if (axialKey(game.lab.coord) === axialKey(target)) {
      return { ok: false, reason: "The lab is guarded — assault it instead" };
    }

    const route = findBestExpeditionRoute(
      tweaks,
      game.world.seed,
      game.barracksList,
      game.towers,
      game.outposts,
      game.territory,
      game.scoutedTiles,
      tweaks.game.grid_size,
      target,
    );
    if (!route) {
      return { ok: false, reason: "No known route — scout a path there, and make sure you have a barracks" };
    }

    // Same reasoning as handleRepairStructure/handleGarrisonMilitia's
    // hordeOccupiedKeys guards — committing a party to a route a horde is
    // already standing on is a fight already effectively lost.
    const hordeOccupiedKeys = new Set(game.hordes.map((h) => axialKey(h.path[h.pathIndex])));
    if (route.path.some((tile) => hordeOccupiedKeys.has(axialKey(tile)))) {
      return { ok: false, reason: "A horde blocks this route" };
    }

    const partySize = militiaCommitted + junkyardKnightCommitted + crossBowSniperCommitted;
    const countsValid =
      Number.isInteger(militiaCommitted) &&
      militiaCommitted >= 0 &&
      militiaCommitted <= availableMilitia(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults) &&
      Number.isInteger(junkyardKnightCommitted) &&
      junkyardKnightCommitted >= 0 &&
      junkyardKnightCommitted <= availableJunkyardKnights(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults) &&
      Number.isInteger(crossBowSniperCommitted) &&
      crossBowSniperCommitted >= 0 &&
      crossBowSniperCommitted <= availableCrossBowSnipers(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults);
    if (!countsValid) return { ok: false, reason: "Invalid unit counts" };
    if (partySize <= 0) return { ok: false, reason: "Commit at least one unit" };

    const provisionsCost = expeditionProvisionsCost(tweaks, partySize, route.cost);
    if (game.resources.food < provisionsCost) return { ok: false, reason: "Not enough food" };

    const resources = { ...game.resources, food: game.resources.food - provisionsCost };
    const departedAt = game.clock.virtualNow;
    const expedition: Expedition = {
      id: `expedition-${axialKey(target)}-${departedAt}`,
      target,
      path: route.path,
      militiaCommitted,
      junkyardKnightCommitted,
      crossBowSniperCommitted,
      departedAt,
      arriveAt: departedAt + expeditionTravelDurationMs(tweaks, route.cost, troopSpeedMultiplier(tweaks, game.research)),
      resolvedIndex: 0,
    };
    const expeditions: ExpeditionsRecord = [...game.expeditions, expedition];

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(EXPEDITIONS_DB_KEY, expeditions)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, expeditions } } : prev,
    );
    return { ok: true };
  }

  /**
   * Commits a party at a den — mirrors handleDispatchExpedition closely
   * (same route-finding, availability, and provisions-cost shape), but the
   * target is a den (not an unowned map tile). Dispatch is allowed whether
   * the den is currently hostile OR already under siege — the tick loop
   * resolution (App.tsx) decides at *arrival* time whether this is a real
   * assault (den still hostile: fight it, proportional attrition on a win)
   * or a reinforcement (den already besieged, or since converted to an
   * outpost: no fight, the party just joins the garrison there) — see
   * data/denAssaults.ts and the tick loop's den-assault comment.
   */
  async function handleAssaultDen(
    denId: string,
    militiaCommitted: number,
    junkyardKnightCommitted: number,
    crossBowSniperCommitted: number,
  ): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const den = game.dens.find((d) => d.id === denId);
    if (!den) return { ok: false, reason: "No den here" };
    if (game.denAssaults.some((a) => a.denId === denId)) return { ok: false, reason: "A party is already en route" };

    const route = findBestExpeditionRoute(
      tweaks,
      game.world.seed,
      game.barracksList,
      game.towers,
      game.outposts,
      game.territory,
      game.scoutedTiles,
      tweaks.game.grid_size,
      den.coord,
    );
    if (!route) {
      return { ok: false, reason: "No known route — scout the den, and make sure you have a barracks" };
    }

    const hordeOccupiedKeys = new Set(game.hordes.map((h) => axialKey(h.path[h.pathIndex])));
    if (route.path.some((tile) => hordeOccupiedKeys.has(axialKey(tile)))) {
      return { ok: false, reason: "A horde blocks this route" };
    }

    const partySize = militiaCommitted + junkyardKnightCommitted + crossBowSniperCommitted;
    const countsValid =
      Number.isInteger(militiaCommitted) &&
      militiaCommitted >= 0 &&
      militiaCommitted <= availableMilitia(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults) &&
      Number.isInteger(junkyardKnightCommitted) &&
      junkyardKnightCommitted >= 0 &&
      junkyardKnightCommitted <= availableJunkyardKnights(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults) &&
      Number.isInteger(crossBowSniperCommitted) &&
      crossBowSniperCommitted >= 0 &&
      crossBowSniperCommitted <= availableCrossBowSnipers(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults);
    if (!countsValid) return { ok: false, reason: "Invalid unit counts" };
    if (partySize <= 0) return { ok: false, reason: "Commit at least one unit" };

    const provisionsCost = expeditionProvisionsCost(tweaks, partySize, route.cost);
    if (game.resources.food < provisionsCost) return { ok: false, reason: "Not enough food" };

    const resources = { ...game.resources, food: game.resources.food - provisionsCost };
    const departedAt = game.clock.virtualNow;
    const assault: DenAssaultRecord = {
      id: `denAssault-${denId}-${departedAt}`,
      denId,
      target: den.coord,
      path: route.path,
      militiaCommitted,
      junkyardKnightCommitted,
      crossBowSniperCommitted,
      departedAt,
      arriveAt: departedAt + expeditionTravelDurationMs(tweaks, route.cost, troopSpeedMultiplier(tweaks, game.research)),
      resolvedIndex: 0,
    };
    const denAssaults: DenAssaultsRecord = [...game.denAssaults, assault];

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(DEN_ASSAULTS_DB_KEY, denAssaults)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, denAssaults } } : prev,
    );
    return { ok: true };
  }

  /**
   * Commits a party at the hidden lab — mirrors handleAssaultDen closely
   * (same route-finding, availability, and provisions-cost shape), but
   * there's only ever one lab and no siege/hold period: the tick loop
   * (App.tsx) resolves this as a single all-or-nothing fight against the
   * static guardian (engine/lab.ts:resolveLabAssault) once the party
   * survives the corridor leading up to it. findBestExpeditionRoute's
   * allowedTiles gate (owned ∪ scouted) means the lab must already be
   * scouted for a route to exist at all — this is what "hidden" cashes out
   * to (DESIGN.md §13).
   */
  async function handleSecureLab(
    militiaCommitted: number,
    junkyardKnightCommitted: number,
    crossBowSniperCommitted: number,
  ): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (game.lab.secured) return { ok: false, reason: "The lab is already secured" };
    if (game.labAssaults.length > 0) return { ok: false, reason: "A party is already en route" };

    const route = findBestExpeditionRoute(
      tweaks,
      game.world.seed,
      game.barracksList,
      game.towers,
      game.outposts,
      game.territory,
      game.scoutedTiles,
      tweaks.game.grid_size,
      game.lab.coord,
    );
    if (!route) {
      return { ok: false, reason: "No known route — scout the lab, and make sure you have a barracks" };
    }

    const hordeOccupiedKeys = new Set(game.hordes.map((h) => axialKey(h.path[h.pathIndex])));
    if (route.path.some((tile) => hordeOccupiedKeys.has(axialKey(tile)))) {
      return { ok: false, reason: "A horde blocks this route" };
    }

    const partySize = militiaCommitted + junkyardKnightCommitted + crossBowSniperCommitted;
    const countsValid =
      Number.isInteger(militiaCommitted) &&
      militiaCommitted >= 0 &&
      militiaCommitted <= availableMilitia(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults) &&
      Number.isInteger(junkyardKnightCommitted) &&
      junkyardKnightCommitted >= 0 &&
      junkyardKnightCommitted <=
        availableJunkyardKnights(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults) &&
      Number.isInteger(crossBowSniperCommitted) &&
      crossBowSniperCommitted >= 0 &&
      crossBowSniperCommitted <=
        availableCrossBowSnipers(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults);
    if (!countsValid) return { ok: false, reason: "Invalid unit counts" };
    if (partySize <= 0) return { ok: false, reason: "Commit at least one unit" };

    const provisionsCost = expeditionProvisionsCost(tweaks, partySize, route.cost);
    if (game.resources.food < provisionsCost) return { ok: false, reason: "Not enough food" };

    const resources = { ...game.resources, food: game.resources.food - provisionsCost };
    const departedAt = game.clock.virtualNow;
    const assault: LabAssaultRecord = {
      id: `labAssault-${departedAt}`,
      target: game.lab.coord,
      path: route.path,
      militiaCommitted,
      junkyardKnightCommitted,
      crossBowSniperCommitted,
      departedAt,
      arriveAt: departedAt + expeditionTravelDurationMs(tweaks, route.cost, troopSpeedMultiplier(tweaks, game.research)),
      resolvedIndex: 0,
    };
    const labAssaults: LabAssaultsRecord = [...game.labAssaults, assault];

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(LAB_ASSAULTS_DB_KEY, labAssaults)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, labAssaults } } : prev,
    );
    return { ok: true };
  }

  /**
   * Stations militia on an owned tile — a mobile defense that stacks
   * additively with any tower/wall there (engine/hordes.ts:hordeTileDefense)
   * and auto-attacks any horde on itself or a neighbor every tick
   * (engine/hordes.ts:resolveGarrisonAutoAttacks, run from the tick loop
   * below — no manual action needed). Unlike building a structure, this
   * never checks isHexOccupied — a garrison is not a structure and never
   * blocks (or is blocked by) one.
   */
  async function handleGarrisonMilitia(coord: Axial, count: number): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    if (!ownedKeys.has(axialKey(coord))) return { ok: false, reason: "Tile not owned" };
    if (!isBuildableLand(game.world.seed, coord)) return { ok: false, reason: "Cannot garrison on water" };

    // A tile can be back in territory.owned (via an expedition claiming it —
    // engine/expeditions.ts, unlike the tower viewshed auto-claim, doesn't
    // check for a live horde) while a horde is still physically standing on
    // it. Stationing militia into a fight that's already effectively lost (the
    // very next tick's resolveGarrisonAutoAttacks would just wipe them with
    // no effect on the horde) makes no sense — same guard as handleRepairStructure.
    const hordeOccupiedKeys = new Set(game.hordes.map((h) => axialKey(h.path[h.pathIndex])));
    if (hordeOccupiedKeys.has(axialKey(coord))) return { ok: false, reason: "A horde is still on this tile" };

    // A den's own coord can be in territory.owned (the hold ring, claimed the
    // moment an assault wins) without the den itself being under an active
    // siege — either it was never assaulted and this is incidental ring
    // overlap, or a past siege failed and reverted it to hostile without
    // un-claiming the ring (a known gap, not yet worth the risk of instead
    // stripping ownership and stranding any structures built on it). Either
    // way, garrisoning here does nothing: holdDefenseAt/resolveHoldPeriod
    // (engine/dens.ts) only ever reads the garrison at a den's coord while
    // den.siege is active, so this would just strand committed units for no
    // effect. Garrisoning IS allowed while a siege is actively running — that's
    // the intended way to help survive last-stand waves.
    const hostileDenHere = game.dens.some((d) => axialKey(d.coord) === axialKey(coord) && !d.siege);
    if (hostileDenHere) return { ok: false, reason: "A hostile den occupies this tile — assault it first" };

    if (!Number.isInteger(count) || count <= 0 || count > availableMilitia(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults)) {
      return { ok: false, reason: "Invalid militia count" };
    }

    const existing = garrisonAt(game.garrisons, coord);
    const garrisons: GarrisonsRecord = existing
      ? game.garrisons.map((g) => (axialKey(g.coord) === axialKey(coord) ? { ...g, militiaCount: g.militiaCount + count } : g))
      : [...game.garrisons, { coord, militiaCount: count, junkyardKnightCount: 0, crossBowSniperCount: 0 }];
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "garrison_militia", game.base.level) };

    await Promise.all([set(GARRISONS_DB_KEY, garrisons), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, garrisons, noise } } : prev,
    );
    return { ok: true };
  }

  /** Mirrors handleGarrisonMilitia exactly, for barracks L2's junkyard knights. */
  async function handleGarrisonJunkyardKnight(coord: Axial, count: number): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    if (!ownedKeys.has(axialKey(coord))) return { ok: false, reason: "Tile not owned" };
    if (!isBuildableLand(game.world.seed, coord)) return { ok: false, reason: "Cannot garrison on water" };

    const hordeOccupiedKeys = new Set(game.hordes.map((h) => axialKey(h.path[h.pathIndex])));
    if (hordeOccupiedKeys.has(axialKey(coord))) return { ok: false, reason: "A horde is still on this tile" };

    // Same reasoning as handleGarrisonMilitia's hostileDenHere guard.
    const hostileDenHere = game.dens.some((d) => axialKey(d.coord) === axialKey(coord) && !d.siege);
    if (hostileDenHere) return { ok: false, reason: "A hostile den occupies this tile — assault it first" };

    if (
      !Number.isInteger(count) ||
      count <= 0 ||
      count > availableJunkyardKnights(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults)
    ) {
      return { ok: false, reason: "Invalid junkyard knight count" };
    }

    const existing = garrisonAt(game.garrisons, coord);
    const garrisons: GarrisonsRecord = existing
      ? game.garrisons.map((g) =>
          axialKey(g.coord) === axialKey(coord) ? { ...g, junkyardKnightCount: g.junkyardKnightCount + count } : g,
        )
      : [...game.garrisons, { coord, militiaCount: 0, junkyardKnightCount: count, crossBowSniperCount: 0 }];
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "garrison_militia", game.base.level) };

    await Promise.all([set(GARRISONS_DB_KEY, garrisons), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, garrisons, noise } } : prev,
    );
    return { ok: true };
  }

  /** Mirrors handleGarrisonMilitia exactly, for barracks L3's cross-bow snipers. */
  async function handleGarrisonCrossBowSniper(coord: Axial, count: number): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    if (!ownedKeys.has(axialKey(coord))) return { ok: false, reason: "Tile not owned" };
    if (!isBuildableLand(game.world.seed, coord)) return { ok: false, reason: "Cannot garrison on water" };

    const hordeOccupiedKeys = new Set(game.hordes.map((h) => axialKey(h.path[h.pathIndex])));
    if (hordeOccupiedKeys.has(axialKey(coord))) return { ok: false, reason: "A horde is still on this tile" };

    // Same reasoning as handleGarrisonMilitia's hostileDenHere guard.
    const hostileDenHere = game.dens.some((d) => axialKey(d.coord) === axialKey(coord) && !d.siege);
    if (hostileDenHere) return { ok: false, reason: "A hostile den occupies this tile — assault it first" };

    if (
      !Number.isInteger(count) ||
      count <= 0 ||
      count > availableCrossBowSnipers(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults)
    ) {
      return { ok: false, reason: "Invalid cross-bow sniper count" };
    }

    const existing = garrisonAt(game.garrisons, coord);
    const garrisons: GarrisonsRecord = existing
      ? game.garrisons.map((g) =>
          axialKey(g.coord) === axialKey(coord) ? { ...g, crossBowSniperCount: g.crossBowSniperCount + count } : g,
        )
      : [...game.garrisons, { coord, militiaCount: 0, junkyardKnightCount: 0, crossBowSniperCount: count }];
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "garrison_militia", game.base.level) };

    await Promise.all([set(GARRISONS_DB_KEY, garrisons), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, garrisons, noise } } : prev,
    );
    return { ok: true };
  }

  /**
   * Recalling a garrison now takes time, not an instant teleport — half the
   * march time an outbound trip to this tile would take from the nearest
   * barracks (engine/expeditions.ts:recallDurationMs), same route-finding as
   * every other troop movement (findBestExpeditionRoute). The garrison comes
   * off the tile immediately (it stops defending — these troops are
   * marching away, not stationary), but doesn't rejoin the available pool
   * until the recall resolves in the tick loop above. Free (no provisions
   * cost) and doesn't fight through anything on the way — retreating troops
   * are marching back through ground they already hold.
   */
  async function handleRecallMilitia(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const garrison = garrisonAt(game.garrisons, coord);
    if (!garrison) return { ok: false, reason: "No garrison here" };

    const route = findBestExpeditionRoute(
      tweaks,
      game.world.seed,
      game.barracksList,
      game.towers,
      game.outposts,
      game.territory,
      game.scoutedTiles,
      tweaks.game.grid_size,
      coord,
    );
    if (!route) return { ok: false, reason: "No known route — make sure you have a barracks" };

    const garrisons = game.garrisons.filter((g) => axialKey(g.coord) !== axialKey(coord));
    const departedAt = game.clock.virtualNow;
    const recall: GarrisonRecallRecord = {
      id: `recall-${axialKey(coord)}-${departedAt}`,
      coord,
      militiaCommitted: garrison.militiaCount,
      junkyardKnightCommitted: garrison.junkyardKnightCount,
      crossBowSniperCommitted: garrison.crossBowSniperCount,
      departedAt,
      arriveAt: departedAt + recallDurationMs(tweaks, route.cost, troopSpeedMultiplier(tweaks, game.research)),
    };
    const garrisonRecalls: GarrisonRecallsRecord = [...game.garrisonRecalls, recall];

    await Promise.all([set(GARRISONS_DB_KEY, garrisons), set(GARRISON_RECALLS_DB_KEY, garrisonRecalls)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, garrisons, garrisonRecalls } } : prev,
    );
    return { ok: true };
  }

  if (boot.status === "loading") {
    return <p>Loading…</p>;
  }

  if (boot.status === "error") {
    return <p role="alert">Failed to start: {boot.message}</p>;
  }

  if (boot.game?.gameStatus.lost) {
    return (
      <GameOverScreen
        lostAt={boot.game.gameStatus.lostAt}
        currentSeed={boot.game.world.seed}
        onReplayCurrent={handleReplayCurrentGame}
        onStartNewSeed={handleStartNewSeed}
        onNewPlayer={handleNewPlayer}
      />
    );
  }

  if (boot.game?.gameStatus.won) {
    return (
      <WinScreen
        wonAt={boot.game.gameStatus.wonAt}
        currentSeed={boot.game.world.seed}
        onReplayCurrent={handleReplayCurrentGame}
        onStartNewSeed={handleStartNewSeed}
        onNewPlayer={handleNewPlayer}
      />
    );
  }

  return boot.game ? (
    <GameScreen
      tweaks={boot.tweaks}
      player={boot.game.player}
      world={boot.game.world}
      territory={boot.game.territory}
      base={boot.game.base}
      resources={boot.game.resources}
      extractionTiles={boot.game.extractionTiles}
      pathTiles={boot.game.pathTiles}
      towers={boot.game.towers}
      walls={boot.game.walls}
      barracksList={boot.game.barracksList}
      units={boot.game.units}
      garrisons={boot.game.garrisons}
      scoutedTiles={boot.game.scoutedTiles}
      storageLevels={boot.game.storageLevels}
      storageUpgrades={boot.game.storageUpgrades}
      noise={boot.game.noise}
      dens={boot.game.dens}
      denAssaults={boot.game.denAssaults}
      outposts={boot.game.outposts}
      lab={boot.game.lab}
      labAssaults={boot.game.labAssaults}
      garrisonRecalls={boot.game.garrisonRecalls}
      hordes={boot.game.hordes}
      expeditions={boot.game.expeditions}
      tombstones={boot.game.tombstones}
      docks={boot.game.docks}
      scoutSkiffs={boot.game.scoutSkiffs}
      wanderingScouts={boot.game.wanderingScouts}
      research={boot.game.research}
      toasts={toasts}
      now={boot.game.clock.virtualNow}
      speedMultiplier={speedMultiplier}
      onCycleFastForward={cycleFastForward}
      onDismissToast={dismissToast}
      onStartResearch={handleStartResearch}
      onBuildExtractionTile={handleBuildExtractionTile}
      onUpgradeExtractionTile={handleUpgradeExtractionTile}
      onUpgradeStorage={handleUpgradeStorage}
      onCollectTile={handleCollectTile}
      onBuildPath={handleBuildPath}
      onUpgradePath={handleUpgradePath}
      onBuildTower={handleBuildTower}
      onUpgradeTower={handleUpgradeTower}
      onBuildWall={handleBuildWall}
      onUpgradeWall={handleUpgradeWall}
      onRepairWall={handleRepairWall}
      onRepairStructure={handleRepairStructure}
      onDemolish={handleDemolish}
      onBuildBarracks={handleBuildBarracks}
      onUpgradeBarracks={handleUpgradeBarracks}
      onTrainScouts={handleTrainScouts}
      onTrainMilitia={handleTrainMilitia}
      onTrainJunkyardKnight={handleTrainJunkyardKnight}
      onTrainCrossBowSniper={handleTrainCrossBowSniper}
      onRushTrainScouts={handleRushTrainScouts}
      onRushTrainMilitia={handleRushTrainMilitia}
      onScoutTile={handleScoutTile}
      onUpgradeBase={handleUpgradeBase}
      onUpgradeReinforcement={handleUpgradeReinforcement}
      onRepairBase={handleRepairBase}
      onUpgradeOutpostReinforcement={handleUpgradeOutpostReinforcement}
      onRepairOutpost={handleRepairOutpost}
      onRelocateBase={handleRelocateBase}
      onDispatchExpedition={handleDispatchExpedition}
      onAssaultDen={handleAssaultDen}
      onSecureLab={handleSecureLab}
      onGarrisonMilitia={handleGarrisonMilitia}
      onGarrisonJunkyardKnight={handleGarrisonJunkyardKnight}
      onGarrisonCrossBowSniper={handleGarrisonCrossBowSniper}
      onRecallMilitia={handleRecallMilitia}
      onBuildDock={handleBuildDock}
      onBuildFishingBoat={handleBuildFishingBoat}
      onBuildScoutSkiff={handleBuildScoutSkiff}
      onCollectDock={handleCollectDock}
      onBuildWanderingScout={handleBuildWanderingScout}
      onReplayCurrent={handleReplayCurrentGame}
      onStartNewSeed={handleStartNewSeed}
      onNewPlayer={handleNewPlayer}
    />
  ) : (
    <OnboardingScreen onCreated={handlePlayerCreated} />
  );
}
