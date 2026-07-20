import { useEffect, useRef, useState } from "react";
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
import { NOISE_DB_KEY, initialNoise, type NoiseRecord } from "./data/noise";
import { TOWERS_DB_KEY, type Tower } from "./data/towers";
import { WALLS_DB_KEY, type Wall } from "./data/walls";
import { BARRACKS_DB_KEY, type Barracks } from "./data/barracks";
import { UNITS_DB_KEY, initialUnits, type UnitsRecord } from "./data/units";
import { GARRISONS_DB_KEY, type GarrisonsRecord } from "./data/garrisons";
import { SCOUTED_TILES_DB_KEY, type ScoutedTiles } from "./data/scoutedTiles";
import { DENS_DB_KEY, createDens, resolveDen, type DenRecord, type DensRecord } from "./data/dens";
import { DEN_ASSAULTS_DB_KEY, type DenAssaultRecord, type DenAssaultsRecord } from "./data/denAssaults";
import { GARRISON_RECALLS_DB_KEY, type GarrisonRecallRecord, type GarrisonRecallsRecord } from "./data/garrisonRecalls";
import { OUTPOSTS_DB_KEY, createOutpostFromDen, type OutpostsRecord } from "./data/outposts";
import { HORDES_DB_KEY, type HordesRecord } from "./data/hordes";
import { DOCKS_DB_KEY, type DocksRecord } from "./data/docks";
import { SCOUT_SKIFFS_DB_KEY, type ScoutSkiffsRecord } from "./data/scoutSkiffs";
import { WANDERING_SCOUTS_DB_KEY, type WanderingScoutsRecord } from "./data/wanderingScouts";
import { EXPEDITIONS_DB_KEY, type Expedition, type ExpeditionsRecord } from "./data/expeditions";
import { GAME_STATUS_DB_KEY, initialGameStatus, type GameStatusRecord } from "./data/gameStatus";
import type { ResourceType } from "./data/resources";
import { get, set } from "./persistence/db";
import { axialDistance, axialKey, axialSpiral, isWithinMapBounds, type Axial } from "./engine/hexCoords";
import { accrueResources, collectTile } from "./engine/tick";
import { addToInvestment, buildSlotCap, demolishRefund, repairCost, scaledCostMap, totalStructureCount } from "./engine/formulas";
import {
  baseReinforcementHp,
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
  expeditionProvisionsCost,
  expeditionTravelDurationMs,
  findBestExpeditionRoute,
  partyAttackPower,
  recallDurationMs,
  resolveExpeditionWalk,
} from "./engine/expeditions";
import { nextTier, tierUpgradeCost, tierUpgradeDurationMs } from "./engine/tiers";
import { storageCapacity, storageUpgradeCost } from "./engine/storage";
import { nextPathTier, pathBuildCost, pathUpgradeCost, pathUpgradeDurationMs } from "./engine/paths";
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
import {
  maxOutpostReinforcementLevel,
  outpostReinforcementHp,
  outpostReinforcementUpgradeCost,
  outpostRepairCost,
  revertOutpostToDen,
} from "./engine/outposts";
import { accrueDockResources, collectDock } from "./engine/docks";
import { advanceScoutSkiffs } from "./engine/scoutSkiffs";
import { advanceWanderingScouts } from "./engine/wanderingScouts";
import { nextTowerLevel, towerBuildCost, towerUpgradeCost, towerUpgradeDurationMs } from "./engine/towers";
import {
  maxWallDurability,
  nextWallTier,
  wallBuildCost,
  wallRepairCost,
  wallRepairDurationMs,
  wallUpgradeCost,
  wallUpgradeDurationMs,
} from "./engine/walls";
import {
  barracksBuildCost,
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
import { GameOverScreen } from "./ui/GameOverScreen";
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
 * a plain on/off toggle. The 10x "testing" tier only exists in dev builds
 * (import.meta.env.DEV) — absent from the cycle entirely in production.
 */
const SPEED_MULTIPLIER_RATES = import.meta.env.DEV ? [1, 2, 5, 10] : [1, 2, 5];

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
        ]);
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
                noise: noise ?? initialNoise(tweaks),
                // resolveDen spreads siege:null over any pre-M14 den missing it.
                dens: (dens ?? []).map(resolveDen),
                hordes: hordes ?? [],
                expeditions: expeditions ?? [],
                gameStatus: gameStatus ?? initialGameStatus(),
                docks: docks ?? [],
                scoutSkiffs: scoutSkiffs ?? [],
                wanderingScouts: wanderingScouts ?? [],
                denAssaults: denAssaults ?? [],
                outposts: outposts ?? [],
                garrisonRecalls: garrisonRecalls ?? [],
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
      if (current.game.gameStatus.lost) return; // frozen — DESIGN.md §13 loss condition already hit
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
      // directly.
      const outpostsAfterYield: OutpostsRecord = current.game.outposts;
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
      const baseAfterUpgrade: BaseRecord =
        currentUpgrade && isBaseUpgradeComplete(current.tweaks, currentUpgrade, virtualNow)
          ? { ...current.game.base, level: currentUpgrade.targetLevel, upgrade: null }
          : current.game.base;

      // Base relocation timer — same virtual-clock-threshold pattern as the
      // upgrade check above. This is the one place territory.base is ever
      // reassigned; resolved here (before hordeSpawns/advanceHordes/
      // garrisonDefense below) so the rest of this tick's horde logic already
      // sees wherever the base ends up. Everything else (towers, walls,
      // barracks, garrisons, dens) stays exactly where it was — only the
      // base coordinate moves, and the destination tile joins territory.owned
      // if it wasn't already (a base always sits on owned ground).
      const relocation = baseAfterUpgrade.relocation;
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
          ? { ...baseAfterUpgrade, relocation: null }
          : baseAfterUpgrade;

      // Structure upgrade/repair timers — same virtual-clock-threshold
      // pattern as the base-level check above, resolved per structure array.
      // Must map over extractionTilesAfterYield (not
      // current.game.extractionTiles), or this tick's just-accrued stockpile
      // deltas would be silently discarded.
      const extractionTiles = extractionTilesAfterYield.map((t) =>
        t.upgrade && isTimerComplete(t.upgrade.startedAt, tierUpgradeDurationMs(current.tweaks, t.upgrade.targetTier), virtualNow)
          ? { ...t, tier: t.upgrade.targetTier, upgrade: null }
          : t,
      );
      const pathTiles = current.game.pathTiles.map((t) =>
        t.upgrade && isTimerComplete(t.upgrade.startedAt, pathUpgradeDurationMs(current.tweaks, t.upgrade.targetTier), virtualNow)
          ? { ...t, tier: t.upgrade.targetTier, upgrade: null }
          : t,
      );
      const towers = current.game.towers.map((t) =>
        t.upgrade && isTimerComplete(t.upgrade.startedAt, towerUpgradeDurationMs(current.tweaks, t.upgrade.targetLevel), virtualNow)
          ? { ...t, level: t.upgrade.targetLevel, upgrade: null }
          : t,
      );
      const barracksList = current.game.barracksList.map((b) =>
        b.upgrade &&
        isTimerComplete(b.upgrade.startedAt, barracksUpgradeDurationMs(current.tweaks, b.upgrade.targetLevel), virtualNow)
          ? { ...b, level: b.upgrade.targetLevel, upgrade: null }
          : b,
      );
      const walls = current.game.walls.map((w) => {
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
      });
      // Must map over docksAfterYield (not current.game.docks), or this
      // tick's just-accrued stockpile deltas would be silently discarded —
      // same reasoning as extractionTiles above.
      const docks = docksAfterYield.map((d) =>
        d.fishingBoatUpgrade &&
        isTimerComplete(d.fishingBoatUpgrade.startedAt, current.tweaks.docks.fishing_boat.build_time_minutes * 60_000, virtualNow)
          ? { ...d, fishingBoat: true, fishingBoatUpgrade: null }
          : d,
      );
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
        current.tweaks.game.grid_size,
        now,
        elapsedSeconds,
      );
      const baseGarrisonDefense = garrisonDefense(current.tweaks, current.game.garrisons, territoryAfterRelocation.base);
      // Every live Outpost is a defended point exactly like the main base —
      // see engine/hordes.ts:HordeHub's doc comment. Regular hordes still
      // only ever path toward territoryAfterRelocation.base; an outpost only
      // takes damage here if it happens to sit on that route.
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
      const gameStatus: GameStatusRecord = baseOverrun ? { lost: true, lostAt: now } : current.game.gameStatus;
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
      const territoryAfterClaim = autoClaimTowerRange(
        current.tweaks,
        towersAfterCapture,
        territory,
        current.tweaks.game.grid_size,
        hordeOccupiedKeys,
      );

      // Expeditions resolve after everything above (hordes, garrison
      // captures/auto-attacks, tower auto-claim) so a party sees the same
      // post-horde-advance territory a repair/garrison action would this
      // same tick — e.g. a tile a horde just recaptured is re-fought as
      // unowned, not treated as stale free passage from dispatch time.
      // Resolved sequentially (not Promise.all/in parallel), oldest arrival
      // first, so two expeditions sharing a corridor in the same tick see
      // each other's just-claimed tiles as free passage, same as the
      // sequential garrison-by-garrison pattern resolveGarrisonAutoAttacks
      // already uses above.
      const dueExpeditions = current.game.expeditions
        .filter((e) => virtualNow >= e.arriveAt)
        .sort((a, b) => a.arriveAt - b.arriveAt);
      const pendingExpeditions = current.game.expeditions.filter((e) => virtualNow < e.arriveAt);

      let territoryAfterExpeditions = territoryAfterClaim;
      let unitsAfterExpeditions = unitsAfterAutoAttack;
      for (const expedition of dueExpeditions) {
        const debitParty = (u: UnitsRecord): UnitsRecord => ({
          ...u,
          militiaCount: Math.max(0, u.militiaCount - expedition.militiaCommitted),
          junkyardKnightCount: Math.max(0, u.junkyardKnightCount - expedition.junkyardKnightCommitted),
          crossBowSniperCount: Math.max(0, u.crossBowSniperCount - expedition.crossBowSniperCommitted),
        });

        // A horde may have moved onto the route since dispatch (or was
        // already there and never re-checked) — "the road was overrun," a
        // deliberate first-pass rule (tweaks.jsonc expeditions._note):
        // the party is lost outright without even attempting the walk.
        const routeBlocked = expedition.path.some((tile) => hordeOccupiedKeys.has(axialKey(tile)));
        if (routeBlocked) {
          unitsAfterExpeditions = debitParty(unitsAfterExpeditions);
          continue;
        }

        const attackPower = partyAttackPower(
          current.tweaks,
          expedition.militiaCommitted,
          expedition.junkyardKnightCommitted,
          expedition.crossBowSniperCommitted,
        );
        const { claimedTiles, survived } = resolveExpeditionWalk(
          current.tweaks,
          expedition.path,
          territoryAfterExpeditions.owned,
          territoryAfterExpeditions.base,
          attackPower,
        );
        if (claimedTiles.length > 0) {
          territoryAfterExpeditions = {
            ...territoryAfterExpeditions,
            owned: [...territoryAfterExpeditions.owned, ...claimedTiles],
          };
        }
        if (!survived) {
          unitsAfterExpeditions = debitParty(unitsAfterExpeditions);
        }
      }

      // Den assaults resolve the same way expeditions do (sequential,
      // oldest-arrival-first, route-blocked-by-horde first) — see
      // App.tsx:handleAssaultDen's doc comment. The corridor leading up to
      // the den is walked/claimed exactly like an expedition's route. What
      // happens at the destination then depends on the den's state *at
      // arrival*, not at dispatch time — the same DenAssaultRecord/denAssaults
      // array is used for both an initial assault AND reinforcing an
      // already-besieged den (or a den that has since converted to an
      // outpost): if the den is still hostile (never sieged, or a past siege
      // failed before this party arrived), it's a real fight against
      // denDefense (engine/dens.ts:resolveDenAssault) with proportional
      // attrition on a win (engine/dens.ts:denAssaultSurvivors) — unlike
      // every other fight in this game, which is all-or-nothing. If the den
      // is already under siege, or has already converted to an outpost,
      // there's nothing to fight — the whole party that survived the
      // corridor just joins the garrison there directly, no attrition (they're
      // marching into already-friendly ground, not storming anything).
      const dueDenAssaults = current.game.denAssaults
        .filter((a) => virtualNow >= a.arriveAt)
        .sort((a, b) => a.arriveAt - b.arriveAt);
      const pendingDenAssaults = current.game.denAssaults.filter((a) => virtualNow < a.arriveAt);

      let densAfterAssaults = [...current.game.dens, ...revertedDens];
      let garrisonsAfterSieges = garrisonsAfterAutoAttack;
      let outpostsAfterSieges = outpostsAfterHordes;

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

      for (const assault of dueDenAssaults) {
        const debitParty = (u: UnitsRecord): UnitsRecord => ({
          ...u,
          militiaCount: Math.max(0, u.militiaCount - assault.militiaCommitted),
          junkyardKnightCount: Math.max(0, u.junkyardKnightCount - assault.junkyardKnightCommitted),
          crossBowSniperCount: Math.max(0, u.crossBowSniperCount - assault.crossBowSniperCommitted),
        });

        const den = densAfterAssaults.find((d) => d.id === assault.denId);
        const outpost = !den ? outpostsAfterSieges.find((o) => o.id === `outpost-${assault.denId}`) : null;
        if (!den && !outpost) continue; // gone with no outpost either — shouldn't happen, but a harmless no-op if it does

        const routeBlocked = assault.path.some((tile) => hordeOccupiedKeys.has(axialKey(tile)));
        if (routeBlocked) {
          unitsAfterExpeditions = debitParty(unitsAfterExpeditions);
          continue;
        }

        const attackPower = partyAttackPower(
          current.tweaks,
          assault.militiaCommitted,
          assault.junkyardKnightCommitted,
          assault.crossBowSniperCommitted,
        );

        // The den itself (when there's one to fight) is fought separately
        // from the corridor leading to it (last path element = the den's own
        // coord) — resolveExpeditionWalk only claims ordinary map tiles.
        const corridor = assault.path.slice(0, -1);
        const { claimedTiles, survived: corridorSurvived } = resolveExpeditionWalk(
          current.tweaks,
          corridor,
          territoryAfterExpeditions.owned,
          territoryAfterExpeditions.base,
          attackPower,
        );
        if (claimedTiles.length > 0) {
          territoryAfterExpeditions = {
            ...territoryAfterExpeditions,
            owned: [...territoryAfterExpeditions.owned, ...claimedTiles],
          };
        }
        if (!corridorSurvived) {
          unitsAfterExpeditions = debitParty(unitsAfterExpeditions);
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
          unitsAfterExpeditions = debitParty(unitsAfterExpeditions);
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
            const startingRing = axialSpiral(den.coord, current.tweaks.outposts.starting_owned_radius);
            const ownedKeysSoFar = new Set(territoryAfterExpeditions.owned.map(axialKey));
            const newlyOwned = startingRing.filter((coord) => !ownedKeysSoFar.has(axialKey(coord)));
            if (newlyOwned.length > 0) {
              territoryAfterExpeditions = {
                ...territoryAfterExpeditions,
                owned: [...territoryAfterExpeditions.owned, ...newlyOwned],
              };
            }
            return null; // the den no longer exists — it's an outpost now
          }

          return denAfterHold;
        })
        .filter((d): d is DenRecord => d !== null);

      // A recalled garrison is a pure timer, not a fight — the troops were
      // already pulled off their tile the moment the recall was dispatched
      // (App.tsx:handleRecallMilitia), and were never actually removed from
      // units.*Count (same "reserved, not removed" pattern expeditions/den
      // assaults use), so once a recall's record is dropped here it's
      // automatically back in the available pool — nothing else to resolve.
      const pendingGarrisonRecalls = current.game.garrisonRecalls.filter((r) => virtualNow < r.arriveAt);

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
        set(EXPEDITIONS_DB_KEY, pendingExpeditions),
        set(GAME_STATUS_DB_KEY, gameStatus),
        set(DOCKS_DB_KEY, docks),
        set(SCOUT_SKIFFS_DB_KEY, scoutSkiffs),
        set(WANDERING_SCOUTS_DB_KEY, wanderingScouts),
        set(SCOUTED_TILES_DB_KEY, scoutedTiles),
        set(DENS_DB_KEY, densAfterAssaults),
        set(DEN_ASSAULTS_DB_KEY, pendingDenAssaults),
        set(OUTPOSTS_DB_KEY, outpostsAfterSieges),
        set(GARRISON_RECALLS_DB_KEY, pendingGarrisonRecalls),
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
                expeditions: pendingExpeditions,
                gameStatus,
                docks,
                scoutSkiffs,
                wanderingScouts,
                scoutedTiles,
                dens: densAfterAssaults,
                denAssaults: pendingDenAssaults,
                outposts: outpostsAfterSieges,
                garrisonRecalls: pendingGarrisonRecalls,
              },
            }
          : prev,
      );
    }

    runTick();
    const interval = setInterval(runTick, 1000);
    return () => clearInterval(interval);
  }, [hasGame]);

  function cycleFastForward() {
    setSpeedMultiplier((m) => {
      const currentIndex = SPEED_MULTIPLIER_RATES.indexOf(m);
      const nextIndex = (currentIndex + 1) % SPEED_MULTIPLIER_RATES.length;
      return SPEED_MULTIPLIER_RATES[nextIndex];
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
      { coord, resource, tier: "small" as const, stockpile: 0, totalInvested: cost, upgrade: null, buildCost: cost, damaged: false },
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
    const storageLevels = { ...game.storageLevels, [resource]: currentLevel + 1 };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(STORAGE_LEVELS_DB_KEY, storageLevels)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game
        ? { ...prev, game: { ...prev.game, resources, storageLevels } }
        : prev,
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

    const cost = scaledCostMap(tweaks.docks.build_cost_base, game.docks.length + 1);
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
      { coord, stockpile: 0, fishingBoat: false, fishingBoatUpgrade: null, totalInvested: cost, buildCost: cost },
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

    const cost = pathBuildCost(tweaks, game.pathTiles.length + 1);
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
      { coord, tier: "goat_track" as const, totalInvested: cost, upgrade: null, buildCost: cost, damaged: false },
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
    const towers = [...game.towers, { coord, level: 1, totalInvested: cost, upgrade: null, buildCost: cost, damaged: false }];
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
   * HP restoration, an unrelated pre-existing mechanic); this clears the
   * `damaged` flag set by markCapturedStructuresDamaged (engine/hordes.ts)
   * for any of the five structure kinds, at repairCost's 50%-of-original-
   * build-cost price (engine/formulas.ts).
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

    const repair = <T extends { coord: Axial; damaged: boolean; totalInvested: Partial<Record<ResourceType, number>> }>(
      list: T[],
    ): T[] =>
      list.map((t) =>
        axialKey(t.coord) === key ? { ...t, damaged: false, totalInvested: addToInvestment(t.totalInvested, cost) } : t,
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
    const barracksList = [...game.barracksList, { coord, level: 1, totalInvested: cost, upgrade: null, buildCost: cost, damaged: false }];
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
    const { game } = boot;

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

    await Promise.all([set(UNITS_DB_KEY, units), set(SCOUTED_TILES_DB_KEY, scoutedTiles)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, units, scoutedTiles } } : prev,
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
   * Reinforcement HP (DESIGN.md §9/§13) upgrades instantly on purchase, capped
   * by base level (maxReinforcementLevel) — unlike base-level upgrades, tweaks.jsonc
   * defines no duration for this track, see engine/base.ts:reinforcementUpgradeCost.
   * Also fully restores base.currentHp to the new max — an upgrade doubles as
   * a full repair, so damage never has to be dealt with twice.
   */
  async function handleUpgradeReinforcement(): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

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
      reinforcementLevel: targetLevel,
      currentHp: baseReinforcementHp(tweaks, targetLevel),
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
   * missing (engine/base.ts:baseRepairCost), instant on payment like
   * reinforcement upgrades. Blocked while a horde is still adjacent to the
   * base, same reasoning as handleRepairStructure's hordeOccupiedKeys guard:
   * repairing mid-assault would just get chipped straight back down.
   */
  async function handleRepairBase(): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

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
    const base: BaseRecord = { ...game.base, currentHp: maxHp };

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(BASE_DB_KEY, base)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, base } } : prev,
    );
    return { ok: true };
  }

  /**
   * Outpost-scoped version of handleUpgradeReinforcement — instant on
   * purchase, capped by the player's base level (maxOutpostReinforcementLevel,
   * engine/outposts.ts), same as the main base's track. Paid from the shared
   * main resource pool, same as every other action — an outpost's connected
   * tiles feed that same pool (engine/tick.ts:accrueResources), so there's
   * no separate stockpile to draw from.
   */
  async function handleUpgradeOutpostReinforcement(outpostId: string): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const outpost = game.outposts.find((o) => o.id === outpostId);
    if (!outpost) return { ok: false, reason: "Outpost not found" };

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
        ? { ...o, reinforcementLevel: targetLevel, currentHp: outpostReinforcementHp(tweaks, targetLevel) }
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
   * HP is missing (engine/outposts.ts:outpostRepairCost), paid from the
   * shared main resource pool (see handleUpgradeOutpostReinforcement),
   * blocked while a horde is still adjacent, same reasoning as the base.
   */
  async function handleRepairOutpost(outpostId: string): Promise<BuildResult> {
    if (boot.status !== "ready" || !boot.game) return { ok: false, reason: "Not ready" };
    const { tweaks, game } = boot;

    const outpost = game.outposts.find((o) => o.id === outpostId);
    if (!outpost) return { ok: false, reason: "Outpost not found" };

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
    const outposts: OutpostsRecord = game.outposts.map((o) => (o.id === outpostId ? { ...o, currentHp: maxHp } : o));

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

    const route = findBestExpeditionRoute(
      tweaks,
      game.world.seed,
      game.barracksList,
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
      militiaCommitted <= availableMilitia(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls) &&
      Number.isInteger(junkyardKnightCommitted) &&
      junkyardKnightCommitted >= 0 &&
      junkyardKnightCommitted <= availableJunkyardKnights(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls) &&
      Number.isInteger(crossBowSniperCommitted) &&
      crossBowSniperCommitted >= 0 &&
      crossBowSniperCommitted <= availableCrossBowSnipers(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls);
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
      arriveAt: departedAt + expeditionTravelDurationMs(tweaks, route.cost),
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
      militiaCommitted <= availableMilitia(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls) &&
      Number.isInteger(junkyardKnightCommitted) &&
      junkyardKnightCommitted >= 0 &&
      junkyardKnightCommitted <= availableJunkyardKnights(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls) &&
      Number.isInteger(crossBowSniperCommitted) &&
      crossBowSniperCommitted >= 0 &&
      crossBowSniperCommitted <= availableCrossBowSnipers(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls);
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
      arriveAt: departedAt + expeditionTravelDurationMs(tweaks, route.cost),
    };
    const denAssaults: DenAssaultsRecord = [...game.denAssaults, assault];

    await Promise.all([set(RESOURCES_DB_KEY, resources), set(DEN_ASSAULTS_DB_KEY, denAssaults)]);
    setBoot((prev) =>
      prev.status === "ready" && prev.game ? { ...prev, game: { ...prev.game, resources, denAssaults } } : prev,
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

    if (!Number.isInteger(count) || count <= 0 || count > availableMilitia(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls)) {
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

    const hordeOccupiedKeys = new Set(game.hordes.map((h) => axialKey(h.path[h.pathIndex])));
    if (hordeOccupiedKeys.has(axialKey(coord))) return { ok: false, reason: "A horde is still on this tile" };

    // Same reasoning as handleGarrisonMilitia's hostileDenHere guard.
    const hostileDenHere = game.dens.some((d) => axialKey(d.coord) === axialKey(coord) && !d.siege);
    if (hostileDenHere) return { ok: false, reason: "A hostile den occupies this tile — assault it first" };

    if (
      !Number.isInteger(count) ||
      count <= 0 ||
      count > availableJunkyardKnights(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls)
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

    const hordeOccupiedKeys = new Set(game.hordes.map((h) => axialKey(h.path[h.pathIndex])));
    if (hordeOccupiedKeys.has(axialKey(coord))) return { ok: false, reason: "A horde is still on this tile" };

    // Same reasoning as handleGarrisonMilitia's hostileDenHere guard.
    const hostileDenHere = game.dens.some((d) => axialKey(d.coord) === axialKey(coord) && !d.siege);
    if (hostileDenHere) return { ok: false, reason: "A hostile den occupies this tile — assault it first" };

    if (
      !Number.isInteger(count) ||
      count <= 0 ||
      count > availableCrossBowSnipers(game.units, game.garrisons, game.expeditions, game.denAssaults, game.garrisonRecalls)
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
      arriveAt: departedAt + recallDurationMs(tweaks, route.cost),
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
      noise={boot.game.noise}
      dens={boot.game.dens}
      denAssaults={boot.game.denAssaults}
      outposts={boot.game.outposts}
      garrisonRecalls={boot.game.garrisonRecalls}
      hordes={boot.game.hordes}
      expeditions={boot.game.expeditions}
      docks={boot.game.docks}
      scoutSkiffs={boot.game.scoutSkiffs}
      wanderingScouts={boot.game.wanderingScouts}
      now={boot.game.clock.virtualNow}
      speedMultiplier={speedMultiplier}
      onCycleFastForward={cycleFastForward}
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
