import { useCallback, useEffect, useRef, useState } from "react";
import { Skull, Zap } from "lucide-react";
import { loadProfile, fetchProfileRegistry, resolveProfileSlug, DEFAULT_PROFILE_SLUG, type ProfileEntry } from "./data/profileRegistry";
import type { Tweaks } from "./data/tweaksSchema";
import { PROFILE_SLUG_DB_KEY } from "./data/profile";
import { getRecentSeeds, recordRecentSeed } from "./data/recentSeeds";
import {
  buildSaveFile,
  clearGameSave,
  downloadSaveFile,
  hasCompleteSave,
  keysToStoredGame,
  parseSaveFile,
  pickSaveFile,
  readJsonFromFile,
  writeSaveFileToDb,
  type SaveFileV1,
  type StoredGameKeys,
} from "./data/gamePersistence";
import { initAssetConfig } from "./render/assetPaths";
import { resetTextureCache } from "./render/tileTextures";
import { ContinueGamePrompt, profileDisplayName } from "./ui/ContinueGamePrompt";
import type { OnboardingResult } from "./ui/onboarding/OnboardingScreen";
import { PLAYER_DB_KEY, type Player } from "./data/player";
import { resolveGridSizeForNewGame, resolveSeedForNewGame, resolveWorldGridSize, tweaksForMapSize, DEFAULT_MAP_SIZE } from "./data/mapSize";
import { WORLD_DB_KEY, generateSeed, normalizeWorldRecord, type WorldRecord } from "./data/world";
import { TERRITORY_DB_KEY, createStartingTerritory, type TerritoryRecord } from "./data/territory";
import { BASE_DB_KEY, initialBase, type BaseActionInProgress, type BaseRecord, type BaseReinforcementAction, type BaseUpgradeInProgress } from "./data/base";
import { RESOURCES_DB_KEY, initialResourceAmounts, type ResourceAmounts } from "./data/resources";
import { CLOCK_DB_KEY, type ClockRecord } from "./data/clock";
import { EXTRACTION_TILES_DB_KEY, type ExtractionTile } from "./data/extractionTiles";
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
import { BARRACKS_DB_KEY, type Barracks, type TrainingUnitType } from "./data/barracks";
import { POWER_STATIONS_DB_KEY, type PowerStation } from "./data/powerStations";
import { migratePowerEconomy } from "./data/migratePowerEconomy";
import { UNITS_DB_KEY, initialUnits, type LegacyUnitsRecord, type UnitsRecord } from "./data/units";
import { GARRISONS_DB_KEY, type GarrisonsRecord } from "./data/garrisons";
import { SCOUTED_TILES_DB_KEY, type ScoutedTiles } from "./data/scoutedTiles";
import { DENS_DB_KEY, createDens, resolveDen, type DenRecord, type DensRecord } from "./data/dens";
import { DEN_ASSAULTS_DB_KEY, type DenAssaultRecord, type DenAssaultsRecord } from "./data/denAssaults";
import {
  SCRAP_STASHES_DB_KEY,
  applyWanderingScoutScrapSamples,
  createScrapStashes,
  scrapStashBlocksHex,
  type ScrapStashesRecord,
} from "./data/scrapStashes";
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
  isStructureActive,
} from "./engine/formulas";
import {
  BASE_HUB_BUSY_REASON,
  STRUCTURE_BUSY_REASON,
  hasAnyStructureTask,
  countDockTasks,
  isBarracksAtTaskCap,
  isBaseHubAtTaskCap,
  isDockAtTaskCap,
  isHordeRepairBlocked,
  isLandStructureAtTaskCap,
  isOutpostReinforcementBusy,
  isWallAtTaskCap,
} from "./engine/structureBusy";
import {
  baseReinforcementHp,
  baseRepairCost,
  baseRelocationCost,
  baseUpgradeCost,
  canRelocateBase,
  isBaseRelocationComplete,
  maxReinforcementLevel,
  reinforcementUpgradeCost,
  resolveBaseAction,
} from "./engine/base";
import { autoClaimTowerRange, canRepairHordeDamagedTile } from "./engine/territory";
import {
  ASSAULT_CORRIDOR,
  TERRITORY_CORRIDOR,
  expeditionPathIndexAt,
  expeditionProvisionsCost,
  expeditionTravelDurationMs,
  findBestExpeditionRoute,
  findExpeditionRouteFrom,
  partyAttackPower,
  planHomeRecall,
  provisionsRefund,
  recallDurationMs,
  reinforceProvisionsCost,
  reinforceTravelDurationMs,
  stationExpeditionAsGarrison,
  stepCorridorWalk,
  type TombstoneCause,
} from "./engine/expeditions";
import { extractionTileBuildDurationMs, nextTier, tierUpgradeCost, tierUpgradeDurationMs } from "./engine/tiers";
import { storageCapacity, storageUpgradeCost, storageUpgradeDurationMs } from "./engine/storage";
import { isResearchAvailable, isResearchBusy, researchCost, researchDurationMs, troopSpeedMultiplier, unlockedSpeedRates } from "./engine/research";
import { isBuildableLand, isTransitionTile, terrainAt } from "./engine/terrain";
import { accrueNoise, addActionNoise } from "./engine/noiseMeter";
import {
  advanceHordes,
  checkHordeSpawns,
  hordeStructureCaptureEvents,
  markCapturedStructuresDamaged,
  preserveCapturedTilesAsScouted,
  resolveGarrisonAutoAttacks,
  towersInRange,
  reconcileHordeWatchtowerAlerts,
  type HordeHub,
} from "./engine/hordes";
import {
  availableCrossBowSnipers,
  availableJunkyardKnights,
  availableMilitia,
  clampPartyDispatch,
  garrisonAt,
  garrisonDefense,
  mergeIntoGarrison,
  resolveCapturedGarrisons,
} from "./engine/garrisons";
import { isTimerComplete } from "./engine/timers";
import { denAssaultSurvivors, denDefense, holdDefenseAt, resolveDenAssault, resolveHoldPeriod } from "./engine/dens";
import {
  labClueText,
  makeWatchtowerSignal,
  resolveLabAssault,
  rollWatchtowerSignal,
  watchtowerSignalToastText,
} from "./engine/lab";
import {
  maxOutpostReinforcementLevel,
  outpostReinforcementHp,
  outpostReinforcementRepairDurationMs,
  outpostReinforcementUpgradeCost,
  outpostReinforcementUpgradeDurationMs,
  outpostRepairCost,
  revertOutpostToDen,
} from "./engine/outposts";
import {
  accrueDockResources,
  collectDock,
  dockBuildCost,
  dockBuildDurationMs,
  dockLevel,
  dockUpgradeCost,
  dockUpgradeDurationMs,
  nextDockLevel,
} from "./engine/docks";
import { advanceScoutSkiffs } from "./engine/scoutSkiffs";
import { advanceWanderingScouts } from "./engine/wanderingScouts";
import { nextTowerLevel, towerBuildCost, towerBuildDurationMs, towerUpgradeCost, towerUpgradeDurationMs } from "./engine/towers";
import {
  computePowerNetwork,
  emptyPowerAlertMemory,
  nextPowerStationLevel,
  powerAlertToastText,
  powerStationBuildCost,
  powerStationBuildDurationMs,
  powerStationUpgradeCost,
  powerStationUpgradeDurationMs,
  reconcilePowerAlerts,
  type PowerAlertMemory,
} from "./engine/power";
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
  advanceBarracksTraining,
  barracksBuildCost,
  barracksBuildDurationMs,
  barracksUpgradeCost,
  barracksUpgradeDurationMs,
  crossBowSniperCapacity,
  junkyardKnightCapacity,
  militiaCapacity,
  nextBarracksLevel,
} from "./engine/barracks";
import {
  applyUpkeepTick,
  crossBowSniperTrainCost,
  junkyardKnightTrainCost,
  militiaTrainCost,
} from "./engine/units";
import { GameScreen } from "./ui/GameScreen";
import { NOTIFICATION_ICON_SIZE } from "./ui/hud/CollapsibleNotificationRow";
import type { ToastRecord } from "./ui/hud/Toast";
import { GameOverScreen } from "./ui/GameOverScreen";
import { WinScreen } from "./ui/WinScreen";
import { OnboardingScreen } from "./ui/onboarding/OnboardingScreen";
import "./App.css";

interface GameState {
  player: Player;
  world: WorldRecord;
  territory: TerritoryRecord;
  base: BaseRecord;
  resources: ResourceAmounts;
  clock: ClockRecord;
  extractionTiles: ExtractionTile[];
  towers: Tower[];
  walls: Wall[];
  barracksList: Barracks[];
  powerStations: PowerStation[];
  units: UnitsRecord;
  garrisons: GarrisonsRecord;
  scoutedTiles: ScoutedTiles;
  storageLevels: StorageLevels;
  storageUpgrades: StorageUpgradesRecord;
  noise: NoiseRecord;
  dens: DensRecord;
  scrapStashes: ScrapStashesRecord;
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

type StoredBaseRecord = Partial<BaseRecord> & {
  upgrade?: BaseUpgradeInProgress | null;
  reinforcementAction?: BaseReinforcementAction | null;
};

/** Maps pre–single-slot saves onto BaseRecord.action; level upgrade wins if both legacy fields were set (race corruption). */
function migrateBaseAction(stored: StoredBaseRecord): BaseActionInProgress | null {
  if (stored.action) return stored.action;
  if (stored.upgrade) {
    return { kind: "level_upgrade", targetLevel: stored.upgrade.targetLevel, startedAt: stored.upgrade.startedAt };
  }
  if (stored.reinforcementAction) {
    if (stored.reinforcementAction.kind === "upgrade") {
      return {
        kind: "reinforcement_upgrade",
        targetLevel: stored.reinforcementAction.targetLevel,
        startedAt: stored.reinforcementAction.startedAt,
      };
    }
    return { kind: "reinforcement_repair", startedAt: stored.reinforcementAction.startedAt };
  }
  return null;
}

/**
 * Spreads over initialBase() defaults, not just `?? initialBase(tweaks)` — an
 * existing save from before reinforcementLevel/currentHp existed would
 * otherwise load with those fields undefined. currentHp gets special
 * handling: a pre-currentHp save defaults to a FULL-HP pool for whatever
 * reinforcementLevel it had already invested in, not the fresh-base
 * baseline, so an old high-reinforcement save doesn't load looking damaged.
 */
function resolveBase(tweaks: Tweaks, base: StoredBaseRecord | undefined): BaseRecord {
  const resolved = { ...initialBase(tweaks), ...base, action: migrateBaseAction(base ?? {}) };
  if (!base || base.currentHp === undefined) {
    resolved.currentHp = baseReinforcementHp(tweaks, resolved.reinforcementLevel);
  }
  return resolved;
}

/**
 * Moves pre-#5 player-global training queues onto the first idle active barracks.
 * Drops stockpile-scout state (#76): scoutStockpile, legacy scoutQueue, and any
 * barracks trainingQueue still typed as "scout".
 */
function migrateLegacyTrainingQueues(
  barracksList: Barracks[],
  rawUnits: LegacyUnitsRecord,
): { barracksList: Barracks[]; units: UnitsRecord } {
  const units: UnitsRecord = {
    militiaCount: rawUnits.militiaCount ?? 0,
    junkyardKnightCount: rawUnits.junkyardKnightCount ?? 0,
    crossBowSniperCount: rawUnits.crossBowSniperCount ?? 0,
  };

  const legacyQueues: { unitType: TrainingUnitType; queue: NonNullable<LegacyUnitsRecord["militiaQueue"]> }[] = [];
  if (rawUnits.militiaQueue) legacyQueues.push({ unitType: "militia", queue: rawUnits.militiaQueue });
  if (rawUnits.junkyardKnightQueue) legacyQueues.push({ unitType: "junkyard_knight", queue: rawUnits.junkyardKnightQueue });
  if (rawUnits.crossBowSniperQueue) legacyQueues.push({ unitType: "cross_bow_sniper", queue: rawUnits.crossBowSniperQueue });

  let nextBarracks = barracksList.map((b) =>
    b.trainingQueue && (b.trainingQueue.unitType as string) === "scout" ? { ...b, trainingQueue: null } : b,
  );
  for (const { unitType, queue } of legacyQueues) {
    const idx = nextBarracks.findIndex((b) => isStructureActive(b) && !b.trainingQueue);
    if (idx < 0) break;
    nextBarracks = nextBarracks.map((b, i) =>
      i === idx ? { ...b, trainingQueue: { unitType, remaining: queue.remaining, currentUnitStartedAt: queue.currentUnitStartedAt } } : b,
    );
  }

  return { barracksList: nextBarracks, units };
}

/** Backfill lifecycle fields for saves created before corridor-conquest (#73). */
function normalizeExpedition(e: Expedition & { resolvedIndex?: number }): Expedition {
  const path = e.path ?? [];
  return {
    ...e,
    resolvedIndex: e.resolvedIndex ?? 0,
    origin: e.origin ?? path[0] ?? { q: 0, r: 0 },
    phase: e.phase ?? "marching",
    provisionsPaid: e.provisionsPaid ?? 0,
    outboundTileCount: e.outboundTileCount ?? Math.max(0, path.length - 1),
    decisionDeadlineAt: e.decisionDeadlineAt ?? null,
    joinExpeditionId: e.joinExpeditionId ?? null,
  };
}

function buildGameState(
  tweaks: Tweaks,
  data: {
    player: Player;
    world: WorldRecord;
    territory: TerritoryRecord;
    base: BaseRecord | undefined;
    resources: ResourceAmounts;
    clock: ClockRecord;
    extractionTiles: ExtractionTile[] | undefined;
    towers: Tower[] | undefined;
    walls: Wall[] | undefined;
    barracksList: Barracks[] | undefined;
    powerStations: PowerStation[] | undefined;
    units: UnitsRecord | undefined;
    garrisons: GarrisonsRecord | undefined;
    scoutedTiles: ScoutedTiles | undefined;
    storageLevels: StorageLevels;
    storageUpgrades: StorageUpgradesRecord | undefined;
    noise: NoiseRecord | undefined;
    dens: DenRecord[] | undefined;
    scrapStashes: ScrapStashesRecord | undefined;
    hordes: HordesRecord | undefined;
    expeditions: ExpeditionsRecord | undefined;
    gameStatus: GameStatusRecord | undefined;
    docks: DocksRecord | undefined;
    scoutSkiffs: ScoutSkiffsRecord | undefined;
    wanderingScouts: WanderingScoutsRecord | undefined;
    denAssaults: DenAssaultsRecord | undefined;
    outposts: OutpostsRecord | undefined;
    garrisonRecalls: GarrisonRecallsRecord | undefined;
    lab: LabRecord | undefined;
    labAssaults: LabAssaultsRecord | undefined;
    research: ResearchRecord | undefined;
    tombstones: TombstonesRecord | undefined;
  },
): GameState {
  const resolvedDens = (data.dens ?? []).map(resolveDen);
  const gridSize = resolveWorldGridSize(data.world, tweaks);
  // dens → lab → scrapStashes (same order as resetGame). Old saves without
  // scrapStashes get a deterministic regenerate from the world seed.
  const lab = data.lab ?? createLab(
    data.world.seed,
    gridSize,
    data.territory.base,
    resolvedDens,
    tweaks,
  );
  const scrapStashes =
    data.scrapStashes && data.scrapStashes.length > 0
      ? data.scrapStashes
      : createScrapStashes(
          data.world.seed,
          gridSize,
          data.territory.base,
          resolvedDens,
          lab,
          tweaks,
        );
  const migrated = migrateLegacyTrainingQueues(data.barracksList ?? [], { ...initialUnits(), ...(data.units as LegacyUnitsRecord | undefined) });
  // One-shot migration from stockpile-power saves (Milestone 25 / #70): power
  // extraction tiles become L1 power stations, resources.power/storageLevels.power
  // are dropped, and power keys are stripped from every other structure's
  // totalInvested/buildCost — idempotent, so already-migrated saves pass through.
  const migratedPower = migratePowerEconomy({
    resources: data.resources,
    storageLevels: data.storageLevels,
    extractionTiles: data.extractionTiles ?? [],
    powerStations: data.powerStations ?? [],
    towers: data.towers ?? [],
    walls: data.walls ?? [],
    barracksList: migrated.barracksList,
    docks: data.docks ?? [],
  });
  const extractionTiles = migratedPower.extractionTiles;
  const towers = (migratedPower.towers ?? []) as Tower[];
  const walls = (migratedPower.walls ?? []) as Wall[];
  const barracksList = (migratedPower.barracksList ?? []) as Barracks[];
  const docks = (migratedPower.docks ?? []) as DocksRecord;
  const powerStations = migratedPower.powerStations;
  // One-shot heal for saves that lost fog when hordes stripped ownership:
  // any damaged structure implies the tile was held/known — keep it scouted.
  const scoutedTiles = preserveCapturedTilesAsScouted(data.scoutedTiles ?? [], [
    ...extractionTiles,
    ...towers,
    ...walls,
    ...barracksList,
    ...powerStations,
  ]
    .filter((s) => s.damaged)
    .map((s) => s.coord));
  return {
    player: data.player,
    world: normalizeWorldRecord(data.world),
    territory: data.territory,
    base: resolveBase(tweaks, data.base),
    resources: migratedPower.resources,
    clock: { ...data.clock, virtualNow: data.clock.virtualNow ?? data.clock.lastTickAt },
    extractionTiles,
    towers,
    walls,
    barracksList,
    powerStations,
    units: migrated.units,
    garrisons: data.garrisons ?? [],
    scoutedTiles,
    storageLevels: migratedPower.storageLevels,
    storageUpgrades: data.storageUpgrades ?? initialStorageUpgrades(),
    noise: data.noise ?? initialNoise(tweaks),
    dens: resolvedDens,
    scrapStashes,
    hordes: data.hordes ?? [],
    expeditions: (data.expeditions ?? []).map((e) => normalizeExpedition(e)),
    gameStatus: { ...initialGameStatus(), ...data.gameStatus },
    docks,
    scoutSkiffs: data.scoutSkiffs ?? [],
    wanderingScouts: data.wanderingScouts ?? [],
    denAssaults: (data.denAssaults ?? []).map((a) => ({ ...a, resolvedIndex: a.resolvedIndex ?? 0 })),
    outposts: data.outposts ?? [],
    garrisonRecalls: data.garrisonRecalls ?? [],
    lab,
    labAssaults: (data.labAssaults ?? []).map((a) => ({ ...a, resolvedIndex: a.resolvedIndex ?? 0 })),
    research: data.research ?? initialResearch(),
    tombstones: data.tombstones ?? [],
  };
}

/**
 * Applies a completed outpost reinforcement upgrade or repair — outposts keep
 * their own reinforcementAction slot (not merged with base level upgrades).
 */
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
 * (engine/tiers.ts, engine/towers.ts, engine/walls.ts,
 * engine/barracks.ts) — passed in already-resolved since it's a flat
 * per-kind value, not derived from the structure itself the way
 * resolveDamageRepair's duration is.
 */
function resolveConstruction<T extends { buildStartedAt?: number | null }>(
  structure: T,
  durationMs: number,
  virtualNow: number,
): T {
  if (structure.buildStartedAt == null) return structure;
  if (!isTimerComplete(structure.buildStartedAt, durationMs, virtualNow)) return structure;
  return { ...structure, buildStartedAt: null };
}

/** Every owned tile can hold at most one structure of any kind (extraction, tower, wall, barracks, dock, or power station). */
function isHexOccupied(game: GameState, coord: Axial): boolean {
  const key = axialKey(coord);
  return (
    game.extractionTiles.some((t) => axialKey(t.coord) === key) ||
    game.towers.some((t) => axialKey(t.coord) === key) ||
    game.walls.some((t) => axialKey(t.coord) === key) ||
    game.barracksList.some((t) => axialKey(t.coord) === key) ||
    game.docks.some((t) => axialKey(t.coord) === key) ||
    game.powerStations.some((t) => axialKey(t.coord) === key) ||
    scrapStashBlocksHex(game.scrapStashes, coord)
  );
}

type BootState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "continuePrompt";
      tweaks: Tweaks;
      profileSlug: string;
      profiles: ProfileEntry[];
      recentSeeds: number[];
      pendingGame: GameState;
    }
  | {
      status: "ready";
      tweaks: Tweaks;
      profileSlug: string;
      profiles: ProfileEntry[];
      recentSeeds: number[];
      game: GameState | undefined;
    };

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
  /** Horde ids currently inside a tower's combat range — used to toast once on entry (#38). */
  const hordeAlertedIdsRef = useRef<Set<string>>(new Set());
  /** Power-grid toast episode memory — brownout / 10% steps / blackout (engine/power.ts). */
  const powerAlertMemoryRef = useRef<PowerAlertMemory>(emptyPowerAlertMemory());
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
          profiles,
          recentSeeds,
          savedProfileSlug,
          player,
          world,
          territory,
          base,
          resources,
          clock,
          extractionTiles,
          towers,
          walls,
          barracksList,
          powerStations,
          units,
          garrisons,
          scoutedTiles,
          storageLevels,
          storageUpgrades,
          noise,
          dens,
          scrapStashes,
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
          fetchProfileRegistry(),
          getRecentSeeds(),
          get<string>(PROFILE_SLUG_DB_KEY),
          get<Player>(PLAYER_DB_KEY),
          get<WorldRecord>(WORLD_DB_KEY),
          get<TerritoryRecord>(TERRITORY_DB_KEY),
          get<BaseRecord>(BASE_DB_KEY),
          get<ResourceAmounts>(RESOURCES_DB_KEY),
          get<ClockRecord>(CLOCK_DB_KEY),
          get<ExtractionTile[]>(EXTRACTION_TILES_DB_KEY),
          get<Tower[]>(TOWERS_DB_KEY),
          get<Wall[]>(WALLS_DB_KEY),
          get<Barracks[]>(BARRACKS_DB_KEY),
          get<PowerStation[]>(POWER_STATIONS_DB_KEY),
          get<UnitsRecord>(UNITS_DB_KEY),
          get<GarrisonsRecord>(GARRISONS_DB_KEY),
          get<ScoutedTiles>(SCOUTED_TILES_DB_KEY),
          get<StorageLevels>(STORAGE_LEVELS_DB_KEY),
          get<StorageUpgradesRecord>(STORAGE_UPGRADES_DB_KEY),
          get<NoiseRecord>(NOISE_DB_KEY),
          get<DensRecord>(DENS_DB_KEY),
          get<ScrapStashesRecord>(SCRAP_STASHES_DB_KEY),
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

        const urlSlug = resolveProfileSlug(window.location.pathname);
        const saveExists = hasCompleteSave({ player, world, territory, resources, clock, storageLevels });

        if (saveExists && player && world && territory && resources && clock && storageLevels) {
          const profileSlug = savedProfileSlug ?? DEFAULT_PROFILE_SLUG;
          const tweaks = await loadProfile(profileSlug);
          initAssetConfig(profileSlug);
          const pendingGame = buildGameState(tweaks, {
            player,
            world,
            territory,
            base,
            resources,
            clock,
            extractionTiles,
            towers,
            walls,
            barracksList,
            powerStations,
            units,
            garrisons,
            scoutedTiles,
            storageLevels,
            storageUpgrades,
            noise,
            dens,
            scrapStashes,
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
          });
          setBoot({
            status: "continuePrompt",
            tweaks,
            profileSlug,
            profiles,
            recentSeeds,
            pendingGame,
          });
          return;
        }

        const profileSlug = urlSlug ?? DEFAULT_PROFILE_SLUG;
        const tweaks = await loadProfile(profileSlug);
        initAssetConfig(profileSlug);
        setBoot({
          status: "ready",
          tweaks,
          profileSlug,
          profiles,
          recentSeeds,
          game: undefined,
        });
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

      // Computed once per tick from this tick's starting structure arrays —
      // every consumer below (accrual, noise, training, hordes) reads the
      // same snapshot, since the network itself only actually shifts at the
      // structure-resolution timers a few lines down, not mid-tick.
      const powerNetwork = computePowerNetwork(
        current.tweaks,
        current.game.powerStations,
        current.game.extractionTiles,
        current.game.towers,
        current.game.walls,
        current.game.barracksList,
        current.game.docks,
      );
      {
        const { next, alerts } = reconcilePowerAlerts(
          powerNetwork.factor,
          powerNetwork.cutoff,
          powerAlertMemoryRef.current,
        );
        powerAlertMemoryRef.current = next;
        const stationCoord =
          current.game.powerStations.find((s) => s.buildStartedAt == null)?.coord ?? undefined;
        for (const alert of alerts) {
          pushToast({
            icon: <Zap size={NOTIFICATION_ICON_SIZE} />,
            coord: stationCoord,
            message: powerAlertToastText(alert),
          });
        }
      }
      // Milestone 26: L2+ extraction tiles haul via implied courier to base
      // (path auto-flow retired). Scouted tiles feed the same owned∪scouted
      // route set as expeditions.
      const economyGridSize = resolveWorldGridSize(current.game.world, current.tweaks);
      const { resources: producedResources, tiles: extractionTilesAfterYield } = accrueResources(
        current.tweaks,
        current.game.extractionTiles,
        elapsedSeconds,
        current.game.world.seed,
        current.game.resources,
        current.game.storageLevels,
        powerNetwork,
        virtualNow,
        current.game.territory.base,
        current.game.territory,
        current.game.scoutedTiles,
        economyGridSize,
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
        virtualNow,
        current.game.world.seed,
        current.game.territory.base,
        current.game.territory,
        current.game.scoutedTiles,
        economyGridSize,
      );
      const { food: foodAfterUpkeep, units: unitsAfterUpkeep } = applyUpkeepTick(
        current.tweaks,
        current.game.units,
        producedResourcesWithDocks.food,
        elapsedSeconds,
      );
      let resources = { ...producedResourcesWithDocks, food: foodAfterUpkeep };
      const noise: NoiseRecord = {
        value: accrueNoise(
          current.tweaks,
          current.game.extractionTiles,
          current.game.towers,
          current.game.walls,
          current.game.noise.value,
          elapsedSeconds,
          current.game.base.level,
          current.game.powerStations,
          powerNetwork,
        ),
      };
      const clock: ClockRecord = { lastTickAt: now, virtualNow };

      const baseBeforeAction = current.game.base;
      const baseAfterAction = resolveBaseAction(current.tweaks, baseBeforeAction, virtualNow);
      if (baseBeforeAction.action?.kind === "level_upgrade" && !baseAfterAction.action) {
        pushToast({ message: `Base upgraded to level ${baseAfterAction.level}` });
      }

      // Base relocation timer — same virtual-clock-threshold pattern as the
      // action check above. This is the one place territory.base is ever
      // reassigned; resolved here (before hordeSpawns/advanceHordes/
      // garrisonDefense below) so the rest of this tick's horde logic already
      // sees wherever the base ends up. Everything else (towers, walls,
      // barracks, garrisons, dens) stays exactly where it was — only the
      // base coordinate moves, and the destination tile joins territory.owned
      // if it wasn't already (a base always sits on owned ground).
      const relocation = baseAfterAction.relocation;
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
          ? { ...baseAfterAction, relocation: null }
          : baseAfterAction;

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
      const towers = current.game.towers
        .map((t) =>
          t.upgrade && isTimerComplete(t.upgrade.startedAt, towerUpgradeDurationMs(current.tweaks, t.upgrade.targetLevel), virtualNow)
            ? { ...t, level: t.upgrade.targetLevel, upgrade: null }
            : t,
        )
        .map((t) => resolveDamageRepair(t, current.tweaks, virtualNow))
        .map((t) => resolveConstruction(t, towerBuildDurationMs(current.tweaks), virtualNow));
      const powerStations = current.game.powerStations
        .map((s) =>
          s.upgrade &&
          isTimerComplete(s.upgrade.startedAt, powerStationUpgradeDurationMs(current.tweaks, s.upgrade.targetLevel), virtualNow)
            ? { ...s, level: s.upgrade.targetLevel, upgrade: null }
            : s,
        )
        .map((s) => resolveDamageRepair(s, current.tweaks, virtualNow))
        .map((s) => resolveConstruction(s, powerStationBuildDurationMs(current.tweaks), virtualNow));
      let barracksList = current.game.barracksList
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
        .map((d) => {
          // Legacy fishing-boat timer → complete as L3.
          if (
            d.fishingBoatUpgrade &&
            isTimerComplete(
              d.fishingBoatUpgrade.startedAt,
              current.tweaks.docks.fishing_boat.build_time_minutes * 60_000,
              virtualNow,
            )
          ) {
            return { ...d, level: 3, fishingBoat: true, fishingBoatUpgrade: null, upgrade: null };
          }
          if (
            d.upgrade &&
            isTimerComplete(
              d.upgrade.startedAt,
              dockUpgradeDurationMs(current.tweaks, d.upgrade.targetLevel as 2 | 3),
              virtualNow,
            )
          ) {
            const level = d.upgrade.targetLevel;
            return {
              ...d,
              level,
              fishingBoat: level >= 3 ? true : d.fishingBoat,
              upgrade: null,
            };
          }
          return d;
        })
        .map((d) => resolveConstruction(d, dockBuildDurationMs(current.tweaks), virtualNow));
      const scoutSkiffsAfterBuild = current.game.scoutSkiffs.map((s) =>
        s.buildStartedAt != null &&
        isTimerComplete(s.buildStartedAt, current.tweaks.docks.scout_skiff.build_time_minutes * 60_000, virtualNow)
          ? { ...s, buildStartedAt: null, stepProgressSeconds: 0 }
          : s,
      );
      const { skiffs: scoutSkiffs, scoutedTiles: scoutedTilesAfterSkiffs } = advanceScoutSkiffs(
        current.tweaks,
        scoutSkiffsAfterBuild,
        current.game.scoutedTiles,
        current.game.world.seed,
        resolveWorldGridSize(current.game.world, current.tweaks),
        elapsedSeconds,
      );
      const wanderingScoutsAfterBuild = current.game.wanderingScouts.map((s) =>
        s.buildStartedAt != null &&
        isTimerComplete(s.buildStartedAt, current.tweaks.units.wandering_scout.build_time_minutes * 60_000, virtualNow)
          ? { ...s, buildStartedAt: null, stepProgressSeconds: 0 }
          : s,
      );

      // Watchtower listening (#38): L2+ towers may set a vague compass signal
      // that biases wandering scouts. Does not award cluesCollected directly.
      let labWorking: LabRecord = {
        ...current.game.lab,
        watchtowerSignal: current.game.lab.watchtowerSignal ?? null,
      };
      const cluesCapped =
        current.tweaks.lab_clues.passive_surfacing.stops_once_all_clues_collected &&
        labWorking.cluesCollected >= current.tweaks.lab_clues.total_clues;
      if (!cluesCapped) {
        const tickCount = Math.max(1, Math.floor(elapsedSeconds));
        const rollSalt = Math.floor(virtualNow);
        let newestSignal: typeof labWorking.watchtowerSignal = null;
        for (const tower of towers) {
          if (!isStructureActive(tower)) continue;
          if (
            rollWatchtowerSignal(
              current.tweaks,
              current.game.world.seed,
              tower.coord,
              tower.level,
              rollSalt + tower.coord.q * 17 + tower.coord.r * 31,
              tickCount,
            )
          ) {
            newestSignal = makeWatchtowerSignal(territoryAfterRelocation.base, labWorking.coord, virtualNow);
          }
        }
        if (newestSignal) {
          labWorking = { ...labWorking, watchtowerSignal: newestSignal };
          pushToast({ message: watchtowerSignalToastText(newestSignal.bearing) });
        }
      }

      const {
        scouts: wanderingScouts,
        scoutedTiles,
        clueAwarded: wanderingClueAwarded,
      } = advanceWanderingScouts(
        current.tweaks,
        wanderingScoutsAfterBuild,
        scoutedTilesAfterSkiffs,
        current.game.world.seed,
        resolveWorldGridSize(current.game.world, current.tweaks),
        elapsedSeconds,
        {
          signal: labWorking.watchtowerSignal ?? null,
          base: territoryAfterRelocation.base,
          cluesCollected: labWorking.cluesCollected,
        },
      );
      const scrapSample = applyWanderingScoutScrapSamples(
        current.tweaks,
        current.game.scrapStashes,
        wanderingScoutsAfterBuild,
        wanderingScouts,
      );
      let scrapStashes = scrapSample.scrapStashes;
      if (scrapSample.steelGained > 0) {
        const steelCap = storageCapacity(current.tweaks, current.game.storageLevels.steel);
        resources = {
          ...resources,
          steel: Math.min(steelCap, resources.steel + scrapSample.steelGained),
        };
      }
      if (wanderingClueAwarded) {
        labWorking = {
          ...labWorking,
          cluesCollected: labWorking.cluesCollected + 1,
          watchtowerSignal: null,
        };
        const clueText = labClueText(labWorking.cluesCollected, territoryAfterRelocation.base, labWorking.coord);
        pushToast({
          message: `New lab clue (${labWorking.cluesCollected}/${current.tweaks.lab_clues.total_clues}): ${clueText}`,
        });
      }

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

      // Per-barracks training queues — one slot each, speed scales with that
      // barracks's level (engine/barracks.ts:advanceBarracksTraining).
      const trainingResult = advanceBarracksTraining(current.tweaks, barracksList, unitsAfterUpkeep, virtualNow, powerNetwork);
      barracksList = trainingResult.barracksList;
      const units = trainingResult.units;

      const hordesAfterSpawn = checkHordeSpawns(
        current.tweaks,
        current.game.dens,
        current.game.hordes,
        noise.value,
        base.level,
        current.game.world.seed,
        territoryAfterRelocation,
        outpostsAfterYield,
        resolveWorldGridSize(current.game.world, current.tweaks),
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
        towers,
        walls,
        barracksList,
        current.game.garrisons,
        hordeHubs,
        elapsedSeconds,
        current.game.world.seed,
        powerNetwork,
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
      const hordeCaptureEvents = hordeStructureCaptureEvents(
        capturedTiles,
        extractionTiles,
        towers,
        walls,
        barracksList,
      );
      for (const event of hordeCaptureEvents) {
        pushToast({
          icon: <Skull size={NOTIFICATION_ICON_SIZE} />,
          coord: event.coord,
          message: `Horde damaged ${event.kind} at`,
          detail: event.cancelledWork.length > 0 ? event.cancelledWork.join(" · ") : undefined,
        });
      }
      const extractionTilesAfterCapture = markCapturedStructuresDamaged(extractionTiles, capturedTiles);
      const towersAfterCapture = markCapturedStructuresDamaged(towers, capturedTiles);
      const wallsAfterCapture = markCapturedStructuresDamaged(walls, capturedTiles);
      const barracksListAfterCapture = markCapturedStructuresDamaged(barracksList, capturedTiles);
      const powerStationsAfterCapture = markCapturedStructuresDamaged(powerStations, capturedTiles);
      // Ownership drop must not re-fog known ground — keep captured tiles in
      // scoutedTiles so reclaim/repair stays possible without rediscovery.
      const scoutedTilesAfterCapture = preserveCapturedTilesAsScouted(scoutedTiles, capturedTiles);

      // Watchtower early-warning (#38): toast once when a horde first enters
      // any active tower's combat range; clear when it leaves so re-entry alerts again.
      {
        const inRangeIds: string[] = [];
        for (const horde of hordes) {
          const tile = horde.path[horde.pathIndex];
          if (!tile) continue;
          if (towersInRange(current.tweaks, towersAfterCapture, tile, current.game.world.seed).length > 0) {
            inRangeIds.push(horde.id);
          }
        }
        const { nextAlerted, newlyAlertedIds } = reconcileHordeWatchtowerAlerts(inRangeIds, hordeAlertedIdsRef.current);
        hordeAlertedIdsRef.current = nextAlerted;
        for (const id of newlyAlertedIds) {
          const horde = hordes.find((h) => h.id === id);
          const tile = horde?.path[horde.pathIndex];
          pushToast({
            icon: <Skull size={NOTIFICATION_ICON_SIZE} />,
            coord: tile,
            message: "Watchtower alert — horde approaching",
          });
        }
      }

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
        resolveWorldGridSize(current.game.world, current.tweaks),
        hordeOccupiedKeys,
        current.game.world.seed,
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
      let resourcesAfterExpeditions = resources;
      let hordesAfterCorridor = hordesAfterAutoAttack;
      const nextExpeditions: Expedition[] = [];
      const reinforceMerges: {
        joinId: string;
        militia: number;
        knight: number;
        sniper: number;
      }[] = [];

      const speedMult = troopSpeedMultiplier(current.tweaks, current.game.research);
      const gridSize = resolveWorldGridSize(current.game.world, current.tweaks);
      const worldSeed = current.game.world.seed;
      const scoutedForRecall = current.game.scoutedTiles;

      const applyHomeRecall = (expedition: Expedition, applyRefund: boolean): void => {
        const plan = planHomeRecall(
          current.tweaks,
          worldSeed,
          expedition,
          territoryAfterExpeditions,
          scoutedForRecall,
          gridSize,
          speedMult,
          virtualNow,
          applyRefund,
        );
        if (plan.foodRefund > 0) {
          resourcesAfterExpeditions = {
            ...resourcesAfterExpeditions,
            food: resourcesAfterExpeditions.food + plan.foodRefund,
          };
        }
        if (plan.next) {
          nextExpeditions.push({ ...expedition, ...plan.next });
        }
        // else dissolved at origin / no route — units return to standing army by dropping the record
      };

      for (const raw of [...current.game.expeditions].sort((a, b) => a.departedAt - b.departedAt)) {
        const expedition = normalizeExpedition(raw);
        const attackPower = partyAttackPower(
          current.tweaks,
          expedition.militiaCommitted,
          expedition.junkyardKnightCommitted,
          expedition.crossBowSniperCommitted,
        );

        if (expedition.phase === "awaitingOrders") {
          const deadline =
            expedition.decisionDeadlineAt ??
            virtualNow + current.tweaks.expeditions.arrival_decision_minutes * 60_000;
          if (virtualNow >= deadline) {
            applyHomeRecall({ ...expedition, decisionDeadlineAt: deadline }, false);
            pushToast({
              message: "Expedition returning home — no new orders received",
              coord: expedition.target,
            });
          } else {
            nextExpeditions.push({ ...expedition, decisionDeadlineAt: deadline });
          }
          continue;
        }

        const targetIndex = expeditionPathIndexAt(
          expedition.departedAt,
          expedition.arriveAt,
          virtualNow,
          expedition.path.length,
        );
        const step = stepCorridorWalk(
          current.tweaks,
          expedition.path,
          expedition.resolvedIndex,
          targetIndex,
          territoryAfterExpeditions.owned,
          territoryAfterExpeditions.base,
          attackPower,
          hordeSizeByKey,
          TERRITORY_CORRIDOR,
        );

        if (step.claimedTiles.length > 0) {
          territoryAfterExpeditions = {
            ...territoryAfterExpeditions,
            owned: [...territoryAfterExpeditions.owned, ...step.claimedTiles],
          };
        }

        if (step.clearedHordeKeys.length > 0) {
          const cleared = new Set(step.clearedHordeKeys);
          for (const key of cleared) hordeSizeByKey.delete(key);
          hordesAfterCorridor = hordesAfterCorridor.filter(
            (h) => !cleared.has(axialKey(h.path[h.pathIndex])),
          );
        }

        if (step.death) {
          unitsAfterExpeditions = debitParty(unitsAfterExpeditions, expedition);
          tombstonesFromThisTick.push(
            makeTombstone("expedition", expedition.target, step.death.tile, step.death.cause, expedition, attackPower),
          );
          const cause =
            step.death.cause.kind === "horde_blocked"
              ? `horde (${step.death.cause.hordeSize}) beat party power ${attackPower}`
              : `tile defense ${step.death.cause.defense} beat party power ${attackPower}`;
          pushToast({
            message: `Expedition wiped — ${cause}`,
            coord: step.death.tile,
          });
          continue;
        }

        if (step.resolvedIndex >= expedition.path.length - 1) {
          if (expedition.phase === "recalling") {
            continue; // home — standing army free again
          }
          if (expedition.phase === "reinforcing" && expedition.joinExpeditionId) {
            reinforceMerges.push({
              joinId: expedition.joinExpeditionId,
              militia: expedition.militiaCommitted,
              knight: expedition.junkyardKnightCommitted,
              sniper: expedition.crossBowSniperCommitted,
            });
            continue;
          }
          // Outbound arrival — wait for orders
          const decisionDeadlineAt =
            virtualNow + current.tweaks.expeditions.arrival_decision_minutes * 60_000;
          nextExpeditions.push({
            ...expedition,
            resolvedIndex: expedition.path.length - 1,
            phase: "awaitingOrders",
            decisionDeadlineAt,
          });
          pushToast({
            message: "We made it. Where to next, boss?",
            coord: expedition.target,
          });
          continue;
        }

        nextExpeditions.push({ ...expedition, resolvedIndex: step.resolvedIndex });
      }

      for (const merge of reinforceMerges) {
        const idx = nextExpeditions.findIndex(
          (e) => e.id === merge.joinId && e.phase === "awaitingOrders",
        );
        if (idx >= 0) {
          const host = nextExpeditions[idx]!;
          nextExpeditions[idx] = {
            ...host,
            militiaCommitted: host.militiaCommitted + merge.militia,
            junkyardKnightCommitted: host.junkyardKnightCommitted + merge.knight,
            crossBowSniperCommitted: host.crossBowSniperCommitted + merge.sniper,
          };
          pushToast({
            message: "Reinforcements joined the expedition",
            coord: host.target,
          });
        } else {
          // Host gone — reinforcements idle at destination as their own waiting party
          // (units already committed on the reinforcing record which was dropped; restore by
          // creating a synthetic awaiting party would double-count. Units stay in UnitsRecord
          // and become available when the reinforcing record is dropped without merge — so
          // if host is missing we simply free them by not re-adding. No action.)
        }
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
      let labAfterClues: LabRecord = labWorking;

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
          ASSAULT_CORRIDOR,
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
            worldSeed,
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
          ASSAULT_CORRIDOR,
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
        set(RESOURCES_DB_KEY, resourcesAfterExpeditions),
        set(EXTRACTION_TILES_DB_KEY, extractionTilesAfterCapture),
        set(TOWERS_DB_KEY, towersAfterCapture),
        set(WALLS_DB_KEY, wallsAfterCapture),
        set(BARRACKS_DB_KEY, barracksListAfterCapture),
        set(POWER_STATIONS_DB_KEY, powerStationsAfterCapture),
        set(UNITS_DB_KEY, unitsAfterExpeditions),
        set(GARRISONS_DB_KEY, garrisonsAfterSieges),
        set(NOISE_DB_KEY, noiseAfterAutoAttack),
        set(CLOCK_DB_KEY, clock),
        set(BASE_DB_KEY, baseAfterHordes),
        set(HORDES_DB_KEY, hordesAfterCorridor),
        set(TERRITORY_DB_KEY, territoryAfterExpeditions),
        set(EXPEDITIONS_DB_KEY, nextExpeditions),
        set(GAME_STATUS_DB_KEY, gameStatus),
        set(DOCKS_DB_KEY, docks),
        set(SCOUT_SKIFFS_DB_KEY, scoutSkiffs),
        set(WANDERING_SCOUTS_DB_KEY, wanderingScouts),
        set(SCOUTED_TILES_DB_KEY, scoutedTilesAfterCapture),
        set(DENS_DB_KEY, densAfterAssaults),
        set(SCRAP_STASHES_DB_KEY, scrapStashes),
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
                resources: resourcesAfterExpeditions,
                extractionTiles: extractionTilesAfterCapture,
                towers: towersAfterCapture,
                walls: wallsAfterCapture,
                barracksList: barracksListAfterCapture,
                powerStations: powerStationsAfterCapture,
                units: unitsAfterExpeditions,
                garrisons: garrisonsAfterSieges,
                noise: noiseAfterAutoAttack,
                clock,
                base: baseAfterHordes,
                hordes: hordesAfterCorridor,
                territory: territoryAfterExpeditions,
                expeditions: nextExpeditions,
                gameStatus,
                docks,
                scoutSkiffs,
                wanderingScouts,
                scoutedTiles: scoutedTilesAfterCapture,
                dens: densAfterAssaults,
                scrapStashes,
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

  /** Dev tools — jump to a specific rate when it exists in the unlocked cycle. */
  function setDevSpeedMultiplier(rate: number) {
    if (boot.status !== "ready" || !boot.game) return;
    const rates = speedMultiplierRates(boot.tweaks, boot.game.research);
    if (rates.includes(rate)) setSpeedMultiplier(rate);
  }

  /**
   * Shared by every "wipe progress and start over" entry point (fresh
   * onboarding, starting a new game as an existing player, restarting the
   * current map) — the only thing that varies between them is which player
   * identity and which world seed get reused vs regenerated.
   */
  async function resetGame(player: Player, seed: number, gridSize: number = DEFAULT_MAP_SIZE) {
    const current = bootRef.current;
    if (current.status !== "ready") return;
    const { tweaks, profileSlug } = current;
    const mapTweaks = tweaksForMapSize(tweaks, gridSize);
    const world: WorldRecord = { seed, gridSize };
    const territory = createStartingTerritory(world.seed, gridSize);
    const base = initialBase(tweaks);
    const resources = initialResourceAmounts(tweaks);
    const clock: ClockRecord = { lastTickAt: Date.now(), virtualNow: Date.now() };
    const extractionTiles: ExtractionTile[] = [];
    const towers: Tower[] = [];
    const walls: Wall[] = [];
    const barracksList: Barracks[] = [];
    const powerStations: PowerStation[] = [];
    const units = initialUnits();
    const garrisons: GarrisonsRecord = [];
    const scoutedTiles: ScoutedTiles = [];
    const storageLevels = initialStorageLevels();
    const storageUpgrades = initialStorageUpgrades();
    const noise = initialNoise(tweaks);
    const dens = createDens(world.seed, gridSize, territory.base, mapTweaks);
    const hordes: HordesRecord = [];
    const expeditions: ExpeditionsRecord = [];
    const gameStatus = initialGameStatus();
    const docks: DocksRecord = [];
    const scoutSkiffs: ScoutSkiffsRecord = [];
    const wanderingScouts: WanderingScoutsRecord = [];
    const denAssaults: DenAssaultsRecord = [];
    const outposts: OutpostsRecord = [];
    const garrisonRecalls: GarrisonRecallsRecord = [];
    const lab = createLab(world.seed, gridSize, territory.base, dens, mapTweaks);
    const scrapStashes = createScrapStashes(world.seed, gridSize, territory.base, dens, lab, mapTweaks);
    const labAssaults: LabAssaultsRecord = [];
    const research = initialResearch();
    const tombstones: TombstonesRecord = [];

    await Promise.all([
      set(PLAYER_DB_KEY, player),
      set(PROFILE_SLUG_DB_KEY, profileSlug),
      set(WORLD_DB_KEY, world),
      set(TERRITORY_DB_KEY, territory),
      set(BASE_DB_KEY, base),
      set(RESOURCES_DB_KEY, resources),
      set(CLOCK_DB_KEY, clock),
      set(EXTRACTION_TILES_DB_KEY, extractionTiles),
      set(TOWERS_DB_KEY, towers),
      set(WALLS_DB_KEY, walls),
      set(BARRACKS_DB_KEY, barracksList),
      set(POWER_STATIONS_DB_KEY, powerStations),
      set(UNITS_DB_KEY, units),
      set(GARRISONS_DB_KEY, garrisons),
      set(SCOUTED_TILES_DB_KEY, scoutedTiles),
      set(STORAGE_LEVELS_DB_KEY, storageLevels),
      set(STORAGE_UPGRADES_DB_KEY, storageUpgrades),
      set(NOISE_DB_KEY, noise),
      set(DENS_DB_KEY, dens),
      set(SCRAP_STASHES_DB_KEY, scrapStashes),
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

    await recordRecentSeed(seed);
    const recentSeeds = [seed, ...current.recentSeeds.filter((s) => s !== seed)].slice(0, 5);

    setBoot((prev) => {
      if (prev.status !== "ready") return prev;
      const next = {
        ...prev,
        recentSeeds,
        game: {
          player,
          world,
          territory,
          base,
          resources,
          clock,
          extractionTiles,
          towers,
          walls,
          barracksList,
          powerStations,
          units,
          garrisons,
          scoutedTiles,
          storageLevels,
          storageUpgrades,
          noise,
          dens,
          scrapStashes,
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
      };
      bootRef.current = next;
      return next;
    });
  }

  async function handlePlayerCreated({ player, seed, profileSlug, gridSize }: OnboardingResult) {
    const current = bootRef.current;
    if (current.status !== "ready") return;

    let tweaks = current.tweaks;
    if (profileSlug !== current.profileSlug) {
      tweaks = await loadProfile(profileSlug);
      initAssetConfig(profileSlug);
      resetTextureCache();
      const updated = { ...current, tweaks, profileSlug };
      bootRef.current = updated;
      setBoot(updated);
    }

    window.history.replaceState(null, "", `/${profileSlug}`);
    const effectiveGridSize = resolveGridSizeForNewGame(tweaks, gridSize);
    const effectiveSeed = resolveSeedForNewGame(tweaks, seed, generateSeed);
    await resetGame(player, effectiveSeed, effectiveGridSize);
  }

  function handleContinueGame() {
    setBoot((prev) => {
      if (prev.status !== "continuePrompt") return prev;
      window.history.replaceState(null, "", `/${prev.profileSlug}`);
      const next = {
        status: "ready" as const,
        tweaks: prev.tweaks,
        profileSlug: prev.profileSlug,
        profiles: prev.profiles,
        recentSeeds: prev.recentSeeds,
        game: prev.pendingGame,
      };
      bootRef.current = next;
      return next;
    });
  }

  async function handleDeclineContinue() {
    if (boot.status !== "continuePrompt") return;
    const { profiles, recentSeeds } = boot;
    await clearGameSave();
    const profileSlug = resolveProfileSlug(window.location.pathname) ?? DEFAULT_PROFILE_SLUG;
    const tweaks = await loadProfile(profileSlug);
    initAssetConfig(profileSlug);
    resetTextureCache();
    const next = { status: "ready" as const, tweaks, profileSlug, profiles, recentSeeds, game: undefined };
    bootRef.current = next;
    setBoot(next);
  }

  function handleSaveToFile() {
    const current = bootRef.current;
    if (current.status !== "ready" || !current.game) return;
    const save = buildSaveFile(current.game, current.profileSlug);
    downloadSaveFile(save);
  }

  async function applyImportedSave(
    save: SaveFileV1,
    bootMeta: { profiles: ProfileEntry[]; recentSeeds: number[] },
  ): Promise<void> {
    await writeSaveFileToDb(save);
    const stored: StoredGameKeys = keysToStoredGame(save.keys, save.profileSlug);
    const profileSlug = stored.profileSlug ?? save.profileSlug ?? DEFAULT_PROFILE_SLUG;

    let tweaks: Tweaks;
    try {
      tweaks = await loadProfile(profileSlug);
    } catch {
      tweaks = await loadProfile(DEFAULT_PROFILE_SLUG);
    }

    if (
      !stored.player ||
      !stored.world ||
      !stored.territory ||
      !stored.resources ||
      !stored.clock ||
      !stored.storageLevels
    ) {
      throw new Error("Imported save is incomplete after write.");
    }

    initAssetConfig(profileSlug);
    resetTextureCache();
    window.history.replaceState(null, "", `/${profileSlug}`);

    const game = buildGameState(tweaks, {
      player: stored.player as Player,
      world: stored.world as WorldRecord,
      territory: stored.territory as TerritoryRecord,
      base: stored.base as BaseRecord | undefined,
      resources: stored.resources as ResourceAmounts,
      clock: stored.clock as ClockRecord,
      extractionTiles: stored.extractionTiles as ExtractionTile[] | undefined,
      towers: stored.towers as Tower[] | undefined,
      walls: stored.walls as Wall[] | undefined,
      barracksList: stored.barracksList as Barracks[] | undefined,
      powerStations: stored.powerStations as PowerStation[] | undefined,
      units: stored.units as UnitsRecord | undefined,
      garrisons: stored.garrisons as GarrisonsRecord | undefined,
      scoutedTiles: stored.scoutedTiles as ScoutedTiles | undefined,
      storageLevels: stored.storageLevels as StorageLevels,
      storageUpgrades: stored.storageUpgrades as StorageUpgradesRecord | undefined,
      noise: stored.noise as NoiseRecord | undefined,
      dens: stored.dens as DensRecord | undefined,
      scrapStashes: stored.scrapStashes as ScrapStashesRecord | undefined,
      hordes: stored.hordes as HordesRecord | undefined,
      expeditions: stored.expeditions as ExpeditionsRecord | undefined,
      gameStatus: stored.gameStatus as GameStatusRecord | undefined,
      docks: stored.docks as DocksRecord | undefined,
      scoutSkiffs: stored.scoutSkiffs as ScoutSkiffsRecord | undefined,
      wanderingScouts: stored.wanderingScouts as WanderingScoutsRecord | undefined,
      denAssaults: stored.denAssaults as DenAssaultsRecord | undefined,
      outposts: stored.outposts as OutpostsRecord | undefined,
      garrisonRecalls: stored.garrisonRecalls as GarrisonRecallsRecord | undefined,
      lab: stored.lab as LabRecord | undefined,
      labAssaults: stored.labAssaults as LabAssaultsRecord | undefined,
      research: stored.research as ResearchRecord | undefined,
      tombstones: stored.tombstones as TombstonesRecord | undefined,
    });

    const recentSeeds = await getRecentSeeds();
    setSpeedMultiplier(1);
    const next = {
      status: "ready" as const,
      tweaks,
      profileSlug,
      profiles: bootMeta.profiles,
      recentSeeds: recentSeeds.length > 0 ? recentSeeds : bootMeta.recentSeeds,
      game,
    };
    bootRef.current = next;
    setBoot(next);
  }

  async function handleLoadFromFile(options?: { confirmReplace?: boolean }) {
    const current = bootRef.current;
    if (current.status !== "ready" && current.status !== "continuePrompt") return;

    const confirmReplace =
      options?.confirmReplace ??
      (current.status === "continuePrompt" || (current.status === "ready" && current.game != null));

    if (
      confirmReplace &&
      !window.confirm("Load this save file? It will replace the game currently stored in this browser.")
    ) {
      return;
    }

    const file = await pickSaveFile();
    if (!file) return;

    let raw: unknown;
    try {
      raw = await readJsonFromFile(file);
    } catch {
      window.alert("That file isn't valid JSON.");
      return;
    }

    const parsed = parseSaveFile(raw);
    if (!parsed.ok) {
      window.alert(parsed.reason);
      return;
    }

    try {
      await applyImportedSave(parsed.save, {
        profiles: current.profiles,
        recentSeeds: current.recentSeeds,
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : String(err));
    }
  }

  /** Same player AND same world seed — resets progress but replays the identical map, unlike handleStartNewSeed. Reachable from Settings (inline) and from the New Game dialog on GameOverScreen / WinScreen. */
  async function handleReplayCurrentGame() {
    if (boot.status !== "ready" || !boot.game) return;
    await resetGame(boot.game.player, boot.game.world.seed, boot.game.world.gridSize ?? DEFAULT_MAP_SIZE);
  }

  /** Same player identity, a chosen (freshly-generated or player-entered) world seed. */
  async function handleStartNewSeed(seed: number) {
    if (boot.status !== "ready" || !boot.game) return;
    await resetGame(boot.game.player, seed, boot.game.world.gridSize ?? DEFAULT_MAP_SIZE);
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
      game.towers,
      game.walls,
      game.barracksList,
      game.docks,
      game.powerStations,
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

    if (isLandStructureAtTaskCap(tile, game.research)) return { ok: false, reason: STRUCTURE_BUSY_REASON };

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

    if (isBaseHubAtTaskCap(game.base, game.storageUpgrades, game.research)) {
      return { ok: false, reason: BASE_HUB_BUSY_REASON };
    }
    if (game.storageUpgrades[resource as ResourceType]) return { ok: false, reason: STRUCTURE_BUSY_REASON };

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
    setBoot((prev) => {
      if (prev.status !== "ready" || !prev.game) return prev;
      if (isBaseHubAtTaskCap(prev.game.base, prev.game.storageUpgrades, prev.game.research)) return prev;
      if (prev.game.storageUpgrades[resource as ResourceType]) return prev;
      return { ...prev, game: { ...prev.game, resources, storageUpgrades } };
    });
    return { ok: true };
  }

  /** Starts research on `id` — single global pending slot, mirrors handleUpgradeStorage above. Sequential-tier gating (tier 3 needs tier 2 completed) is enforced by isResearchAvailable (engine/research.ts). */
  async function handleStartResearch(id: ResearchId): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (isResearchBusy(game.research)) return { ok: false, reason: STRUCTURE_BUSY_REASON };
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
      game.towers,
      game.walls,
      game.barracksList,
      game.docks,
      game.powerStations,
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
        level: 1,
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

  async function handleUpgradeDock(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const dock = game.docks.find((d) => axialKey(d.coord) === axialKey(coord));
    if (!dock) return { ok: false, reason: "No dock here" };
    if (dock.buildStartedAt != null) return { ok: false, reason: "Still under construction" };
    if (isDockAtTaskCap(dock, game.research)) return { ok: false, reason: STRUCTURE_BUSY_REASON };

    const currentLevel = dockLevel(dock);
    const targetLevel = nextDockLevel(currentLevel);
    if (targetLevel == null || (targetLevel !== 2 && targetLevel !== 3)) {
      return { ok: false, reason: "Dock is already at max level" };
    }

    const cost = dockUpgradeCost(tweaks, targetLevel);
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
            level: currentLevel,
            totalInvested: addToInvestment(d.totalInvested, cost),
            upgrade: { targetLevel, startedAt: game.clock.virtualNow },
            fishingBoatUpgrade: null,
          }
        : d,
    );
    const noiseKey = targetLevel >= 3 ? "build_fishing_boat" : "upgrade_extraction_tile";
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, noiseKey, game.base.level) };

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
    if (isDockAtTaskCap(dock, game.research)) return { ok: false, reason: STRUCTURE_BUSY_REASON };

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
        stepProgressSeconds: 0,
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

  /** Land counterpart of handleBuildScoutSkiff — flat resource cost (10× old one-shot scout train_cost). */
  async function handleBuildWanderingScout(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const barracks = game.barracksList.find((b) => axialKey(b.coord) === axialKey(coord));
    if (!barracks) return { ok: false, reason: "No barracks here" };
    if (isBarracksAtTaskCap(barracks, game.research)) return { ok: false, reason: STRUCTURE_BUSY_REASON };

    const existingAtBarracks = game.wanderingScouts.filter((s) => axialKey(s.homeBarracksCoord) === axialKey(coord)).length;
    if (existingAtBarracks >= tweaks.units.wandering_scout.max_per_barracks) {
      return { ok: false, reason: "This barracks already has a wandering scout" };
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
    const wanderingScouts: WanderingScoutsRecord = [
      ...game.wanderingScouts,
      {
        id: `wandering-scout-${axialKey(coord)}-${game.clock.virtualNow}`,
        coord,
        homeBarracksCoord: coord,
        prevCoord: null,
        spawnedAt: game.clock.virtualNow,
        buildStartedAt: game.clock.virtualNow,
        stepProgressSeconds: 0,
      },
    ];
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "build_wandering_scout", game.base.level) };

    await Promise.all([
      set(RESOURCES_DB_KEY, resources),
      set(WANDERING_SCOUTS_DB_KEY, wanderingScouts),
      set(NOISE_DB_KEY, noise),
    ]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? { ...prev, game: { ...prev.game, resources, wanderingScouts, noise } }
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
      game.towers,
      game.walls,
      game.barracksList,
      game.docks,
      game.powerStations,
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

    if (isLandStructureAtTaskCap(tower, game.research)) return { ok: false, reason: STRUCTURE_BUSY_REASON };

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

  async function handleBuildPowerStation(coord: Axial): Promise<BuildResult> {
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
      game.towers,
      game.walls,
      game.barracksList,
      game.docks,
      game.powerStations,
    );
    if (structureCount >= buildSlotCap(tweaks, game.base.level)) {
      return { ok: false, reason: "Build slot cap reached" };
    }

    const cost = powerStationBuildCost(tweaks, game.powerStations.length + 1);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < amount) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount;
    }
    const powerStations = [
      ...game.powerStations,
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
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "build_power_station", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(POWER_STATIONS_DB_KEY, powerStations), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, powerStations, noise } } : prev,
    );
    return { ok: true };
  }

  async function handleUpgradePowerStation(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const station = game.powerStations.find((s) => axialKey(s.coord) === axialKey(coord));
    if (!station) return { ok: false, reason: "No power station here" };

    if (isLandStructureAtTaskCap(station, game.research)) return { ok: false, reason: STRUCTURE_BUSY_REASON };

    const target = nextPowerStationLevel(station.level);
    if (!target) return { ok: false, reason: "Already at max level" };

    const cost = powerStationUpgradeCost(tweaks, target);
    for (const [key, amount] of Object.entries(cost)) {
      if (game.resources[key as keyof ResourceAmounts] < (amount ?? 0)) {
        return { ok: false, reason: `Not enough ${key}` };
      }
    }

    const resources = { ...game.resources };
    for (const [key, amount] of Object.entries(cost)) {
      resources[key as keyof ResourceAmounts] -= amount ?? 0;
    }
    const powerStations = game.powerStations.map((s) =>
      axialKey(s.coord) === axialKey(coord)
        ? {
            ...s,
            totalInvested: addToInvestment(s.totalInvested, cost),
            upgrade: { targetLevel: target, startedAt: game.clock.virtualNow },
          }
        : s,
    );
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "upgrade_extraction_tile", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(POWER_STATIONS_DB_KEY, powerStations), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, powerStations, noise } } : prev,
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
      game.towers,
      game.walls,
      game.barracksList,
      game.docks,
      game.powerStations,
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

    if (isWallAtTaskCap(wall, game.research)) return { ok: false, reason: STRUCTURE_BUSY_REASON };

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

    if (isWallAtTaskCap(wall, game.research)) return { ok: false, reason: STRUCTURE_BUSY_REASON };

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
    const tower = game.towers.find((t) => axialKey(t.coord) === key);
    const wall = game.walls.find((t) => axialKey(t.coord) === key);
    const barracks = game.barracksList.find((t) => axialKey(t.coord) === key);
    const dock = game.docks.find((t) => axialKey(t.coord) === key);
    const powerStation = game.powerStations.find((t) => axialKey(t.coord) === key);
    const structure = extractionTile ?? tower ?? wall ?? barracks ?? dock ?? powerStation;
    if (!structure) return { ok: false, reason: "Nothing to demolish here" };

    if (extractionTile && hasAnyStructureTask(extractionTile)) {
      return { ok: false, reason: STRUCTURE_BUSY_REASON };
    }
    if (tower && hasAnyStructureTask(tower)) return { ok: false, reason: STRUCTURE_BUSY_REASON };
    if (wall && hasAnyStructureTask(wall)) return { ok: false, reason: STRUCTURE_BUSY_REASON };
    if (barracks && hasAnyStructureTask(barracks)) return { ok: false, reason: STRUCTURE_BUSY_REASON };
    if (dock && countDockTasks(dock) > 0) return { ok: false, reason: STRUCTURE_BUSY_REASON };
    if (powerStation && hasAnyStructureTask(powerStation)) return { ok: false, reason: STRUCTURE_BUSY_REASON };

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
    const powerStations = powerStation
      ? game.powerStations.filter((t) => axialKey(t.coord) !== key)
      : game.powerStations;

    await Promise.all([
      set(RESOURCES_DB_KEY, resources),
      set(EXTRACTION_TILES_DB_KEY, extractionTiles),
      set(TOWERS_DB_KEY, towers),
      set(WALLS_DB_KEY, walls),
      set(BARRACKS_DB_KEY, barracksList),
      set(DOCKS_DB_KEY, docks),
      set(SCOUT_SKIFFS_DB_KEY, scoutSkiffs),
      set(POWER_STATIONS_DB_KEY, powerStations),
    ]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? {
            ...prev,
            game: {
              ...prev.game,
              resources,
              extractionTiles,
              towers,
              walls,
              barracksList,
              docks,
              scoutSkiffs,
              powerStations,
            },
          }
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
    const gridSize = resolveWorldGridSize(game.world, tweaks);
    if (!canRepairHordeDamagedTile(tweaks, game.towers, game.territory, coord, gridSize, game.world.seed)) {
      return { ok: false, reason: "Tile not owned" };
    }

    // A tile can be back in territory.owned (via an expedition claiming it —
    // engine/expeditions.ts, unlike the tower viewshed auto-claim, doesn't
    // check for a live horde) while a horde is still physically standing on
    // it. Repairing a structure a horde is actively occupying makes no sense —
    // it'd just get re-captured/re-damaged, so the horde has to be cleared
    // first (auto-attack from a garrison, or a tower/wall/base fight).
    const hordeOccupiedKeys = new Set(game.hordes.map((h) => axialKey(h.path[h.pathIndex])));
    if (hordeOccupiedKeys.has(key)) return { ok: false, reason: "A horde is still on this tile" };

    const extractionTile = game.extractionTiles.find((t) => axialKey(t.coord) === key);
    const tower = game.towers.find((t) => axialKey(t.coord) === key);
    const wall = game.walls.find((t) => axialKey(t.coord) === key);
    const barracks = game.barracksList.find((t) => axialKey(t.coord) === key);
    const powerStation = game.powerStations.find((t) => axialKey(t.coord) === key);
    const structure = extractionTile ?? tower ?? wall ?? barracks ?? powerStation;
    if (!structure) return { ok: false, reason: "Nothing to repair here" };
    if (!structure.damaged) return { ok: false, reason: "Not damaged" };
    if (isHordeRepairBlocked(structure)) return { ok: false, reason: STRUCTURE_BUSY_REASON };

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
    const towers = tower ? repair(game.towers) : game.towers;
    const walls = wall ? repair(game.walls) : game.walls;
    const barracksList = barracks ? repair(game.barracksList) : game.barracksList;
    const powerStations = powerStation ? repair(game.powerStations) : game.powerStations;
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "repair_wall", game.base.level) };
    const territory =
      ownedKeys.has(key)
        ? game.territory
        : { ...game.territory, owned: [...game.territory.owned, coord] };

    await Promise.all([
      set(RESOURCES_DB_KEY, resources),
      set(EXTRACTION_TILES_DB_KEY, extractionTiles),
      set(TOWERS_DB_KEY, towers),
      set(WALLS_DB_KEY, walls),
      set(BARRACKS_DB_KEY, barracksList),
      set(NOISE_DB_KEY, noise),
      set(POWER_STATIONS_DB_KEY, powerStations),
      ...(ownedKeys.has(key) ? [] : [set(TERRITORY_DB_KEY, territory)]),
    ]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? {
            ...prev,
            game: {
              ...prev.game,
              resources,
              extractionTiles,
              towers,
              walls,
              barracksList,
              powerStations,
              noise,
              territory,
            },
          }
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
      game.towers,
      game.walls,
      game.barracksList,
      game.docks,
      game.powerStations,
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

    if (isBarracksAtTaskCap(barracks, game.research)) return { ok: false, reason: STRUCTURE_BUSY_REASON };

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

  function barracksForTraining(coord: Axial): { ok: true; barracks: Barracks } | { ok: false; reason: string } {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const barracks = boot.game.barracksList.find((b) => axialKey(b.coord) === axialKey(coord));
    if (!barracks) return { ok: false, reason: "No barracks here" };
    if (barracks.trainingQueue) return { ok: false, reason: "Training already in progress at this barracks" };
    if (isBarracksAtTaskCap(barracks, boot.game.research)) return { ok: false, reason: STRUCTURE_BUSY_REASON };
    if (!isStructureActive(barracks)) return { ok: false, reason: "Barracks is not operational" };
    return { ok: true, barracks };
  }

  async function handleTrainMilitia(coord: Axial, quantity: number): Promise<BuildResult> {
    const barracksResult = barracksForTraining(coord);
    if (!barracksResult.ok) return barracksResult;
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
    const barracksList = game.barracksList.map((b) =>
      axialKey(b.coord) === axialKey(coord)
        ? { ...b, trainingQueue: { unitType: "militia" as const, remaining: quantity, currentUnitStartedAt: game.clock.virtualNow } }
        : b,
    );
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "train_militia", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(BARRACKS_DB_KEY, barracksList), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, barracksList, noise } } : prev,
    );
    return { ok: true };
  }

  /** Mirrors handleTrainMilitia exactly, gated by junkyardKnightCapacity's barracks L2 level gate — see engine/barracks.ts. No rush-train variant (calm queue only). */
  async function handleTrainJunkyardKnight(coord: Axial, quantity: number): Promise<BuildResult> {
    const barracksResult = barracksForTraining(coord);
    if (!barracksResult.ok) return barracksResult;
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: "Invalid quantity" };
    if (barracksResult.barracks.level < tweaks.units.junkyard_knight.min_barracks_level) {
      return { ok: false, reason: "This barracks is not high enough level for junkyard knights" };
    }

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
    const barracksList = game.barracksList.map((b) =>
      axialKey(b.coord) === axialKey(coord)
        ? {
            ...b,
            trainingQueue: { unitType: "junkyard_knight" as const, remaining: quantity, currentUnitStartedAt: game.clock.virtualNow },
          }
        : b,
    );
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "train_militia", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(BARRACKS_DB_KEY, barracksList), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, barracksList, noise } } : prev,
    );
    return { ok: true };
  }

  /** Mirrors handleTrainMilitia exactly, gated by crossBowSniperCapacity's barracks L3 level gate — see engine/barracks.ts. No rush-train variant (calm queue only). */
  async function handleTrainCrossBowSniper(coord: Axial, quantity: number): Promise<BuildResult> {
    const barracksResult = barracksForTraining(coord);
    if (!barracksResult.ok) return barracksResult;
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (!Number.isInteger(quantity) || quantity <= 0) return { ok: false, reason: "Invalid quantity" };
    if (barracksResult.barracks.level < tweaks.units.cross_bow_sniper.min_barracks_level) {
      return { ok: false, reason: "This barracks is not high enough level for cross-bow snipers" };
    }

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
    const barracksList = game.barracksList.map((b) =>
      axialKey(b.coord) === axialKey(coord)
        ? {
            ...b,
            trainingQueue: { unitType: "cross_bow_sniper" as const, remaining: quantity, currentUnitStartedAt: game.clock.virtualNow },
          }
        : b,
    );
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "train_militia", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(BARRACKS_DB_KEY, barracksList), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, barracksList, noise } } : prev,
    );
    return { ok: true };
  }

  /**
   * Rush training — delivers immediately, no queue/timer at all, at the same
   * resource cost as calm training. The tradeoff is noise, not resources:
   * addActionNoise's multiplier scales the spike by quantity (every other
   * one-time action is a flat spike regardless of how much you did), so
   * rushing a handful of units is loud and rushing a big batch is a full
   * commotion — unlike the queued path's barely-audible train_militia.
   */
  async function handleRushActiveTraining(coord: Axial): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const barracks = game.barracksList.find((b) => axialKey(b.coord) === axialKey(coord));
    if (!barracks) return { ok: false, reason: "No barracks here" };
    if (!isStructureActive(barracks)) return { ok: false, reason: "Barracks is not operational" };

    const queue = barracks.trainingQueue;
    if (!queue || queue.remaining <= 0) return { ok: false, reason: "No training in progress" };
    if (queue.unitType !== "militia") {
      return { ok: false, reason: "This unit type cannot be rushed" };
    }

    const remaining = queue.remaining;
    if (game.units.militiaCount + remaining > militiaCapacity(tweaks, game.barracksList)) {
      return { ok: false, reason: "Not enough militia capacity" };
    }
    const units: UnitsRecord = { ...game.units, militiaCount: game.units.militiaCount + remaining };

    const barracksList = game.barracksList.map((b) =>
      axialKey(b.coord) === axialKey(coord) ? { ...b, trainingQueue: null } : b,
    );
    const noise: NoiseRecord = {
      value: addActionNoise(tweaks, game.noise.value, "rush_train_militia", game.base.level, remaining),
    };

    await Promise.all([set(UNITS_DB_KEY, units), set(BARRACKS_DB_KEY, barracksList), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, units, barracksList, noise } } : prev,
    );
    return { ok: true };
  }

  async function handleRushTrainMilitia(coord: Axial, quantity: number): Promise<BuildResult> {
    const barracksResult = barracksForTraining(coord);
    if (!barracksResult.ok) return barracksResult;
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

  async function handleUpgradeBase(): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (isBaseHubAtTaskCap(game.base, game.storageUpgrades, game.research)) {
      return { ok: false, reason: BASE_HUB_BUSY_REASON };
    }

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
    const startedAt = game.clock.virtualNow;
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "upgrade_extraction_tile", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) => {
      if (prev.status !== "ready" || !prev.game) return prev;
      if (isBaseHubAtTaskCap(prev.game.base, prev.game.storageUpgrades, prev.game.research)) return prev;
      const base: BaseRecord = {
        ...prev.game.base,
        action: { kind: "level_upgrade", targetLevel, startedAt },
      };
      void set(BASE_DB_KEY, base);
      return { ...prev, game: { ...prev.game, resources, base, noise } };
    });
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

    if (isBaseHubAtTaskCap(game.base, game.storageUpgrades, game.research)) {
      return { ok: false, reason: BASE_HUB_BUSY_REASON };
    }

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
    const startedAt = game.clock.virtualNow;
    const noise: NoiseRecord = { value: addActionNoise(tweaks, game.noise.value, "upgrade_extraction_tile", game.base.level) };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(NOISE_DB_KEY, noise)]);
    setBoot((prev) => {
      if (prev.status !== "ready" || !prev.game) return prev;
      if (isBaseHubAtTaskCap(prev.game.base, prev.game.storageUpgrades, prev.game.research)) return prev;
      const base: BaseRecord = {
        ...prev.game.base,
        action: { kind: "reinforcement_upgrade", targetLevel, startedAt },
      };
      void set(BASE_DB_KEY, base);
      return { ...prev, game: { ...prev.game, resources, base, noise } };
    });
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

    if (isBaseHubAtTaskCap(game.base, game.storageUpgrades, game.research)) {
      return { ok: false, reason: BASE_HUB_BUSY_REASON };
    }

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
    const startedAt = game.clock.virtualNow;

    await Promise.all([set(RESOURCES_DB_KEY, resources)]);
    setBoot((prev) => {
      if (prev.status !== "ready" || !prev.game) return prev;
      if (isBaseHubAtTaskCap(prev.game.base, prev.game.storageUpgrades, prev.game.research)) return prev;
      const base: BaseRecord = {
        ...prev.game.base,
        action: { kind: "reinforcement_repair", startedAt },
      };
      void set(BASE_DB_KEY, base);
      return { ...prev, game: { ...prev.game, resources, base } };
    });
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
    if (isOutpostReinforcementBusy(outpost)) return { ok: false, reason: STRUCTURE_BUSY_REASON };

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
    if (isOutpostReinforcementBusy(outpost)) return { ok: false, reason: STRUCTURE_BUSY_REASON };

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
    if (isBaseHubAtTaskCap(game.base, game.storageUpgrades, game.research)) {
      return { ok: false, reason: BASE_HUB_BUSY_REASON };
    }
    if (axialKey(destination) === axialKey(game.territory.base)) {
      return { ok: false, reason: "Already your base" };
    }
    if (!isWithinMapBounds(destination, resolveWorldGridSize(game.world, tweaks))) return { ok: false, reason: "Out of bounds" };

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
    setBoot((prev) => {
      if (prev.status !== "ready" || !prev.game) return prev;
      if (isBaseHubAtTaskCap(prev.game.base, prev.game.storageUpgrades, prev.game.research)) return prev;
      return { ...prev, game: { ...prev.game, resources, base } };
    });
    return { ok: true };
  }

  /**
   * Dispatches a party along the cheapest owned-preferring route through
   * owned-or-scouted ground (engine/expeditions.ts:findBestExpeditionRoute).
   * Provisions paid upfront; corridor resolves in the tick loop. On arrival
   * the party awaits orders (redeploy / reinforce / recall) instead of
   * dissolving immediately.
   */
  async function handleDispatchExpedition(
    target: Axial,
    militiaCommitted: number,
    junkyardKnightCommitted: number,
    crossBowSniperCommitted: number,
  ): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    if (!isWithinMapBounds(target, resolveWorldGridSize(game.world, tweaks))) return { ok: false, reason: "Out of bounds" };

    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    if (ownedKeys.has(axialKey(target))) return { ok: false, reason: "Already owned" };
    if (game.dens.some((d) => axialKey(d.coord) === axialKey(target))) {
      return { ok: false, reason: "A den stands here — assault it instead" };
    }
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
      resolveWorldGridSize(game.world, tweaks),
      target,
    );
    if (!route) {
      return { ok: false, reason: "No known route — scout a path there, and make sure you have a barracks" };
    }

    const party = clampPartyDispatch(
      game.units,
      game.garrisons,
      game.expeditions,
      game.denAssaults,
      game.garrisonRecalls,
      game.labAssaults,
      militiaCommitted,
      junkyardKnightCommitted,
      crossBowSniperCommitted,
    );
    const partySize = party.militiaCommitted + party.junkyardKnightCommitted + party.crossBowSniperCommitted;
    if (partySize <= 0) return { ok: false, reason: "Commit at least one unit" };

    const provisionsCost = expeditionProvisionsCost(tweaks, partySize, route.cost);
    if (game.resources.food < provisionsCost) return { ok: false, reason: "Not enough food" };

    const resources = { ...game.resources, food: game.resources.food - provisionsCost };
    const departedAt = game.clock.virtualNow;
    const expedition: Expedition = {
      id: `expedition-${axialKey(target)}-${departedAt}`,
      target,
      origin: route.origin,
      path: route.path,
      militiaCommitted: party.militiaCommitted,
      junkyardKnightCommitted: party.junkyardKnightCommitted,
      crossBowSniperCommitted: party.crossBowSniperCommitted,
      departedAt,
      arriveAt: departedAt + expeditionTravelDurationMs(tweaks, route.cost, troopSpeedMultiplier(tweaks, game.research)),
      resolvedIndex: 0,
      phase: "marching",
      provisionsPaid: provisionsCost,
      outboundTileCount: Math.max(0, route.path.length - 1),
      decisionDeadlineAt: null,
      joinExpeditionId: null,
    };
    const expeditions: ExpeditionsRecord = [...game.expeditions, expedition];

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(EXPEDITIONS_DB_KEY, expeditions)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, expeditions } } : prev,
    );
    return { ok: true };
  }

  /** Mid-march or arrival recall — pro-rata food refund only while still outbound. */
  async function handleRecallExpedition(expeditionId: string): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;
    const expedition = game.expeditions.find((e) => e.id === expeditionId);
    if (!expedition) return { ok: false, reason: "Expedition not found" };
    if (expedition.phase === "recalling" || expedition.phase === "reinforcing") {
      return { ok: false, reason: "Already returning or reinforcing" };
    }

    const applyRefund = expedition.phase === "marching";
    const plan = planHomeRecall(
      tweaks,
      game.world.seed,
      normalizeExpedition(expedition),
      game.territory,
      game.scoutedTiles,
      resolveWorldGridSize(game.world, tweaks),
      troopSpeedMultiplier(tweaks, game.research),
      game.clock.virtualNow,
      applyRefund,
    );

    const resources =
      plan.foodRefund > 0
        ? { ...game.resources, food: game.resources.food + plan.foodRefund }
        : game.resources;

    const expeditions: ExpeditionsRecord = plan.next
      ? game.expeditions.map((e) => (e.id === expeditionId ? { ...normalizeExpedition(e), ...plan.next! } : e))
      : game.expeditions.filter((e) => e.id !== expeditionId);

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(EXPEDITIONS_DB_KEY, expeditions)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, expeditions } } : prev,
    );
    return { ok: true };
  }

  /**
   * Arrival order: station the awaiting party on their destination hex and end
   * the expedition. Same land/ownership/horde/den guards as handleGarrisonUnits;
   * units move from expedition commitment into the garrison pool (no UnitsRecord change).
   */
  async function handleGarrisonExpedition(expeditionId: string): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;
    const expedition = game.expeditions.find((e) => e.id === expeditionId);
    if (!expedition) return { ok: false, reason: "Expedition not found" };
    if (expedition.phase !== "awaitingOrders") {
      return { ok: false, reason: "Party is not waiting for orders" };
    }

    const normalized = normalizeExpedition(expedition);
    const coord = normalized.path[normalized.path.length - 1] ?? normalized.target;
    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    if (!ownedKeys.has(axialKey(coord))) return { ok: false, reason: "Tile not owned" };
    if (!isBuildableLand(game.world.seed, coord)) return { ok: false, reason: "Cannot garrison on water" };

    const hordeOccupiedKeys = new Set(game.hordes.map((h) => axialKey(h.path[h.pathIndex])));
    if (hordeOccupiedKeys.has(axialKey(coord))) return { ok: false, reason: "A horde is still on this tile" };

    const hostileDenHere = game.dens.some((d) => axialKey(d.coord) === axialKey(coord) && !d.siege);
    if (hostileDenHere) return { ok: false, reason: "A hostile den occupies this tile — assault it first" };

    const partySize =
      normalized.militiaCommitted + normalized.junkyardKnightCommitted + normalized.crossBowSniperCommitted;
    if (partySize <= 0) return { ok: false, reason: "No units to garrison" };

    const stationed = stationExpeditionAsGarrison(normalized, game.garrisons, game.expeditions);
    const noise: NoiseRecord = {
      value: addActionNoise(tweaks, game.noise.value, "garrison_militia", game.base.level),
    };

    await Promise.all([
      set(GARRISONS_DB_KEY, stationed.garrisons),
      set(EXPEDITIONS_DB_KEY, stationed.expeditions),
      set(NOISE_DB_KEY, noise),
    ]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? {
            ...prev,
            game: {
              ...prev.game,
              garrisons: stationed.garrisons,
              expeditions: stationed.expeditions,
              noise,
            },
          }
        : prev,
    );
    return { ok: true };
  }

  /** From awaitingOrders (or mid-march via UI), start a new outbound leg from the party's current hex. */
  async function handleRedeployExpedition(
    expeditionId: string,
    target: Axial,
  ): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;
    const expedition = game.expeditions.find((e) => e.id === expeditionId);
    if (!expedition) return { ok: false, reason: "Expedition not found" };
    if (expedition.phase !== "awaitingOrders" && expedition.phase !== "marching") {
      return { ok: false, reason: "Cannot redeploy now" };
    }
    if (!isWithinMapBounds(target, resolveWorldGridSize(game.world, tweaks))) {
      return { ok: false, reason: "Out of bounds" };
    }
    if (game.dens.some((d) => axialKey(d.coord) === axialKey(target))) {
      return { ok: false, reason: "A den stands here — assault it instead" };
    }
    if (axialKey(game.lab.coord) === axialKey(target)) {
      return { ok: false, reason: "The lab is guarded — assault it instead" };
    }

    const normalized = normalizeExpedition(expedition);
    const from =
      normalized.phase === "awaitingOrders"
        ? normalized.path[normalized.path.length - 1]!
        : normalized.path[Math.min(normalized.resolvedIndex, normalized.path.length - 1)]!;

    const route = findExpeditionRouteFrom(
      tweaks,
      game.world.seed,
      from,
      target,
      game.territory,
      game.scoutedTiles,
      resolveWorldGridSize(game.world, tweaks),
    );
    if (!route) return { ok: false, reason: "No known route to that destination" };

    const partySize =
      normalized.militiaCommitted + normalized.junkyardKnightCommitted + normalized.crossBowSniperCommitted;
    const provisionsCost = expeditionProvisionsCost(tweaks, partySize, route.cost);
    if (game.resources.food < provisionsCost) return { ok: false, reason: "Not enough food" };

    // Mid-march redeploy: refund unused outbound, then charge the new leg.
    let food = game.resources.food;
    if (normalized.phase === "marching") {
      food += provisionsRefund(
        normalized.provisionsPaid,
        normalized.resolvedIndex,
        normalized.outboundTileCount,
      );
    }
    food -= provisionsCost;
    if (food < 0) return { ok: false, reason: "Not enough food" };

    const departedAt = game.clock.virtualNow;
    const updated: Expedition = {
      ...normalized,
      target,
      path: route.path,
      departedAt,
      arriveAt: departedAt + expeditionTravelDurationMs(tweaks, route.cost, troopSpeedMultiplier(tweaks, game.research)),
      resolvedIndex: 0,
      phase: "marching",
      provisionsPaid: provisionsCost,
      outboundTileCount: Math.max(0, route.path.length - 1),
      decisionDeadlineAt: null,
      joinExpeditionId: null,
    };
    const resources = { ...game.resources, food };
    const expeditions = game.expeditions.map((e) => (e.id === expeditionId ? updated : e));
    await Promise.all([set(RESOURCES_DB_KEY, resources), set(EXPEDITIONS_DB_KEY, expeditions)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, expeditions } } : prev,
    );
    return { ok: true };
  }

  /** Send a half-cost/time detachment to join an awaitingOrders expedition. */
  async function handleReinforceExpedition(
    expeditionId: string,
    militiaCommitted: number,
    junkyardKnightCommitted: number,
    crossBowSniperCommitted: number,
  ): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;
    const host = game.expeditions.find((e) => e.id === expeditionId);
    if (!host || host.phase !== "awaitingOrders") {
      return { ok: false, reason: "Expedition is not waiting for orders" };
    }
    const joinTile = host.path[host.path.length - 1]!;
    const route = findBestExpeditionRoute(
      tweaks,
      game.world.seed,
      game.barracksList,
      game.towers,
      game.outposts,
      game.territory,
      game.scoutedTiles,
      resolveWorldGridSize(game.world, tweaks),
      joinTile,
    );
    if (!route) return { ok: false, reason: "No known route to the party" };

    const party = clampPartyDispatch(
      game.units,
      game.garrisons,
      game.expeditions,
      game.denAssaults,
      game.garrisonRecalls,
      game.labAssaults,
      militiaCommitted,
      junkyardKnightCommitted,
      crossBowSniperCommitted,
    );
    const partySize = party.militiaCommitted + party.junkyardKnightCommitted + party.crossBowSniperCommitted;
    if (partySize <= 0) return { ok: false, reason: "Commit at least one unit" };

    const provisionsCost = reinforceProvisionsCost(tweaks, partySize, route.cost);
    if (game.resources.food < provisionsCost) return { ok: false, reason: "Not enough food" };

    const departedAt = game.clock.virtualNow;
    const reinforcing: Expedition = {
      id: `reinforce-${expeditionId}-${departedAt}`,
      target: joinTile,
      origin: route.origin,
      path: route.path,
      militiaCommitted: party.militiaCommitted,
      junkyardKnightCommitted: party.junkyardKnightCommitted,
      crossBowSniperCommitted: party.crossBowSniperCommitted,
      departedAt,
      arriveAt: departedAt + reinforceTravelDurationMs(tweaks, route.cost, troopSpeedMultiplier(tweaks, game.research)),
      resolvedIndex: 0,
      phase: "reinforcing",
      provisionsPaid: provisionsCost,
      outboundTileCount: Math.max(0, route.path.length - 1),
      decisionDeadlineAt: null,
      joinExpeditionId: expeditionId,
    };
    const resources = { ...game.resources, food: game.resources.food - provisionsCost };
    const expeditions = [...game.expeditions, reinforcing];
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
      resolveWorldGridSize(game.world, tweaks),
      den.coord,
    );
    if (!route) {
      return { ok: false, reason: "No known route — scout the den, and make sure you have a barracks" };
    }

    const hordeOccupiedKeys = new Set(game.hordes.map((h) => axialKey(h.path[h.pathIndex])));
    if (route.path.some((tile) => hordeOccupiedKeys.has(axialKey(tile)))) {
      return { ok: false, reason: "A horde blocks this route" };
    }

    const party = clampPartyDispatch(
      game.units,
      game.garrisons,
      game.expeditions,
      game.denAssaults,
      game.garrisonRecalls,
      game.labAssaults,
      militiaCommitted,
      junkyardKnightCommitted,
      crossBowSniperCommitted,
    );
    const partySize = party.militiaCommitted + party.junkyardKnightCommitted + party.crossBowSniperCommitted;
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
      militiaCommitted: party.militiaCommitted,
      junkyardKnightCommitted: party.junkyardKnightCommitted,
      crossBowSniperCommitted: party.crossBowSniperCommitted,
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
      resolveWorldGridSize(game.world, tweaks),
      game.lab.coord,
    );
    if (!route) {
      return { ok: false, reason: "No known route — scout the lab, and make sure you have a barracks" };
    }

    const hordeOccupiedKeys = new Set(game.hordes.map((h) => axialKey(h.path[h.pathIndex])));
    if (route.path.some((tile) => hordeOccupiedKeys.has(axialKey(tile)))) {
      return { ok: false, reason: "A horde blocks this route" };
    }

    const party = clampPartyDispatch(
      game.units,
      game.garrisons,
      game.expeditions,
      game.denAssaults,
      game.garrisonRecalls,
      game.labAssaults,
      militiaCommitted,
      junkyardKnightCommitted,
      crossBowSniperCommitted,
    );
    const partySize = party.militiaCommitted + party.junkyardKnightCommitted + party.crossBowSniperCommitted;
    if (partySize <= 0) return { ok: false, reason: "Commit at least one unit" };

    const provisionsCost = expeditionProvisionsCost(tweaks, partySize, route.cost);
    if (game.resources.food < provisionsCost) return { ok: false, reason: "Not enough food" };

    const resources = { ...game.resources, food: game.resources.food - provisionsCost };
    const departedAt = game.clock.virtualNow;
    const assault: LabAssaultRecord = {
      id: `labAssault-${departedAt}`,
      target: game.lab.coord,
      path: route.path,
      militiaCommitted: party.militiaCommitted,
      junkyardKnightCommitted: party.junkyardKnightCommitted,
      crossBowSniperCommitted: party.crossBowSniperCommitted,
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
   * Stations any mix of free militia / junkyard knights / cross-bow snipers
   * on an owned tile — a mobile defense that stacks additively with any
   * tower/wall there (engine/hordes.ts:hordeTileDefense) and auto-attacks
   * any horde on itself or a neighbor every tick
   * (engine/hordes.ts:resolveGarrisonAutoAttacks, run from the tick loop
   * below — no manual action needed). Unlike building a structure, this
   * never checks isHexOccupied — a garrison is not a structure and never
   * blocks (or is blocked by) one.
   */
  async function handleGarrisonUnits(
    coord: Axial,
    militiaCount: number,
    junkyardKnightCount: number,
    crossBowSniperCount: number,
  ): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const ownedKeys = new Set(game.territory.owned.map(axialKey));
    if (!ownedKeys.has(axialKey(coord))) return { ok: false, reason: "Tile not owned" };
    if (!isBuildableLand(game.world.seed, coord)) return { ok: false, reason: "Cannot garrison on water" };

    // A tile can be back in territory.owned (via an expedition claiming it —
    // engine/expeditions.ts, unlike the tower viewshed auto-claim, doesn't
    // check for a live horde) while a horde is still physically standing on
    // it. Stationing units into a fight that's already effectively lost (the
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

    const countsValid =
      Number.isInteger(militiaCount) &&
      militiaCount >= 0 &&
      militiaCount <= availableMilitia(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults) &&
      Number.isInteger(junkyardKnightCount) &&
      junkyardKnightCount >= 0 &&
      junkyardKnightCount <=
        availableJunkyardKnights(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults) &&
      Number.isInteger(crossBowSniperCount) &&
      crossBowSniperCount >= 0 &&
      crossBowSniperCount <=
        availableCrossBowSnipers(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls, game.labAssaults);
    if (!countsValid) return { ok: false, reason: "Invalid unit counts" };
    if (militiaCount + junkyardKnightCount + crossBowSniperCount <= 0) {
      return { ok: false, reason: "Station at least one unit" };
    }

    const garrisons = mergeIntoGarrison(
      game.garrisons,
      coord,
      militiaCount,
      junkyardKnightCount,
      crossBowSniperCount,
    );
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
      resolveWorldGridSize(game.world, tweaks),
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

  if (boot.status === "continuePrompt") {
    return (
      <ContinueGamePrompt
        profileName={profileDisplayName(boot.profiles, boot.profileSlug)}
        onContinue={handleContinueGame}
        onStartNew={handleDeclineContinue}
        onLoadFromFile={() => {
          void handleLoadFromFile({ confirmReplace: true });
        }}
      />
    );
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
      towers={boot.game.towers}
      walls={boot.game.walls}
      barracksList={boot.game.barracksList}
      powerStations={boot.game.powerStations}
      units={boot.game.units}
      garrisons={boot.game.garrisons}
      scoutedTiles={boot.game.scoutedTiles}
      storageLevels={boot.game.storageLevels}
      storageUpgrades={boot.game.storageUpgrades}
      noise={boot.game.noise}
      dens={boot.game.dens}
      scrapStashes={boot.game.scrapStashes}
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
      onSetSpeedMultiplier={setDevSpeedMultiplier}
      onDismissToast={dismissToast}
      onStartResearch={handleStartResearch}
      onBuildExtractionTile={handleBuildExtractionTile}
      onUpgradeExtractionTile={handleUpgradeExtractionTile}
      onUpgradeStorage={handleUpgradeStorage}
      onCollectTile={handleCollectTile}
      onBuildTower={handleBuildTower}
      onUpgradeTower={handleUpgradeTower}
      onBuildPowerStation={handleBuildPowerStation}
      onUpgradePowerStation={handleUpgradePowerStation}
      onBuildWall={handleBuildWall}
      onUpgradeWall={handleUpgradeWall}
      onRepairWall={handleRepairWall}
      onRepairStructure={handleRepairStructure}
      onDemolish={handleDemolish}
      onBuildBarracks={handleBuildBarracks}
      onUpgradeBarracks={handleUpgradeBarracks}
      onTrainMilitia={handleTrainMilitia}
      onTrainJunkyardKnight={handleTrainJunkyardKnight}
      onTrainCrossBowSniper={handleTrainCrossBowSniper}
      onRushTrainMilitia={handleRushTrainMilitia}
      onRushActiveTraining={handleRushActiveTraining}
      onUpgradeBase={handleUpgradeBase}
      onUpgradeReinforcement={handleUpgradeReinforcement}
      onRepairBase={handleRepairBase}
      onUpgradeOutpostReinforcement={handleUpgradeOutpostReinforcement}
      onRepairOutpost={handleRepairOutpost}
      onRelocateBase={handleRelocateBase}
      onDispatchExpedition={handleDispatchExpedition}
      onRecallExpedition={handleRecallExpedition}
      onGarrisonExpedition={handleGarrisonExpedition}
      onRedeployExpedition={handleRedeployExpedition}
      onReinforceExpedition={handleReinforceExpedition}
      onAssaultDen={handleAssaultDen}
      onSecureLab={handleSecureLab}
      onGarrisonUnits={handleGarrisonUnits}
      onRecallMilitia={handleRecallMilitia}
      onBuildDock={handleBuildDock}
      onUpgradeDock={handleUpgradeDock}
      onBuildScoutSkiff={handleBuildScoutSkiff}
      onCollectDock={handleCollectDock}
      onBuildWanderingScout={handleBuildWanderingScout}
      onReplayCurrent={handleReplayCurrentGame}
      onStartNewSeed={handleStartNewSeed}
      onNewPlayer={handleNewPlayer}
      onSaveToFile={handleSaveToFile}
      onLoadFromFile={() => {
        void handleLoadFromFile({ confirmReplace: true });
      }}
    />
  ) : boot.status === "ready" ? (
    <OnboardingScreen
      profiles={boot.profiles}
      initialProfileSlug={boot.profileSlug}
      recentSeeds={boot.recentSeeds}
      onCreated={handlePlayerCreated}
      onLoadFromFile={() => {
        void handleLoadFromFile({ confirmReplace: false });
      }}
    />
  ) : null;
}
