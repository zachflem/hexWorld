import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { axialDistance, axialEquals, axialKey, type Axial } from "../engine/hexCoords";
import { isBuildableLand, isTransitionTile, terrainAt } from "../engine/terrain";
import { dockBuildCost, dockBuildDurationMs, dockYieldPerSecond } from "../engine/docks";
import { repairCost, scaledCostMap, structureRepairDurationMs } from "../engine/formulas";
import { extractionTileBuildDurationMs, nextTier, tierUpgradeCost, tierUpgradeDurationMs } from "../engine/tiers";
import { storageCapacity, storageUpgradeCost, storageUpgradeDurationMs } from "../engine/storage";
import {
  findResourceTileConnection,
  nextPathTier,
  pathBuildCost,
  pathBuildDurationMs,
  pathUpgradeCost,
  pathUpgradeDurationMs,
} from "../engine/paths";
import {
  nextTowerLevel,
  towerBuildCost,
  towerBuildDurationMs,
  towerDamage,
  towerRange,
  towerUpgradeCost,
  towerUpgradeDurationMs,
} from "../engine/towers";
import {
  maxWallDurability,
  nextWallTier,
  wallBuildCost,
  wallBuildDurationMs,
  wallRepairCost,
  wallRepairDurationMs,
  wallUpgradeCost,
  wallUpgradeDurationMs,
} from "../engine/walls";
import {
  barracksBuildCost,
  barracksBuildDurationMs,
  barracksTrainingCapacity,
  barracksUpgradeCost,
  barracksUpgradeDurationMs,
  crossBowSniperCapacity as crossBowSniperCapacityFor,
  junkyardKnightCapacity as junkyardKnightCapacityFor,
  militiaCapacity as militiaCapacityFor,
  nextBarracksLevel,
  scoutCapacity as scoutCapacityFor,
} from "../engine/barracks";
import {
  crossBowSniperTrainCost,
  crossBowSniperTrainDurationMs,
  junkyardKnightTrainCost,
  junkyardKnightTrainDurationMs,
  militiaTrainCost,
  militiaTrainDurationMs,
  scoutTrainCost,
  scoutTrainDurationMs,
} from "../engine/units";
import {
  baseReinforcementHp,
  baseReinforcementRepairDurationMs,
  baseReinforcementUpgradeDurationMs,
  baseRelocationCost,
  baseRelocationDurationMs,
  baseRepairCost,
  baseUpgradeCost,
  baseUpgradeDurationMs,
  canRelocateBase,
  maxReinforcementLevel,
  reinforcementUpgradeCost,
} from "../engine/base";
import { remainingMs } from "../engine/timers";
import {
  extractionFloorContribution,
  noiseCap,
  pathFloorContribution,
  towerFloorContribution,
  wallFloorContribution,
} from "../engine/noiseMeter";
import { computeResourceRates } from "../engine/resourceRates";
import { isTileScoutable } from "../engine/territory";
import {
  expeditionProvisionsCost,
  expeditionTravelDurationMs,
  findBestExpeditionRoute,
} from "../engine/expeditions";
import { troopSpeedMultiplier } from "../engine/research";
import type { ResearchId, ResearchRecord } from "../data/research";
import { denDefense, holdDefenseAt, lastStandWaveSize } from "../engine/dens";
import {
  maxOutpostReinforcementLevel,
  outpostReinforcementHp,
  outpostReinforcementRepairDurationMs,
  outpostReinforcementUpgradeCost,
  outpostReinforcementUpgradeDurationMs,
  outpostRepairCost,
} from "../engine/outposts";
import { availableCrossBowSnipers, availableJunkyardKnights, availableMilitia, garrisonAt } from "../engine/garrisons";
import type { Player } from "../data/player";
import type { ResourceAmounts, ResourceType } from "../data/resources";
import type { TerritoryRecord } from "../data/territory";
import type { BaseRecord } from "../data/base";
import type { ExtractionTier, ExtractionTile } from "../data/extractionTiles";
import type { PathTier, PathTile } from "../data/pathTiles";
import type { Tower } from "../data/towers";
import type { Wall } from "../data/walls";
import type { Barracks } from "../data/barracks";
import type { UnitsRecord } from "../data/units";
import type { GarrisonsRecord } from "../data/garrisons";
import type { ScoutedTiles } from "../data/scoutedTiles";
import type { StorageLevels } from "../data/storageLevels";
import type { StorageUpgradesRecord } from "../data/storageUpgrades";
import type { NoiseRecord } from "../data/noise";
import type { DenRecord, DensRecord } from "../data/dens";
import type { DenAssaultsRecord } from "../data/denAssaults";
import type { TombstoneRecord, TombstonesRecord } from "../data/tombstones";
import type { LabRecord } from "../data/lab";
import type { LabAssaultsRecord } from "../data/labAssaults";
import type { GarrisonRecallsRecord } from "../data/garrisonRecalls";
import type { OutpostRecord, OutpostsRecord } from "../data/outposts";
import type { HordesRecord } from "../data/hordes";
import type { ExpeditionsRecord } from "../data/expeditions";
import type { DockRecord, DocksRecord } from "../data/docks";
import type { ScoutSkiffsRecord } from "../data/scoutSkiffs";
import type { WanderingScoutsRecord } from "../data/wanderingScouts";
import type { Tweaks } from "../data/tweaksSchema";
import type { WorldRecord } from "../data/world";
import type { BuildResult } from "../App";
import { HexCanvas, type HexCanvasHandle } from "../render/HexCanvas";
import { NewGameDialog } from "./NewGameDialog";
import {
  TilePopup,
  type BarracksUpgradeOption,
  type BaseUpgradeOption,
  type BuildOption,
  type DenAssaultOption,
  type DenSiegeStatus,
  type ExpeditionOption,
  type LabAssaultInProgress,
  type LabAssaultOption,
  type PathBuildOption,
  type PathUpgradeOption,
  type RelocationOption,
  type RepairOption,
  type SimpleCostOption,
  type SkiffBuildOption,
  type SimpleTrainOption,
  type StorageUpgradeOption,
  type TierUpgradeOption,
  type TowerUpgradeOption,
  type TrainOption,
  type TrainQueueStatus,
  type UpgradeInProgress,
  type ReinforcementActionStatus,
  type ReinforcementUpgradeOption,
  type WallActionStatus,
  type WallRepairOption,
  type WallUpgradeOption,
  type WanderingScoutOption,
} from "./TilePopup";
import { ResearchPanel } from "./ResearchPanel";
import { NotificationTray } from "./hud/NotificationTray";
import { ToastStack, type ToastRecord } from "./hud/Toast";
import { StatRow } from "./primitives/StatRow";
import { GlobalHexCluster } from "./menu/GlobalHexCluster";
import { GarrisonsPanel } from "./panels/GarrisonsPanel";
import { ScoutingPanel } from "./panels/ScoutingPanel";
import { MilitaryPanel } from "./panels/MilitaryPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import { BarChart3, Binoculars, Flag, Hammer, Settings, Swords, Volume2 } from "lucide-react";

const RESOURCE_ORDER: ResourceType[] = ["food", "wood", "stone", "steel", "power"];

/** icon + value(+delta) chip — the HUD bar's atom. No progress bar (StatRow is for capped values); resources/scouts/base-level/build-slots are either uncapped or already show their own denominator inline. */
function StatChip({
  icon,
  value,
  delta,
  title,
}: {
  icon?: ReactNode;
  value: ReactNode;
  /** Signed rate, shown as "+84"/"-12" in green/red — omitted entirely when 0 (nothing to report). */
  delta?: number;
  title?: string;
}) {
  return (
    <span
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: "0.1rem", fontSize: "0.9rem" }}
      title={title}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
        {icon}
        <span>{value}</span>
      </span>
      {delta !== undefined && Math.round(delta) !== 0 && (
        <span style={{ alignSelf: "flex-end", fontSize: "0.7rem", lineHeight: 1, color: delta > 0 ? "#81c784" : "#ef5350" }}>
          {delta > 0 ? "+" : ""}
          {Math.round(delta)}
        </span>
      )}
    </span>
  );
}

export function GameScreen({
  tweaks,
  player,
  world,
  territory,
  base,
  resources,
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
  denAssaults,
  outposts,
  garrisonRecalls,
  lab,
  labAssaults,
  hordes,
  expeditions,
  tombstones,
  docks,
  scoutSkiffs,
  wanderingScouts,
  research,
  toasts,
  now,
  speedMultiplier,
  onCycleFastForward,
  onDismissToast,
  onStartResearch,
  onBuildExtractionTile,
  onUpgradeExtractionTile,
  onUpgradeStorage,
  onCollectTile,
  onBuildPath,
  onUpgradePath,
  onBuildTower,
  onUpgradeTower,
  onBuildWall,
  onUpgradeWall,
  onRepairWall,
  onRepairStructure,
  onDemolish,
  onBuildBarracks,
  onUpgradeBarracks,
  onTrainScouts,
  onTrainMilitia,
  onTrainJunkyardKnight,
  onTrainCrossBowSniper,
  onRushTrainScouts,
  onRushTrainMilitia,
  onScoutTile,
  onUpgradeBase,
  onUpgradeReinforcement,
  onRepairBase,
  onUpgradeOutpostReinforcement,
  onRepairOutpost,
  onRelocateBase,
  onDispatchExpedition,
  onAssaultDen,
  onSecureLab,
  onGarrisonMilitia,
  onGarrisonJunkyardKnight,
  onGarrisonCrossBowSniper,
  onRecallMilitia,
  onBuildDock,
  onBuildFishingBoat,
  onBuildScoutSkiff,
  onCollectDock,
  onBuildWanderingScout,
  onReplayCurrent,
  onStartNewSeed,
  onNewPlayer,
}: {
  tweaks: Tweaks;
  player: Player;
  world: WorldRecord;
  territory: TerritoryRecord;
  base: BaseRecord;
  resources: ResourceAmounts;
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
  denAssaults: DenAssaultsRecord;
  outposts: OutpostsRecord;
  garrisonRecalls: GarrisonRecallsRecord;
  lab: LabRecord;
  labAssaults: LabAssaultsRecord;
  hordes: HordesRecord;
  expeditions: ExpeditionsRecord;
  tombstones: TombstonesRecord;
  docks: DocksRecord;
  scoutSkiffs: ScoutSkiffsRecord;
  wanderingScouts: WanderingScoutsRecord;
  research: ResearchRecord;
  toasts: ToastRecord[];
  /** The virtual clock (data/clock.ts:ClockRecord.virtualNow) every build/upgrade/training timer here is checked against, instead of Date.now() — advances at speedMultiplier-scaled rate, see App.tsx. */
  now: number;
  /** Playtesting convenience — cycles through rates that scale the tick loop's resource/noise/horde simulation AND every build/upgrade/training timer (via `now` above), see App.tsx. */
  speedMultiplier: number;
  onCycleFastForward: () => void;
  onDismissToast: (id: string) => void;
  onStartResearch: (id: ResearchId) => Promise<BuildResult>;
  onBuildExtractionTile: (coord: Axial, resource: ResourceType) => Promise<BuildResult>;
  onUpgradeExtractionTile: (coord: Axial) => Promise<BuildResult>;
  onUpgradeStorage: (resource: ResourceType) => Promise<BuildResult>;
  onCollectTile: (coord: Axial) => Promise<BuildResult>;
  onBuildPath: (coord: Axial) => Promise<BuildResult>;
  onUpgradePath: (coord: Axial) => Promise<BuildResult>;
  onBuildTower: (coord: Axial) => Promise<BuildResult>;
  onUpgradeTower: (coord: Axial) => Promise<BuildResult>;
  onBuildWall: (coord: Axial) => Promise<BuildResult>;
  onUpgradeWall: (coord: Axial) => Promise<BuildResult>;
  onRepairWall: (coord: Axial) => Promise<BuildResult>;
  onRepairStructure: (coord: Axial) => Promise<BuildResult>;
  onDemolish: (coord: Axial) => Promise<BuildResult>;
  onBuildBarracks: (coord: Axial) => Promise<BuildResult>;
  onUpgradeBarracks: (coord: Axial) => Promise<BuildResult>;
  onTrainScouts: (quantity: number) => Promise<BuildResult>;
  onTrainMilitia: (quantity: number) => Promise<BuildResult>;
  onTrainJunkyardKnight: (quantity: number) => Promise<BuildResult>;
  onTrainCrossBowSniper: (quantity: number) => Promise<BuildResult>;
  onRushTrainScouts: (quantity: number) => Promise<BuildResult>;
  onRushTrainMilitia: (quantity: number) => Promise<BuildResult>;
  onScoutTile: (coord: Axial) => Promise<BuildResult>;
  onUpgradeBase: () => Promise<BuildResult>;
  onUpgradeReinforcement: () => Promise<BuildResult>;
  onRepairBase: () => Promise<BuildResult>;
  onUpgradeOutpostReinforcement: (outpostId: string) => Promise<BuildResult>;
  onRepairOutpost: (outpostId: string) => Promise<BuildResult>;
  onRelocateBase: (destination: Axial) => Promise<BuildResult>;
  onDispatchExpedition: (
    target: Axial,
    militiaCommitted: number,
    junkyardKnightCommitted: number,
    crossBowSniperCommitted: number,
  ) => Promise<BuildResult>;
  onAssaultDen: (
    denId: string,
    militiaCommitted: number,
    junkyardKnightCommitted: number,
    crossBowSniperCommitted: number,
  ) => Promise<BuildResult>;
  onSecureLab: (
    militiaCommitted: number,
    junkyardKnightCommitted: number,
    crossBowSniperCommitted: number,
  ) => Promise<BuildResult>;
  onGarrisonMilitia: (coord: Axial, count: number) => Promise<BuildResult>;
  onGarrisonJunkyardKnight: (coord: Axial, count: number) => Promise<BuildResult>;
  onGarrisonCrossBowSniper: (coord: Axial, count: number) => Promise<BuildResult>;
  onRecallMilitia: (coord: Axial) => Promise<BuildResult>;
  onBuildDock: (coord: Axial) => Promise<BuildResult>;
  onBuildFishingBoat: (coord: Axial) => Promise<BuildResult>;
  onBuildScoutSkiff: (coord: Axial) => Promise<BuildResult>;
  onCollectDock: (coord: Axial) => Promise<BuildResult>;
  onBuildWanderingScout: (coord: Axial) => Promise<BuildResult>;
  /** New Game dialog (App.tsx) — same player, same map, progress reset. */
  onReplayCurrent: () => void;
  /** New Game dialog (App.tsx) — same player, a chosen (or freshly-generated) map. */
  onStartNewSeed: (seed: number) => void;
  /** New Game dialog (App.tsx) — drops back to onboarding. */
  onNewPlayer: () => void;
}) {
  const hexCanvasRef = useRef<HexCanvasHandle>(null);
  const [selected, setSelected] = useState<Axial | null>(null);
  const [newGameDialogOpen, setNewGameDialogOpen] = useState(false);
  /** Which of the global hex cluster's five panel slots (flag/binoculars/gear/chart — hammer is a toggle, not a panel) is open, if any. Only one at a time. */
  const [openPanel, setOpenPanel] = useState<"garrisons" | "scouting" | "military" | "settings" | "research" | null>(null);
  /** Hammer slot — highlights owned/empty/buildable tiles with an affordable build option, see buildModeEligibleKeysFor below. */
  const [buildModeActive, setBuildModeActive] = useState(false);
  /** Wraps the hex cluster + whichever panel is open — a pointerdown outside both closes the panel (GlobalHexCluster already closes its own bloom the same way, independently); a pointerdown on the cluster itself (e.g. a different slot, or the same slot to toggle closed) is excluded here so it doesn't fight with the slot's own onClick. */
  const clusterAndPanelsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!openPanel) return;
    function handlePointerDown(event: PointerEvent) {
      if (clusterAndPanelsRef.current && !clusterAndPanelsRef.current.contains(event.target as Node)) {
        setOpenPanel(null);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [openPanel]);
  const [actionError, setActionError] = useState<string | null>(null);
  const [militiaToSend, setMilitiaToSend] = useState(1);
  const [junkyardKnightToSend, setJunkyardKnightToSend] = useState(0);
  const [crossBowSniperToSend, setCrossBowSniperToSend] = useState(0);
  const [scoutsToTrain, setScoutsToTrain] = useState(1);
  const [militiaToTrain, setMilitiaToTrain] = useState(1);
  const [junkyardKnightToTrain, setJunkyardKnightToTrain] = useState(1);
  const [crossBowSniperToTrain, setCrossBowSniperToTrain] = useState(1);
  const [militiaToGarrison, setMilitiaToGarrison] = useState(1);
  const [junkyardKnightToGarrison, setJunkyardKnightToGarrison] = useState(1);
  const [crossBowSniperToGarrison, setCrossBowSniperToGarrison] = useState(1);

  const ownedKeys = useMemo(() => new Set(territory.owned.map(axialKey)), [territory.owned]);
  const isOwned = (coord: Axial) => ownedKeys.has(axialKey(coord));

  const scoutedKeys = useMemo(() => new Set(scoutedTiles.map(axialKey)), [scoutedTiles]);
  const isScouted = (coord: Axial) => scoutedKeys.has(axialKey(coord));

  const tileAt = (coord: Axial): ExtractionTile | null =>
    extractionTiles.find((tile) => axialKey(tile.coord) === axialKey(coord)) ?? null;

  const pathAt = (coord: Axial): PathTile | null =>
    pathTiles.find((tile) => axialKey(tile.coord) === axialKey(coord)) ?? null;

  const towerAt = (coord: Axial): Tower | null =>
    towers.find((t) => axialKey(t.coord) === axialKey(coord)) ?? null;

  const wallAt = (coord: Axial): Wall | null => walls.find((w) => axialKey(w.coord) === axialKey(coord)) ?? null;

  const barracksAt = (coord: Axial): Barracks | null =>
    barracksList.find((b) => axialKey(b.coord) === axialKey(coord)) ?? null;

  const dockAt = (coord: Axial): DockRecord | null =>
    docks.find((d) => axialKey(d.coord) === axialKey(coord)) ?? null;

  const outpostAt = (coord: Axial): OutpostRecord | null =>
    outposts.find((o) => axialKey(o.coord) === axialKey(coord)) ?? null;

  function affordable(cost: Partial<Record<ResourceType, number>>): boolean {
    return Object.entries(cost).every(([res, amount]) => resources[res as ResourceType] >= (amount ?? 0));
  }

  /** How many units of a given per-unit cost the current resources can actually pay for — used to clamp "Max" buttons to what's affordable, not just what capacity allows. */
  function maxAffordableQuantity(perUnitCost: Partial<Record<ResourceType, number>>): number {
    let max = Infinity;
    for (const [res, amount] of Object.entries(perUnitCost)) {
      if (!amount) continue;
      max = Math.min(max, Math.floor(resources[res as ResourceType] / amount));
    }
    return Number.isFinite(max) ? Math.max(0, max) : 0;
  }

  function buildOptionsFor(): BuildOption[] {
    return RESOURCE_ORDER.map((resource) => {
      const existingCount = extractionTiles.filter((tile) => tile.resource === resource).length;
      const cost = scaledCostMap(tweaks.extraction_tiles[resource].build_cost_base, existingCount + 1);
      return {
        resource,
        cost,
        affordable: affordable(cost),
        durationMinutes: extractionTileBuildDurationMs(tweaks) / 60_000,
      };
    });
  }

  function tierUpgradeFor(tile: ExtractionTile): TierUpgradeOption | null {
    if (tile.damaged || tile.upgrade) return null;
    const targetTier = nextTier(tile.tier);
    if (!targetTier) return null;
    const cost = tierUpgradeCost(tweaks, tile.resource, targetTier);
    return {
      targetTier,
      cost,
      affordable: affordable(cost),
      durationMinutes: tierUpgradeDurationMs(tweaks, targetTier) / 60_000,
    };
  }

  function tierUpgradeInProgressFor(tile: ExtractionTile): UpgradeInProgress<ExtractionTier> | null {
    if (!tile.upgrade) return null;
    const durationMs = tierUpgradeDurationMs(tweaks, tile.upgrade.targetTier);
    return { target: tile.upgrade.targetTier, remainingMs: remainingMs(tile.upgrade.startedAt, durationMs, now) };
  }

  function storageUpgradesFor(): StorageUpgradeOption[] {
    return RESOURCE_ORDER.map((resource) => {
      const level = storageLevels[resource];
      const cost = storageUpgradeCost(tweaks, resource, level);
      const pending = storageUpgrades[resource];
      const inProgress = pending
        ? {
            targetLevel: pending.targetLevel,
            remainingMs: remainingMs(pending.startedAt, storageUpgradeDurationMs(tweaks, pending.targetLevel), now),
          }
        : null;
      return { resource, level, capacity: storageCapacity(tweaks, level), cost, affordable: affordable(cost), inProgress };
    });
  }

  function pathBuildOptionFor(): PathBuildOption {
    const cost = pathBuildCost(tweaks);
    return { cost, affordable: affordable(cost), durationMinutes: pathBuildDurationMs(tweaks) / 60_000 };
  }

  function pathUpgradeOptionFor(tile: PathTile): PathUpgradeOption | null {
    if (tile.damaged || tile.upgrade) return null;
    const targetTier = nextPathTier(tile.tier);
    if (!targetTier) return null;
    const cost = pathUpgradeCost(tweaks, targetTier);
    return {
      targetTier,
      cost,
      affordable: affordable(cost),
      durationMinutes: pathUpgradeDurationMs(tweaks, targetTier) / 60_000,
    };
  }

  function pathUpgradeInProgressFor(tile: PathTile): UpgradeInProgress<PathTier> | null {
    if (!tile.upgrade) return null;
    const durationMs = pathUpgradeDurationMs(tweaks, tile.upgrade.targetTier);
    return { target: tile.upgrade.targetTier, remainingMs: remainingMs(tile.upgrade.startedAt, durationMs, now) };
  }

  function towerBuildOptionFor(): RepairOption {
    const cost = towerBuildCost(tweaks, towers.length + 1);
    return { cost, affordable: affordable(cost), durationMinutes: towerBuildDurationMs(tweaks) / 60_000 };
  }

  function towerUpgradeOptionFor(t: Tower): TowerUpgradeOption | null {
    if (t.damaged || t.upgrade) return null;
    const targetLevel = nextTowerLevel(t.level);
    if (!targetLevel) return null;
    const cost = towerUpgradeCost(tweaks, targetLevel);
    return {
      targetLevel,
      cost,
      affordable: affordable(cost),
      durationMinutes: towerUpgradeDurationMs(tweaks, targetLevel) / 60_000,
    };
  }

  function towerUpgradeInProgressFor(t: Tower): UpgradeInProgress<number> | null {
    if (!t.upgrade) return null;
    const durationMs = towerUpgradeDurationMs(tweaks, t.upgrade.targetLevel);
    return { target: t.upgrade.targetLevel, remainingMs: remainingMs(t.upgrade.startedAt, durationMs, now) };
  }

  function wallBuildOptionFor(): RepairOption {
    const cost = wallBuildCost(tweaks, walls.length + 1);
    return { cost, affordable: affordable(cost), durationMinutes: wallBuildDurationMs(tweaks) / 60_000 };
  }

  function wallUpgradeOptionFor(w: Wall): WallUpgradeOption | null {
    if (w.damaged || w.action) return null;
    const targetTier = nextWallTier(w.tier);
    if (!targetTier) return null;
    const cost = wallUpgradeCost(tweaks, targetTier);
    return {
      targetTier,
      cost,
      affordable: affordable(cost),
      durationMinutes: wallUpgradeDurationMs(tweaks, targetTier) / 60_000,
    };
  }

  function wallRepairOptionFor(w: Wall): WallRepairOption | null {
    if (w.damaged || w.action) return null;
    const maxHp = maxWallDurability(tweaks, w.tier);
    if (w.durability >= maxHp) return null;
    const cost = wallRepairCost(w, maxHp);
    return {
      cost,
      affordable: affordable(cost),
      durationMinutes: wallRepairDurationMs(tweaks, w, maxHp) / 60_000,
    };
  }

  function wallActionStatusFor(w: Wall): WallActionStatus | null {
    if (!w.action) return null;
    if (w.action.kind === "upgrade") {
      const durationMs = wallUpgradeDurationMs(tweaks, w.action.targetTier);
      return { kind: "upgrade", targetTier: w.action.targetTier, remainingMs: remainingMs(w.action.startedAt, durationMs, now) };
    }
    const maxHp = maxWallDurability(tweaks, w.tier);
    const durationMs = wallRepairDurationMs(tweaks, w, maxHp);
    return { kind: "repair", remainingMs: remainingMs(w.action.startedAt, durationMs, now) };
  }

  function barracksBuildOptionFor(): RepairOption {
    const cost = barracksBuildCost(tweaks, barracksList.length + 1);
    return { cost, affordable: affordable(cost), durationMinutes: barracksBuildDurationMs(tweaks) / 60_000 };
  }

  function dockBuildOptionFor(): SimpleCostOption {
    const cost = dockBuildCost(tweaks, docks.length + 1);
    return { cost, affordable: affordable(cost) };
  }

  /** Null once already built or under construction — a dock gets at most one fishing boat. */
  function fishingBoatOptionFor(d: DockRecord): SimpleCostOption | null {
    if (d.fishingBoat || d.fishingBoatUpgrade) return null;
    const cost = tweaks.docks.fishing_boat.cost;
    return { cost, affordable: affordable(cost) };
  }

  function fishingBoatInProgressFor(d: DockRecord): { remainingMs: number } | null {
    if (!d.fishingBoatUpgrade) return null;
    const durationMs = tweaks.docks.fishing_boat.build_time_minutes * 60_000;
    return { remainingMs: remainingMs(d.fishingBoatUpgrade.startedAt, durationMs, now) };
  }

  /** Null once this dock already has as many skiffs (built or under construction) as tweaks.docks.scout_skiff.max_per_dock allows. */
  function scoutSkiffOptionFor(d: DockRecord): SkiffBuildOption | null {
    const existing = scoutSkiffs.filter((s) => axialKey(s.homeDockCoord) === axialKey(d.coord)).length;
    if (existing >= tweaks.docks.scout_skiff.max_per_dock) return null;
    const cost = tweaks.docks.scout_skiff.cost;
    return { cost, affordable: affordable(cost), durationMinutes: tweaks.docks.scout_skiff.build_time_minutes };
  }

  /** Non-null while this dock's newest scout skiff is still under construction. */
  function scoutSkiffInProgressFor(d: DockRecord): { remainingMs: number } | null {
    const skiff = scoutSkiffs.find((s) => axialKey(s.homeDockCoord) === axialKey(d.coord) && s.buildStartedAt !== null);
    if (!skiff || skiff.buildStartedAt === null) return null;
    const durationMs = tweaks.docks.scout_skiff.build_time_minutes * 60_000;
    return { remainingMs: remainingMs(skiff.buildStartedAt, durationMs, now) };
  }

  /** Null once this barracks already has as many wandering scouts (built or under construction) as allowed. */
  function wanderingScoutOptionFor(b: Barracks): WanderingScoutOption | null {
    const existing = wanderingScouts.filter((s) => axialKey(s.homeBarracksCoord) === axialKey(b.coord)).length;
    if (existing >= tweaks.units.wandering_scout.max_per_barracks) return null;
    const scoutCost = tweaks.units.wandering_scout.scout_cost;
    const cost = tweaks.units.wandering_scout.cost;
    return {
      scoutCost,
      cost,
      affordable: units.scoutStockpile >= scoutCost && affordable(cost),
      durationMinutes: tweaks.units.wandering_scout.build_time_minutes,
    };
  }

  /** Non-null while this barracks's newest wandering scout is still under construction. */
  function wanderingScoutInProgressFor(b: Barracks): { remainingMs: number } | null {
    const scout = wanderingScouts.find(
      (s) => axialKey(s.homeBarracksCoord) === axialKey(b.coord) && s.buildStartedAt !== null,
    );
    if (!scout || scout.buildStartedAt === null) return null;
    const durationMs = tweaks.units.wandering_scout.build_time_minutes * 60_000;
    return { remainingMs: remainingMs(scout.buildStartedAt, durationMs, now) };
  }

  function barracksUpgradeOptionFor(b: Barracks): BarracksUpgradeOption | null {
    if (b.damaged || b.upgrade) return null;
    const targetLevel = nextBarracksLevel(b.level);
    if (!targetLevel) return null;
    const cost = barracksUpgradeCost(tweaks, targetLevel);
    return {
      targetLevel,
      cost,
      affordable: affordable(cost),
      durationMinutes: barracksUpgradeDurationMs(tweaks, targetLevel) / 60_000,
    };
  }

  function barracksUpgradeInProgressFor(b: Barracks): UpgradeInProgress<number> | null {
    if (!b.upgrade) return null;
    const durationMs = barracksUpgradeDurationMs(tweaks, b.upgrade.targetLevel);
    return { target: b.upgrade.targetLevel, remainingMs: remainingMs(b.upgrade.startedAt, durationMs, now) };
  }

  function scoutTrainOptionFor(): TrainOption | null {
    const capacityGap = scoutCapacityFor(tweaks, barracksList) - units.scoutStockpile;
    if (capacityGap <= 0) return null;
    const perUnitCost = scoutTrainCost(tweaks);
    const maxQuantity = Math.min(capacityGap, maxAffordableQuantity(perUnitCost));
    const totalCost: Partial<Record<ResourceType, number>> = {};
    for (const [key, amount] of Object.entries(perUnitCost)) totalCost[key as ResourceType] = amount * scoutsToTrain;
    const rushNoise = tweaks.noise.one_time_action_noise.rush_train_scout * scoutsToTrain;
    return { totalCost, affordable: affordable(totalCost), maxQuantity, rushNoise };
  }

  function militiaTrainOptionFor(): TrainOption | null {
    const capacityGap = militiaCapacityFor(tweaks, barracksList) - units.militiaCount;
    if (capacityGap <= 0) return null;
    const perUnitCost = militiaTrainCost(tweaks);
    const maxQuantity = Math.min(capacityGap, maxAffordableQuantity(perUnitCost));
    const totalCost: Partial<Record<ResourceType, number>> = {};
    for (const [key, amount] of Object.entries(perUnitCost)) totalCost[key as ResourceType] = amount * militiaToTrain;
    const rushNoise = tweaks.noise.one_time_action_noise.rush_train_militia * militiaToTrain;
    return { totalCost, affordable: affordable(totalCost), maxQuantity, rushNoise };
  }

  /**
   * No rush-train variant for this unit (calm queue only) — capacityGap is 0
   * until SOME barracks meets units.junkyard_knight.min_barracks_level
   * (engine/barracks.ts:junkyardKnightCapacity), but that capacity pools
   * across every barracks the player owns. Without the fromBarracksLevel
   * check below, opening a low-level barracks would still show/allow this
   * option as long as a *different*, higher-level barracks elsewhere
   * contributed the capacity — training should only be offered at a
   * barracks that itself meets the tier requirement.
   */
  function junkyardKnightTrainOptionFor(fromBarracksLevel: number): SimpleTrainOption | null {
    if (fromBarracksLevel < tweaks.units.junkyard_knight.min_barracks_level) return null;
    const capacityGap = junkyardKnightCapacityFor(tweaks, barracksList) - units.junkyardKnightCount;
    if (capacityGap <= 0) return null;
    const perUnitCost = junkyardKnightTrainCost(tweaks);
    const maxQuantity = Math.min(capacityGap, maxAffordableQuantity(perUnitCost));
    const totalCost: Partial<Record<ResourceType, number>> = {};
    for (const [key, amount] of Object.entries(perUnitCost)) totalCost[key as ResourceType] = amount * junkyardKnightToTrain;
    return { totalCost, affordable: affordable(totalCost), maxQuantity };
  }

  /**
   * Same per-tile tier gate as junkyardKnightTrainOptionFor, above, at
   * units.cross_bow_sniper.min_barracks_level.
   */
  function crossBowSniperTrainOptionFor(fromBarracksLevel: number): SimpleTrainOption | null {
    if (fromBarracksLevel < tweaks.units.cross_bow_sniper.min_barracks_level) return null;
    const capacityGap = crossBowSniperCapacityFor(tweaks, barracksList) - units.crossBowSniperCount;
    if (capacityGap <= 0) return null;
    const perUnitCost = crossBowSniperTrainCost(tweaks);
    const maxQuantity = Math.min(capacityGap, maxAffordableQuantity(perUnitCost));
    const totalCost: Partial<Record<ResourceType, number>> = {};
    for (const [key, amount] of Object.entries(perUnitCost)) totalCost[key as ResourceType] = amount * crossBowSniperToTrain;
    return { totalCost, affordable: affordable(totalCost), maxQuantity };
  }

  const trainingCapacity = barracksTrainingCapacity(barracksList);

  const scoutQueueStatus: TrainQueueStatus | null = units.scoutQueue
    ? {
        remaining: units.scoutQueue.remaining,
        msUntilNextMs: remainingMs(
          units.scoutQueue.currentUnitStartedAt,
          scoutTrainDurationMs(tweaks, trainingCapacity),
          now,
        ),
      }
    : null;

  const militiaQueueStatus: TrainQueueStatus | null = units.militiaQueue
    ? {
        remaining: units.militiaQueue.remaining,
        msUntilNextMs: remainingMs(
          units.militiaQueue.currentUnitStartedAt,
          militiaTrainDurationMs(tweaks, trainingCapacity),
          now,
        ),
      }
    : null;

  const junkyardKnightQueueStatus: TrainQueueStatus | null = units.junkyardKnightQueue
    ? {
        remaining: units.junkyardKnightQueue.remaining,
        msUntilNextMs: remainingMs(
          units.junkyardKnightQueue.currentUnitStartedAt,
          junkyardKnightTrainDurationMs(tweaks, trainingCapacity),
          now,
        ),
      }
    : null;

  const crossBowSniperQueueStatus: TrainQueueStatus | null = units.crossBowSniperQueue
    ? {
        remaining: units.crossBowSniperQueue.remaining,
        msUntilNextMs: remainingMs(
          units.crossBowSniperQueue.currentUnitStartedAt,
          crossBowSniperTrainDurationMs(tweaks, trainingCapacity),
          now,
        ),
      }
    : null;

  function baseUpgradeOptionFor(): BaseUpgradeOption | null {
    if (base.upgrade) return null;
    const targetLevel = base.level + 1;
    const cost = baseUpgradeCost(tweaks, targetLevel);
    return { targetLevel, cost, affordable: affordable(cost), durationMs: baseUpgradeDurationMs(tweaks, targetLevel) };
  }

  /** Timed like every other upgrade (engine/base.ts:baseReinforcementUpgradeDurationMs). Null while base.reinforcementAction is set — see reinforcementActionStatus below. */
  function reinforcementUpgradeOptionFor(): ReinforcementUpgradeOption | null {
    if (base.reinforcementAction) return null;
    const targetLevel = base.reinforcementLevel + 1;
    if (targetLevel > maxReinforcementLevel(base.level)) return null;
    const cost = reinforcementUpgradeCost(tweaks, targetLevel);
    return {
      targetLevel,
      hp: baseReinforcementHp(tweaks, targetLevel),
      cost,
      affordable: affordable(cost),
      durationMs: baseReinforcementUpgradeDurationMs(tweaks, targetLevel),
    };
  }

  /** Null once base.currentHp is already at max — nothing to repair — or while base.reinforcementAction is set. */
  function baseRepairOptionFor(): RepairOption | null {
    if (base.reinforcementAction) return null;
    const maxHp = baseReinforcementHp(tweaks, base.reinforcementLevel);
    if (base.currentHp >= maxHp) return null;
    const cost = baseRepairCost(tweaks, base.currentHp, maxHp, base.reinforcementLevel);
    const durationMinutes = baseReinforcementRepairDurationMs(tweaks, base.currentHp, maxHp) / 60_000;
    return { cost, affordable: affordable(cost), durationMinutes };
  }

  /** Non-null while a reinforcement upgrade or repair is running on the base — mirrors wallActionStatusFor. */
  function reinforcementActionStatusFor(): ReinforcementActionStatus | null {
    const action = base.reinforcementAction;
    if (!action) return null;
    if (action.kind === "upgrade") {
      const durationMs = baseReinforcementUpgradeDurationMs(tweaks, action.targetLevel);
      return { kind: "upgrade", targetLevel: action.targetLevel, remainingMs: remainingMs(action.startedAt, durationMs, now) };
    }
    const maxHp = baseReinforcementHp(tweaks, base.reinforcementLevel);
    const durationMs = baseReinforcementRepairDurationMs(tweaks, base.currentHp, maxHp);
    return { kind: "repair", remainingMs: remainingMs(action.startedAt, durationMs, now) };
  }

  /**
   * Outpost equivalent of reinforcementUpgradeOptionFor — same cap
   * (maxOutpostReinforcementLevel(base.level)), paid from the shared
   * `resources` pool same as everywhere else on this screen (an outpost's
   * connected tiles feed that same pool, engine/tick.ts:accrueResources).
   */
  function outpostReinforcementUpgradeOptionFor(outpost: OutpostRecord): ReinforcementUpgradeOption | null {
    if (outpost.reinforcementAction) return null;
    const targetLevel = outpost.reinforcementLevel + 1;
    if (targetLevel > maxOutpostReinforcementLevel(base.level)) return null;
    const cost = outpostReinforcementUpgradeCost(tweaks, targetLevel);
    return {
      targetLevel,
      hp: outpostReinforcementHp(tweaks, targetLevel),
      cost,
      affordable: affordable(cost),
      durationMs: outpostReinforcementUpgradeDurationMs(tweaks, targetLevel),
    };
  }

  /** Outpost equivalent of baseRepairOptionFor — null once at max HP or while busy, cost checked against the shared resource pool. */
  function outpostRepairOptionFor(outpost: OutpostRecord): RepairOption | null {
    if (outpost.reinforcementAction) return null;
    const maxHp = outpostReinforcementHp(tweaks, outpost.reinforcementLevel);
    if (outpost.currentHp >= maxHp) return null;
    const cost = outpostRepairCost(tweaks, outpost.currentHp, maxHp, outpost.reinforcementLevel);
    const durationMinutes = outpostReinforcementRepairDurationMs(tweaks, outpost.currentHp, maxHp) / 60_000;
    return { cost, affordable: affordable(cost), durationMinutes };
  }

  /** Outpost equivalent of reinforcementActionStatusFor. */
  function outpostReinforcementActionStatusFor(outpost: OutpostRecord): ReinforcementActionStatus | null {
    const action = outpost.reinforcementAction;
    if (!action) return null;
    if (action.kind === "upgrade") {
      const durationMs = outpostReinforcementUpgradeDurationMs(tweaks, action.targetLevel);
      return { kind: "upgrade", targetLevel: action.targetLevel, remainingMs: remainingMs(action.startedAt, durationMs, now) };
    }
    const maxHp = outpostReinforcementHp(tweaks, outpost.reinforcementLevel);
    const durationMs = outpostReinforcementRepairDurationMs(tweaks, outpost.currentHp, maxHp);
    return { kind: "repair", remainingMs: remainingMs(action.startedAt, durationMs, now) };
  }

  const baseUpgradeInProgress = base.upgrade
    ? {
        targetLevel: base.upgrade.targetLevel,
        remainingMs: Math.max(
          0,
          baseUpgradeDurationMs(tweaks, base.upgrade.targetLevel) - (now - base.upgrade.startedAt),
        ),
      }
    : null;

  const baseRelocationInProgress = base.relocation
    ? {
        destination: base.relocation.destination,
        remainingMs: Math.max(
          0,
          baseRelocationDurationMs(tweaks, axialDistance(territory.base, base.relocation.destination)) -
            (now - base.relocation.startedAt),
        ),
      }
    : null;

  /**
   * Null when there's no known route yet (no barracks, or the destination
   * isn't reachable through owned-or-scouted ground) — same "hide the whole
   * block" convention the old attackOption used. Recomputed on every render
   * since it depends on the currently-typed unit counts (provisions cost
   * scales with party size), same as train/garrison options already do.
   */
  function expeditionRouteOptionFor(coord: Axial): ExpeditionOption | null {
    const route = findBestExpeditionRoute(
      tweaks,
      world.seed,
      barracksList,
      towers,
      outposts,
      territory,
      scoutedTiles,
      tweaks.game.grid_size,
      coord,
    );
    if (!route) return null;
    const partySize = militiaToSend + junkyardKnightToSend + crossBowSniperToSend;
    const provisionsCost: Partial<Record<ResourceType, number>> = {
      food: expeditionProvisionsCost(tweaks, partySize, route.cost),
    };
    return {
      distanceTiles: route.path.length - 1,
      pathCost: route.cost,
      provisionsCost,
      affordable: affordable(provisionsCost),
      etaMs: expeditionTravelDurationMs(tweaks, route.cost, troopSpeedMultiplier(tweaks, research)),
    };
  }

  /**
   * Null when there's no known route to the den yet (no barracks, or the den
   * hasn't been scouted — findBestExpeditionRoute's allowedTiles gate means
   * an unscouted den simply can't be reached) — same "hide the whole block"
   * convention as expeditionRouteOptionFor, which this otherwise mirrors
   * exactly (same militiaToSend/etc inputs — a den assault and an expedition
   * draw from the same committed-unit pool, engine/garrisons.ts).
   */
  function denAssaultOptionFor(den: DenRecord): DenAssaultOption | null {
    const route = findBestExpeditionRoute(
      tweaks,
      world.seed,
      barracksList,
      towers,
      outposts,
      territory,
      scoutedTiles,
      tweaks.game.grid_size,
      den.coord,
    );
    if (!route) return null;
    const partySize = militiaToSend + junkyardKnightToSend + crossBowSniperToSend;
    const provisionsCost: Partial<Record<ResourceType, number>> = {
      food: expeditionProvisionsCost(tweaks, partySize, route.cost),
    };
    return {
      distanceTiles: route.path.length - 1,
      pathCost: route.cost,
      provisionsCost,
      affordable: affordable(provisionsCost),
      etaMs: expeditionTravelDurationMs(tweaks, route.cost, troopSpeedMultiplier(tweaks, research)),
      denDefense: denDefense(tweaks, den.level),
    };
  }

  /** Null while a den isn't under siege — see engine/dens.ts:resolveHoldPeriod for the outcomes this display is tracking toward. */
  function denSiegeStatusFor(den: DenRecord): DenSiegeStatus | null {
    if (!den.siege) return null;
    const holdDurationMs = tweaks.dens.siege.hold_duration_minutes * 60_000;
    const waveIntervalMs = tweaks.dens.siege.wave_interval_minutes * 60_000;
    return {
      holdRemainingMs: remainingMs(den.siege.startedAt, holdDurationMs, now),
      nextWaveInMs: remainingMs(den.siege.lastWaveAt, waveIntervalMs, now),
      nextWaveSize: lastStandWaveSize(tweaks, den.level, den.siege.waveIndex),
      currentDefense: holdDefenseAt(tweaks, den.coord, towers, walls, garrisons),
    };
  }

  /**
   * Null unless a DenAssaultRecord is currently in transit toward this den
   * (dispatched but not yet arrived) — the committed party is already
   * unavailable (engine/garrisons.ts:availableMilitia etc.) the moment it's
   * sent, so without this the den's own tile popup would look completely
   * unchanged and give no sign anything is happening until the assault
   * resolves. Distinct from denSiegeStatus, which only starts once the
   * assault has already arrived and won.
   */
  function denAssaultInProgressFor(den: DenRecord): { etaMs: number } | null {
    const assault = denAssaults.find((a) => a.denId === den.id);
    if (!assault) return null;
    return { etaMs: remainingMs(assault.departedAt, assault.arriveAt - assault.departedAt, now) };
  }

  /**
   * Mirrors denAssaultOptionFor exactly, for the lab's single static
   * guardian instead of a den's level-scaled defense — same "no route until
   * scouted" gate, same militia/knight/sniper-to-send inputs.
   */
  function labAssaultOptionFor(): LabAssaultOption | null {
    const route = findBestExpeditionRoute(
      tweaks,
      world.seed,
      barracksList,
      towers,
      outposts,
      territory,
      scoutedTiles,
      tweaks.game.grid_size,
      lab.coord,
    );
    if (!route) return null;
    const partySize = militiaToSend + junkyardKnightToSend + crossBowSniperToSend;
    const provisionsCost: Partial<Record<ResourceType, number>> = {
      food: expeditionProvisionsCost(tweaks, partySize, route.cost),
    };
    return {
      distanceTiles: route.path.length - 1,
      pathCost: route.cost,
      provisionsCost,
      affordable: affordable(provisionsCost),
      etaMs: expeditionTravelDurationMs(tweaks, route.cost, troopSpeedMultiplier(tweaks, research)),
      guardianDefense: tweaks.lab.guardian_defense,
    };
  }

  /** Mirrors denAssaultInProgressFor — null unless a LabAssaultRecord is currently in transit (there's only ever one at a time, handleSecureLab rejects a second dispatch). */
  function labAssaultInProgress(): LabAssaultInProgress | null {
    const assault = labAssaults[0];
    if (!assault) return null;
    return { etaMs: remainingMs(assault.departedAt, assault.arriveAt - assault.departedAt, now) };
  }

  /** Null unless a garrison recalled from this coord is still marching home — see App.tsx:handleRecallMilitia. */
  function recallInProgressFor(coord: Axial): {
    militia: number;
    junkyardKnight: number;
    crossBowSniper: number;
    etaMs: number;
  } | null {
    const recall = garrisonRecalls.find((r) => axialEquals(r.coord, coord));
    if (!recall) return null;
    return {
      militia: recall.militiaCommitted,
      junkyardKnight: recall.junkyardKnightCommitted,
      crossBowSniper: recall.crossBowSniperCommitted,
      etaMs: remainingMs(recall.departedAt, recall.arriveAt - recall.departedAt, now),
    };
  }

  /**
   * Null once base level or resource cost isn't met, a relocation is already
   * in progress, the coord is the current base, unknown ground, water, or
   * occupied by a structure — same "hide the whole block" convention as
   * expeditionRouteOptionFor. Any owned-or-scouted, empty, non-water tile is
   * a valid destination (not just unowned ground, unlike expeditions) — a
   * relocation doesn't fight through anything, it's a countdown then a
   * teleport, so an already-owned tile with a great defensive position
   * (mountain chokepoint, water-backed approach) is just as valid a target.
   */
  function relocationOptionFor(coord: Axial): RelocationOption | null {
    if (!canRelocateBase(tweaks, base.level) || base.relocation) return null;
    if (axialEquals(coord, territory.base)) return null;
    if (!isOwned(coord) && !isScouted(coord)) return null;
    if (terrainAt(world.seed, coord) === "water") return null;
    if (!selectedEmpty) return null;
    const distanceTiles = axialDistance(territory.base, coord);
    const cost = baseRelocationCost(tweaks, distanceTiles);
    return {
      distanceTiles,
      cost,
      affordable: affordable(cost),
      durationMs: baseRelocationDurationMs(tweaks, distanceTiles),
    };
  }

  async function handleRelocateBase() {
    if (!selected) return;
    const result = await onRelocateBase(selected);
    setActionError(result.ok ? null : result.reason);
  }

  function selectTile(coord: Axial) {
    setActionError(null);
    setSelected(coord);
    setMilitiaToSend(1);
    setScoutsToTrain(1);
    setMilitiaToTrain(1);
    setMilitiaToGarrison(1);
  }

  async function handleBuild(resource: ResourceType) {
    if (!selected) return;
    const result = await onBuildExtractionTile(selected, resource);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleUpgradeTier() {
    if (!selected) return;
    const result = await onUpgradeExtractionTile(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleUpgradeStorage(resource: ResourceType) {
    const result = await onUpgradeStorage(resource);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleCollect() {
    if (!selected) return;
    const result = await onCollectTile(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleBuildPath() {
    if (!selected) return;
    const result = await onBuildPath(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleUpgradePath() {
    if (!selected) return;
    const result = await onUpgradePath(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleBuildTower() {
    if (!selected) return;
    const result = await onBuildTower(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleUpgradeTower() {
    if (!selected) return;
    const result = await onUpgradeTower(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleBuildWall() {
    if (!selected) return;
    const result = await onBuildWall(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleUpgradeWall() {
    if (!selected) return;
    const result = await onUpgradeWall(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleRepairWall() {
    if (!selected) return;
    const result = await onRepairWall(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleDemolish() {
    if (!selected) return;
    if (!window.confirm("Demolish this structure? You'll only recover a fraction of what you spent on it.")) return;
    const result = await onDemolish(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleBuildBarracks() {
    if (!selected) return;
    const result = await onBuildBarracks(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleUpgradeBarracks() {
    if (!selected) return;
    const result = await onUpgradeBarracks(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleBuildDock() {
    if (!selected) return;
    const result = await onBuildDock(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleBuildFishingBoat() {
    if (!selected) return;
    const result = await onBuildFishingBoat(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleBuildScoutSkiff() {
    if (!selected) return;
    const result = await onBuildScoutSkiff(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleBuildWanderingScout() {
    if (!selected) return;
    const result = await onBuildWanderingScout(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleCollectDock() {
    if (!selected) return;
    const result = await onCollectDock(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleTrainScouts() {
    const result = await onTrainScouts(scoutsToTrain);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleTrainMilitia() {
    const result = await onTrainMilitia(militiaToTrain);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleTrainJunkyardKnight() {
    const result = await onTrainJunkyardKnight(junkyardKnightToTrain);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleTrainCrossBowSniper() {
    const result = await onTrainCrossBowSniper(crossBowSniperToTrain);
    setActionError(result.ok ? null : result.reason);
  }

  // Skips the "fill the field, then press Train" two-step — Max trains the
  // max quantity immediately.
  async function handleMaxScouts() {
    const option = scoutTrainOptionFor();
    if (!option) return;
    if (option.maxQuantity <= 0) {
      setActionError("Not enough resources to train any scouts");
      return;
    }
    setScoutsToTrain(option.maxQuantity);
    const result = await onTrainScouts(option.maxQuantity);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleMaxMilitia() {
    const option = militiaTrainOptionFor();
    if (!option) return;
    if (option.maxQuantity <= 0) {
      setActionError("Not enough resources to train any militia");
      return;
    }
    setMilitiaToTrain(option.maxQuantity);
    const result = await onTrainMilitia(option.maxQuantity);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleMaxJunkyardKnight() {
    if (!selectedBarracks) return;
    const option = junkyardKnightTrainOptionFor(selectedBarracks.level);
    if (!option) return;
    if (option.maxQuantity <= 0) {
      setActionError("Not enough resources to train any junkyard knights");
      return;
    }
    setJunkyardKnightToTrain(option.maxQuantity);
    const result = await onTrainJunkyardKnight(option.maxQuantity);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleMaxCrossBowSniper() {
    if (!selectedBarracks) return;
    const option = crossBowSniperTrainOptionFor(selectedBarracks.level);
    if (!option) return;
    if (option.maxQuantity <= 0) {
      setActionError("Not enough resources to train any cross-bow snipers");
      return;
    }
    setCrossBowSniperToTrain(option.maxQuantity);
    const result = await onTrainCrossBowSniper(option.maxQuantity);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleRushTrainScouts() {
    const result = await onRushTrainScouts(scoutsToTrain);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleRushTrainMilitia() {
    const result = await onRushTrainMilitia(militiaToTrain);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleScoutTile() {
    if (!selected) return;
    const result = await onScoutTile(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleUpgradeBase() {
    const result = await onUpgradeBase();
    setActionError(result.ok ? null : result.reason);
  }

  async function handleUpgradeReinforcement() {
    const result = await onUpgradeReinforcement();
    setActionError(result.ok ? null : result.reason);
  }

  async function handleDispatchExpedition() {
    if (!selected) return;
    const result = await onDispatchExpedition(selected, militiaToSend, junkyardKnightToSend, crossBowSniperToSend);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleAssaultDen() {
    if (!selectedDen) return;
    const result = await onAssaultDen(selectedDen.id, militiaToSend, junkyardKnightToSend, crossBowSniperToSend);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleSecureLab() {
    const result = await onSecureLab(militiaToSend, junkyardKnightToSend, crossBowSniperToSend);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleGarrisonMilitia() {
    if (!selected) return;
    const result = await onGarrisonMilitia(selected, militiaToGarrison);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleMaxGarrison() {
    if (!selected) return;
    const maxCount = availableMilitia(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults);
    if (maxCount <= 0) return;
    setMilitiaToGarrison(maxCount);
    const result = await onGarrisonMilitia(selected, maxCount);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleGarrisonJunkyardKnight() {
    if (!selected) return;
    const result = await onGarrisonJunkyardKnight(selected, junkyardKnightToGarrison);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleMaxGarrisonJunkyardKnight() {
    if (!selected) return;
    const maxCount = availableJunkyardKnights(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults);
    if (maxCount <= 0) return;
    setJunkyardKnightToGarrison(maxCount);
    const result = await onGarrisonJunkyardKnight(selected, maxCount);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleGarrisonCrossBowSniper() {
    if (!selected) return;
    const result = await onGarrisonCrossBowSniper(selected, crossBowSniperToGarrison);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleMaxGarrisonCrossBowSniper() {
    if (!selected) return;
    const maxCount = availableCrossBowSnipers(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults);
    if (maxCount <= 0) return;
    setCrossBowSniperToGarrison(maxCount);
    const result = await onGarrisonCrossBowSniper(selected, maxCount);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleRecallMilitia() {
    if (!selected) return;
    const result = await onRecallMilitia(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleRepairStructure() {
    if (!selected) return;
    const result = await onRepairStructure(selected);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleRepairBase() {
    const result = await onRepairBase();
    setActionError(result.ok ? null : result.reason);
  }

  async function handleUpgradeOutpostReinforcement() {
    if (!selectedOutpost) return;
    const result = await onUpgradeOutpostReinforcement(selectedOutpost.id);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleRepairOutpost() {
    if (!selectedOutpost) return;
    const result = await onRepairOutpost(selectedOutpost.id);
    setActionError(result.ok ? null : result.reason);
  }

  /**
   * A structure a horde captured stays in place but goes `damaged` (see
   * markCapturedStructuresDamaged, engine/hordes.ts) — this surfaces the
   * fixed-percentage-of-original-build-cost repair option (repairCost,
   * engine/formulas.ts), timed (structureRepairDurationMs), once the player
   * has reclaimed the tile. Generic over whichever of the five structure
   * kinds is actually sitting there, since only one can occupy a tile at a
   * time. Null while repairInProgressFor is non-null for the same structure.
   */
  function repairOptionFor(
    structure: {
      damaged: boolean;
      damageRepair?: { startedAt: number } | null;
      buildCost: Partial<Record<ResourceType, number>>;
    } | null,
  ): RepairOption | null {
    if (!structure || !structure.damaged || structure.damageRepair) return null;
    const cost = repairCost(tweaks, structure.buildCost);
    return { cost, affordable: affordable(cost), durationMinutes: structureRepairDurationMs(tweaks) / 60_000 };
  }

  /** Non-null while the selected structure's damage repair timer is running — see repairOptionFor's doc comment. */
  function repairInProgressFor(
    structure: { damaged: boolean; damageRepair?: { startedAt: number } | null } | null,
  ): { remainingMs: number } | null {
    if (!structure || !structure.damageRepair) return null;
    return { remainingMs: remainingMs(structure.damageRepair.startedAt, structureRepairDurationMs(tweaks), now) };
  }

  /**
   * Non-null while a freshly-built structure hasn't finished its
   * construction timer yet — `durationMs` is caller-supplied since each of
   * the 5 structure kinds pays its own flat build_time_minutes (unlike
   * repairInProgressFor's duration, which is the same flat value for all 5).
   */
  function constructionInProgressFor(
    buildStartedAt: number | null | undefined,
    durationMs: number,
  ): { remainingMs: number } | null {
    if (!buildStartedAt) return null;
    return { remainingMs: remainingMs(buildStartedAt, durationMs, now) };
  }

  const selectedTile = selected ? tileAt(selected) : null;
  const selectedPath = selected ? pathAt(selected) : null;
  const selectedTower = selected ? towerAt(selected) : null;
  const selectedWall = selected ? wallAt(selected) : null;
  const selectedBarracks = selected ? barracksAt(selected) : null;
  const selectedDock = selected ? dockAt(selected) : null;
  const selectedIsBase = selected ? axialEquals(selected, territory.base) : false;
  const selectedDen: DenRecord | null = selected ? (dens.find((d) => axialEquals(d.coord, selected)) ?? null) : null;
  const selectedOutpost: OutpostRecord | null = selected ? outpostAt(selected) : null;
  const selectedTombstone: TombstoneRecord | null = selected
    ? (tombstones.find((t) => axialEquals(t.coord, selected)) ?? null)
    : null;
  // The lab stays indistinguishable from ordinary unscouted ground until the
  // player actually scouts its exact tile (DESIGN.md §13 — "hidden from
  // normal scouting") — isScouted gates this the same way it gates every
  // other "reveal what's here" branch below.
  const selectedIsLab = selected !== null && isScouted(selected) && axialEquals(lab.coord, selected);
  // A den's or outpost's own core coordinate can end up in territory.owned
  // (the hold/starting ring, axialSpiral, includes its center) but still
  // isn't buildable ground — same exclusion as the main base tile.
  const selectedEmpty =
    !selectedTile &&
    !selectedPath &&
    !selectedTower &&
    !selectedWall &&
    !selectedBarracks &&
    !selectedDock &&
    !selectedDen &&
    !selectedOutpost &&
    !selectedIsLab;
  const selectedConnected =
    selected && selectedTile
      ? findResourceTileConnection(extractionTiles, pathTiles, territory.base, selected) !== null
      : false;
  // A horde can be sitting on a tile that's back in territory.owned (a
  // manual militia assault reclaims ownership without necessarily clearing
  // the horde standing there) — repairing a structure it's still occupying
  // would just hand it straight back, so the repair option is blocked until
  // the tile is actually clear (engine-enforced too, see App.tsx:handleRepairStructure).
  const selectedHordeOccupied = selected
    ? hordes.some((h) => axialKey(h.path[h.pathIndex]) === axialKey(selected))
    : false;
  // Same reasoning as selectedHordeOccupied, but adjacency rather than exact
  // tile — a horde grinding on the base from next door would just chip
  // straight back through a repair, same as handleRepairBase enforces.
  const baseAdjacentHordeOccupied = hordes.some((h) => axialDistance(h.path[h.pathIndex], territory.base) <= 1);
  const selectedNoiseFloorContribution = selectedTile
    ? extractionFloorContribution(tweaks, selectedTile)
    : selectedPath
      ? pathFloorContribution(tweaks, selectedPath)
      : selectedTower
        ? towerFloorContribution(tweaks, selectedTower)
        : selectedWall
          ? wallFloorContribution(tweaks, selectedWall)
          : null;
  const selectedStructure = selectedTile ?? selectedPath ?? selectedTower ?? selectedWall ?? selectedBarracks;
  const selectedGarrison = selected ? garrisonAt(garrisons, selected) : null;
  const resourceRates = useMemo(() => {
    const hubCoords: Axial[] = [territory.base, ...outposts.map((o) => o.coord)];
    return computeResourceRates(tweaks, extractionTiles, pathTiles, docks, hubCoords, resources, storageLevels, units, world.seed);
  }, [tweaks, extractionTiles, pathTiles, docks, territory.base, outposts, resources, storageLevels, units, world.seed]);
  /**
   * Coord keys of every upgradeable structure (base, Tower, Barracks) whose
   * next upgrade is unlocked and affordable right now — reuses the exact
   * same *UpgradeOptionFor helpers the tile popup's own upgrade buttons call,
   * so the map badge can never disagree with whether the button is actually
   * clickable. Feeds HexCanvas's upgradeAvailableKeys prop, which colors that
   * structure's level badge orange (see HexCanvas.tsx's doc comment on that
   * prop for the full pattern, including why dens are excluded).
   *
   * Not memoized — matches every other *OptionFor helper in this component
   * (all called directly, unmemoized), and HexCanvas's own draw effect
   * already reruns every tick regardless (expeditionsByKey/denAssaultsByKey
   * depend on `now`), so memoizing this alone wouldn't save a redraw anyway.
   *
   * Adding a new upgradeable structure type: compute its affordability here
   * the same way (guard on buildStartedAt so a structure still under its
   * *initial* construction doesn't light up), add its coords to this Set,
   * and make sure its `drawLevelBadge` call in HexCanvas passes
   * `upgradeAvailableKeys.has(coordKey) ? UPGRADE_AVAILABLE_BADGE_COLOR : undefined`
   * — that's the whole pattern, no other wiring needed.
   */
  function upgradeAvailableKeysFor(): Set<string> {
    const set = new Set<string>();
    if (baseUpgradeOptionFor()?.affordable) set.add(axialKey(territory.base));
    for (const t of towers) {
      if (t.buildStartedAt) continue;
      if (towerUpgradeOptionFor(t)?.affordable) set.add(axialKey(t.coord));
    }
    for (const b of barracksList) {
      if (b.buildStartedAt) continue;
      if (barracksUpgradeOptionFor(b)?.affordable) set.add(axialKey(b.coord));
    }
    return set;
  }
  const upgradeAvailableKeys = upgradeAvailableKeysFor();

  /**
   * Owned, empty, buildable-land tiles where at least one structure type is
   * currently affordable — teal-highlighted on the map while build-mode
   * (the hammer slot) is active. Deliberately a single highlight color for
   * every eligible tile rather than color-coded per structure type: an
   * empty tile is simultaneously eligible for extraction/path/tower/wall/
   * barracks all at once (they're not mutually exclusive choices at the
   * "can something go here" level), so there's no single type to color a
   * given tile by — actually building still happens per-tile via the normal
   * popup once selected.
   *
   * Uses `useMemo` (unlike upgradeAvailableKeysFor above) since this is a
   * real per-owned-tile loop, not a handful of structures — worth skipping
   * entirely while build-mode is off. Written against imported pure
   * functions directly (scaledCostMap/pathBuildCost/etc.), not the
   * component's local *OptionFor closures, so the dependency array stays
   * exhaustively correct without oxlint's closure-tracking limitations
   * (see resourceRates above for the same reasoning).
   */
  const buildModeEligibleKeys = useMemo(() => {
    if (!buildModeActive) return new Set<string>();

    const canAfford = (cost: Partial<Record<ResourceType, number>>) =>
      Object.entries(cost).every(([res, amount]) => resources[res as ResourceType] >= (amount ?? 0));

    const anyExtractionAffordable = RESOURCE_ORDER.some((resource) => {
      const existingCount = extractionTiles.filter((t) => t.resource === resource).length;
      return canAfford(scaledCostMap(tweaks.extraction_tiles[resource].build_cost_base, existingCount + 1));
    });
    const anyBuildAffordable =
      anyExtractionAffordable ||
      canAfford(pathBuildCost(tweaks)) ||
      canAfford(towerBuildCost(tweaks, towers.length + 1)) ||
      canAfford(wallBuildCost(tweaks, walls.length + 1)) ||
      canAfford(barracksBuildCost(tweaks, barracksList.length + 1));

    if (!anyBuildAffordable) return new Set<string>();

    const occupiedKeys = new Set<string>();
    for (const t of extractionTiles) occupiedKeys.add(axialKey(t.coord));
    for (const p of pathTiles) occupiedKeys.add(axialKey(p.coord));
    for (const t of towers) occupiedKeys.add(axialKey(t.coord));
    for (const w of walls) occupiedKeys.add(axialKey(w.coord));
    for (const b of barracksList) occupiedKeys.add(axialKey(b.coord));
    for (const d of docks) occupiedKeys.add(axialKey(d.coord));

    const eligible = new Set<string>();
    for (const coord of territory.owned) {
      if (axialEquals(coord, territory.base)) continue;
      const key = axialKey(coord);
      if (occupiedKeys.has(key)) continue;
      if (!isBuildableLand(world.seed, coord)) continue;
      eligible.add(key);
    }
    return eligible;
  }, [buildModeActive, resources, extractionTiles, pathTiles, towers, walls, barracksList, docks, territory.owned, territory.base, world.seed, tweaks]);

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column" }}>
      <header
        style={{
          padding: "0.5rem 1rem",
          flex: "0 0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          rowGap: "0.4rem",
          columnGap: "1.25rem",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", rowGap: "0.4rem", columnGap: "0.85rem" }}>
          {RESOURCE_ORDER.map((type) => (
            <StatChip
              key={type}
              icon={<img src={`/tiles/resources/${type}.png`} width={18} height={18} alt="" style={{ display: "block" }} />}
              value={Math.floor(resources[type]).toLocaleString()}
              delta={resourceRates[type]}
              title={type}
            />
          ))}
        </div>
        <div style={{ width: 130 }}>
          <StatRow
            icon={<Volume2 size={16} />}
            label="noise"
            current={noise.value}
            max={noiseCap(tweaks, base.level)}
            displayValue={`${Math.floor(noise.value)}db`}
            barColor="#f2b64d"
          />
        </div>
      </header>
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        <HexCanvas
          ref={hexCanvasRef}
          seed={world.seed}
          gridSize={tweaks.game.grid_size}
          tweaks={tweaks}
          base={territory.base}
          baseLevel={base.level}
          upgradeAvailableKeys={upgradeAvailableKeys}
          buildModeEligibleKeys={buildModeEligibleKeys}
          owned={territory.owned}
          extractionTiles={extractionTiles}
          pathTiles={pathTiles}
          towers={towers}
          walls={walls}
          barracksList={barracksList}
          garrisons={garrisons}
          scoutedTiles={scoutedTiles}
          dens={dens}
          outposts={outposts}
          hordes={hordes}
          expeditions={expeditions}
          denAssaults={denAssaults}
          tombstones={tombstones}
          now={now}
          docks={docks}
          scoutSkiffs={scoutSkiffs}
          wanderingScouts={wanderingScouts}
          relocationDestination={base.relocation?.destination ?? null}
          selected={selected}
          playerColor={player.color}
          onTileClick={selectTile}
        />
      </div>
      {selected && (
        <TilePopup
          coord={selected}
          owned={isOwned(selected)}
          terrain={isOwned(selected) || isScouted(selected) ? terrainAt(world.seed, selected) : null}
          isScouted={isScouted(selected)}
          isBase={selectedIsBase}
          existingTile={selectedTile}
          noiseFloorContribution={selectedNoiseFloorContribution}
          stockpileCap={tweaks.storage.capacity_base_per_resource}
          connected={selectedConnected}
          buildOptions={
            isOwned(selected) && selectedEmpty && !selectedIsBase && isBuildableLand(world.seed, selected)
              ? buildOptionsFor()
              : null
          }
          tierUpgrade={selectedTile && isOwned(selected) ? tierUpgradeFor(selectedTile) : null}
          tierUpgradeInProgress={selectedTile ? tierUpgradeInProgressFor(selectedTile) : null}
          storageUpgrades={selectedIsBase ? storageUpgradesFor() : null}
          pathTile={selectedPath}
          pathBuildOption={
            isOwned(selected) && selectedEmpty && !selectedIsBase && isBuildableLand(world.seed, selected)
              ? pathBuildOptionFor()
              : null
          }
          pathUpgradeOption={selectedPath && isOwned(selected) ? pathUpgradeOptionFor(selectedPath) : null}
          pathUpgradeInProgress={selectedPath ? pathUpgradeInProgressFor(selectedPath) : null}
          tower={selectedTower}
          towerStats={
            selectedTower
              ? { range: towerRange(tweaks, selectedTower.level), damage: towerDamage(tweaks, selectedTower.level) }
              : null
          }
          towerBuildOption={
            isOwned(selected) && selectedEmpty && !selectedIsBase && isBuildableLand(world.seed, selected)
              ? towerBuildOptionFor()
              : null
          }
          towerUpgradeOption={selectedTower && isOwned(selected) ? towerUpgradeOptionFor(selectedTower) : null}
          towerUpgradeInProgress={selectedTower ? towerUpgradeInProgressFor(selectedTower) : null}
          wall={selectedWall}
          wallMaxDurability={selectedWall ? maxWallDurability(tweaks, selectedWall.tier) : null}
          wallBuildOption={
            isOwned(selected) && selectedEmpty && !selectedIsBase && isBuildableLand(world.seed, selected)
              ? wallBuildOptionFor()
              : null
          }
          wallUpgradeOption={selectedWall && isOwned(selected) ? wallUpgradeOptionFor(selectedWall) : null}
          wallRepairOption={selectedWall && isOwned(selected) ? wallRepairOptionFor(selectedWall) : null}
          wallActionStatus={selectedWall ? wallActionStatusFor(selectedWall) : null}
          barracks={selectedBarracks}
          barracksBuildOption={
            isOwned(selected) && selectedEmpty && !selectedIsBase && isBuildableLand(world.seed, selected)
              ? barracksBuildOptionFor()
              : null
          }
          barracksUpgradeOption={
            selectedBarracks && isOwned(selected) ? barracksUpgradeOptionFor(selectedBarracks) : null
          }
          barracksUpgradeInProgress={selectedBarracks ? barracksUpgradeInProgressFor(selectedBarracks) : null}
          dock={selectedDock}
          dockYieldPerSecond={selectedDock ? dockYieldPerSecond(tweaks, selectedDock) : null}
          dockBuildOption={
            (isOwned(selected) || isScouted(selected)) &&
            selectedEmpty &&
            !selectedIsBase &&
            terrainAt(world.seed, selected) === "water" &&
            isTransitionTile(world.seed, selected)
              ? dockBuildOptionFor()
              : null
          }
          fishingBoatOption={selectedDock ? fishingBoatOptionFor(selectedDock) : null}
          fishingBoatInProgress={selectedDock ? fishingBoatInProgressFor(selectedDock) : null}
          scoutSkiffOption={selectedDock ? scoutSkiffOptionFor(selectedDock) : null}
          scoutSkiffInProgress={selectedDock ? scoutSkiffInProgressFor(selectedDock) : null}
          scoutSkiffCount={
            selectedDock
              ? scoutSkiffs.filter((s) => axialKey(s.homeDockCoord) === axialKey(selectedDock.coord) && s.buildStartedAt === null)
                  .length
              : 0
          }
          wanderingScoutOption={selectedBarracks ? wanderingScoutOptionFor(selectedBarracks) : null}
          wanderingScoutInProgress={selectedBarracks ? wanderingScoutInProgressFor(selectedBarracks) : null}
          wanderingScoutCount={
            selectedBarracks
              ? wanderingScouts.filter(
                  (s) => axialKey(s.homeBarracksCoord) === axialKey(selectedBarracks.coord) && s.buildStartedAt === null,
                ).length
              : 0
          }
          scoutStockpile={units.scoutStockpile}
          scoutCapacity={scoutCapacityFor(tweaks, barracksList)}
          militiaCount={units.militiaCount}
          militiaCapacity={militiaCapacityFor(tweaks, barracksList)}
          junkyardKnightCount={units.junkyardKnightCount}
          junkyardKnightCapacity={junkyardKnightCapacityFor(tweaks, barracksList)}
          crossBowSniperCount={units.crossBowSniperCount}
          crossBowSniperCapacity={crossBowSniperCapacityFor(tweaks, barracksList)}
          scoutTrainOption={
            selectedBarracks && isOwned(selected) && !selectedBarracks.damaged ? scoutTrainOptionFor() : null
          }
          militiaTrainOption={
            selectedBarracks && isOwned(selected) && !selectedBarracks.damaged ? militiaTrainOptionFor() : null
          }
          junkyardKnightTrainOption={
            selectedBarracks && isOwned(selected) && !selectedBarracks.damaged
              ? junkyardKnightTrainOptionFor(selectedBarracks.level)
              : null
          }
          crossBowSniperTrainOption={
            selectedBarracks && isOwned(selected) && !selectedBarracks.damaged
              ? crossBowSniperTrainOptionFor(selectedBarracks.level)
              : null
          }
          scoutQueueStatus={selectedBarracks ? scoutQueueStatus : null}
          militiaQueueStatus={selectedBarracks ? militiaQueueStatus : null}
          junkyardKnightQueueStatus={selectedBarracks ? junkyardKnightQueueStatus : null}
          crossBowSniperQueueStatus={selectedBarracks ? crossBowSniperQueueStatus : null}
          scoutsToTrain={scoutsToTrain}
          militiaToTrain={militiaToTrain}
          junkyardKnightToTrain={junkyardKnightToTrain}
          crossBowSniperToTrain={crossBowSniperToTrain}
          scoutTileOption={
            !isOwned(selected) &&
            !isScouted(selected) &&
            units.scoutStockpile > 0 &&
            isTileScoutable(world.seed, selected, territory.owned, scoutedTiles)
          }
          // Checked against the actual demolishable structure types
          // (App.tsx:handleDemolish's own union), not selectedEmpty's
          // inverse — selectedEmpty is false for a den/outpost tile too
          // (deliberately, so build options hide there), which used to make
          // canDemolish true over a den with nothing handleDemolish
          // recognizes, showing a Demolish button that always failed.
          canDemolish={isOwned(selected) && !selectedIsBase && (!!selectedStructure || !!selectedDock)}
          repairOption={repairOptionFor(selectedStructure)}
          repairBlockedByHorde={selectedHordeOccupied}
          repairInProgress={repairInProgressFor(selectedStructure)}
          constructionInProgress={
            selectedTile
              ? constructionInProgressFor(selectedTile.buildStartedAt, extractionTileBuildDurationMs(tweaks))
              : selectedPath
                ? constructionInProgressFor(selectedPath.buildStartedAt, pathBuildDurationMs(tweaks))
                : selectedTower
                  ? constructionInProgressFor(selectedTower.buildStartedAt, towerBuildDurationMs(tweaks))
                  : selectedWall
                    ? constructionInProgressFor(selectedWall.buildStartedAt, wallBuildDurationMs(tweaks))
                    : selectedBarracks
                      ? constructionInProgressFor(selectedBarracks.buildStartedAt, barracksBuildDurationMs(tweaks))
                      : selectedDock
                        ? constructionInProgressFor(selectedDock.buildStartedAt, dockBuildDurationMs(tweaks))
                        : null
          }
          baseLevel={base.level}
          baseUpgradeOption={selectedIsBase ? baseUpgradeOptionFor() : null}
          baseUpgradeInProgress={selectedIsBase ? baseUpgradeInProgress : null}
          baseCurrentHp={base.currentHp}
          baseMaxHp={baseReinforcementHp(tweaks, base.reinforcementLevel)}
          reinforcementUpgradeOption={selectedIsBase ? reinforcementUpgradeOptionFor() : null}
          baseRepairOption={selectedIsBase ? baseRepairOptionFor() : null}
          baseRepairBlockedByHorde={baseAdjacentHordeOccupied}
          reinforcementActionStatus={selectedIsBase ? reinforcementActionStatusFor() : null}
          relocationOption={!selectedIsBase ? relocationOptionFor(selected) : null}
          canRelocateBase={canRelocateBase(tweaks, base.level)}
          baseRelocationInProgress={selectedIsBase ? baseRelocationInProgress : null}
          expeditionOption={
            !isOwned(selected) && isScouted(selected) && !selectedDen && !selectedIsLab
              ? expeditionRouteOptionFor(selected)
              : null
          }
          den={selectedDen}
          denAssaultOption={selectedDen ? denAssaultOptionFor(selectedDen) : null}
          denSiegeStatus={selectedDen ? denSiegeStatusFor(selectedDen) : null}
          denAssaultInProgress={selectedDen ? denAssaultInProgressFor(selectedDen) : null}
          lab={selectedIsLab ? lab : null}
          labAssaultOption={selectedIsLab ? labAssaultOptionFor() : null}
          labAssaultInProgress={selectedIsLab ? labAssaultInProgress() : null}
          outpost={selectedOutpost}
          outpostMaxHp={selectedOutpost ? outpostReinforcementHp(tweaks, selectedOutpost.reinforcementLevel) : null}
          outpostReinforcementUpgradeOption={
            selectedOutpost ? outpostReinforcementUpgradeOptionFor(selectedOutpost) : null
          }
          outpostRepairOption={selectedOutpost ? outpostRepairOptionFor(selectedOutpost) : null}
          outpostReinforcementActionStatus={
            selectedOutpost ? outpostReinforcementActionStatusFor(selectedOutpost) : null
          }
          outpostRepairBlockedByHorde={
            selectedOutpost
              ? hordes.some((h) => axialDistance(h.path[h.pathIndex], selectedOutpost.coord) <= 1)
              : false
          }
          tombstone={selectedTombstone}
          tombstoneExpiresInMs={selectedTombstone ? Math.max(0, selectedTombstone.expiresAt - now) : null}
          militiaToSend={militiaToSend}
          junkyardKnightToSend={junkyardKnightToSend}
          crossBowSniperToSend={crossBowSniperToSend}
          availableMilitiaForExpeditionCount={availableMilitia(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults)}
          availableJunkyardKnightForExpeditionCount={availableJunkyardKnights(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults)}
          availableCrossBowSniperForExpeditionCount={availableCrossBowSnipers(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults)}
          garrisonMilitiaCount={selectedGarrison?.militiaCount ?? 0}
          recallInProgress={selected ? recallInProgressFor(selected) : null}
          availableMilitiaCount={availableMilitia(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults)}
          militiaToGarrison={militiaToGarrison}
          garrisonJunkyardKnightCount={selectedGarrison?.junkyardKnightCount ?? 0}
          availableJunkyardKnightCount={availableJunkyardKnights(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults)}
          junkyardKnightToGarrison={junkyardKnightToGarrison}
          garrisonCrossBowSniperCount={selectedGarrison?.crossBowSniperCount ?? 0}
          availableCrossBowSniperCount={availableCrossBowSnipers(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults)}
          crossBowSniperToGarrison={crossBowSniperToGarrison}
          garrisonBlockedByHorde={selectedHordeOccupied}
          buildError={actionError}
          onBuild={handleBuild}
          onUpgradeTier={handleUpgradeTier}
          onUpgradeStorage={handleUpgradeStorage}
          onCollect={handleCollect}
          onBuildPath={handleBuildPath}
          onUpgradePath={handleUpgradePath}
          onBuildTower={handleBuildTower}
          onUpgradeTower={handleUpgradeTower}
          onBuildWall={handleBuildWall}
          onUpgradeWall={handleUpgradeWall}
          onRepairWall={handleRepairWall}
          onRepair={handleRepairStructure}
          onDemolish={handleDemolish}
          onBuildBarracks={handleBuildBarracks}
          onUpgradeBarracks={handleUpgradeBarracks}
          onBuildDock={handleBuildDock}
          onBuildFishingBoat={handleBuildFishingBoat}
          onBuildScoutSkiff={handleBuildScoutSkiff}
          onCollectDock={handleCollectDock}
          onBuildWanderingScout={handleBuildWanderingScout}
          onTrainScouts={handleTrainScouts}
          onTrainMilitia={handleTrainMilitia}
          onTrainJunkyardKnight={handleTrainJunkyardKnight}
          onTrainCrossBowSniper={handleTrainCrossBowSniper}
          onMaxScouts={handleMaxScouts}
          onMaxMilitia={handleMaxMilitia}
          onMaxJunkyardKnight={handleMaxJunkyardKnight}
          onMaxCrossBowSniper={handleMaxCrossBowSniper}
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
          onMaxGarrison={handleMaxGarrison}
          onGarrisonJunkyardKnight={handleGarrisonJunkyardKnight}
          onMaxGarrisonJunkyardKnight={handleMaxGarrisonJunkyardKnight}
          onGarrisonCrossBowSniper={handleGarrisonCrossBowSniper}
          onMaxGarrisonCrossBowSniper={handleMaxGarrisonCrossBowSniper}
          onRecallMilitia={handleRecallMilitia}
          onChangeMilitiaToSend={setMilitiaToSend}
          onChangeJunkyardKnightToSend={setJunkyardKnightToSend}
          onChangeCrossBowSniperToSend={setCrossBowSniperToSend}
          onChangeScoutsToTrain={setScoutsToTrain}
          onChangeMilitiaToTrain={setMilitiaToTrain}
          onChangeJunkyardKnightToTrain={setJunkyardKnightToTrain}
          onChangeCrossBowSniperToTrain={setCrossBowSniperToTrain}
          onChangeMilitiaToGarrison={setMilitiaToGarrison}
          onChangeJunkyardKnightToGarrison={setJunkyardKnightToGarrison}
          onChangeCrossBowSniperToGarrison={setCrossBowSniperToGarrison}
          onClose={() => setSelected(null)}
        />
      )}
      <div ref={clusterAndPanelsRef}>
      <GlobalHexCluster
        pinnedSlot={{
          key: "fast-forward",
          icon: <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>{speedMultiplier > 1 ? `${speedMultiplier}x` : "▶"}</span>,
          title: "Playtesting only — cycles speed, scaling resource/noise/horde simulation AND every build/upgrade/training timer",
          active: speedMultiplier > 1,
          onClick: onCycleFastForward,
        }}
        slots={[
          {
            key: "garrisons",
            icon: <Flag size={20} />,
            title: "Garrisons",
            active: openPanel === "garrisons",
            onClick: () => setOpenPanel((p) => (p === "garrisons" ? null : "garrisons")),
          },
          {
            key: "scouting",
            icon: <Binoculars size={20} />,
            title: "Scouting",
            active: openPanel === "scouting",
            onClick: () => setOpenPanel((p) => (p === "scouting" ? null : "scouting")),
          },
          {
            key: "military",
            icon: <Swords size={20} />,
            title: "Military",
            active: openPanel === "military",
            onClick: () => setOpenPanel((p) => (p === "military" ? null : "military")),
          },
          {
            key: "research",
            icon: <BarChart3 size={20} />,
            title: "Research",
            // Also lit up while a research is in progress, not just while the panel is open — mirrors the old floating button's "something's happening" cue.
            active: openPanel === "research" || Boolean(research.pending),
            onClick: () => setOpenPanel((p) => (p === "research" ? null : "research")),
          },
          {
            key: "build-mode",
            icon: <Hammer size={20} />,
            title: buildModeActive ? "Exit build mode" : "Build mode",
            active: buildModeActive,
            onClick: () => setBuildModeActive((v) => !v),
          },
          {
            key: "settings",
            icon: <Settings size={20} />,
            title: "Settings",
            active: openPanel === "settings",
            onClick: () => setOpenPanel((p) => (p === "settings" ? null : "settings")),
          },
        ]}
      />
      {openPanel === "garrisons" && (
        <GarrisonsPanel garrisons={garrisons} garrisonRecalls={garrisonRecalls} now={now} onClose={() => setOpenPanel(null)} />
      )}
      {openPanel === "scouting" && (
        <ScoutingPanel
          tweaks={tweaks}
          units={units}
          barracksList={barracksList}
          scoutSkiffs={scoutSkiffs}
          wanderingScouts={wanderingScouts}
          lab={lab}
          base={territory.base}
          onClose={() => setOpenPanel(null)}
        />
      )}
      {openPanel === "military" && (
        <MilitaryPanel tweaks={tweaks} units={units} garrisons={garrisons} barracksList={barracksList} onClose={() => setOpenPanel(null)} />
      )}
      {openPanel === "settings" && (
        <SettingsPanel
          player={player}
          seed={world.seed}
          onRecenterOnBase={() => hexCanvasRef.current?.recenterOnBase()}
          onNewGame={() => setNewGameDialogOpen(true)}
          onClose={() => setOpenPanel(null)}
        />
      )}
      {openPanel === "research" && (
        <ResearchPanel
          tweaks={tweaks}
          research={research}
          resources={resources}
          now={now}
          onStartResearch={onStartResearch}
          onClose={() => setOpenPanel(null)}
        />
      )}
      </div>
      <div
        style={{
          position: "fixed",
          right: "1rem",
          top: "3.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.35rem",
          maxWidth: "min(90vw, 320px)",
        }}
      >
        <ToastStack toasts={toasts} onDismiss={onDismissToast} />
        <NotificationTray
          expeditions={expeditions}
          denAssaults={denAssaults}
          labAssaults={labAssaults}
          garrisonRecalls={garrisonRecalls}
          now={now}
        />
      </div>
      {newGameDialogOpen && (
        <NewGameDialog
          currentSeed={world.seed}
          onReplayCurrent={() => {
            setNewGameDialogOpen(false);
            onReplayCurrent();
          }}
          onStartNewSeed={(seed) => {
            setNewGameDialogOpen(false);
            onStartNewSeed(seed);
          }}
          onNewPlayer={() => {
            setNewGameDialogOpen(false);
            onNewPlayer();
          }}
          onCancel={() => setNewGameDialogOpen(false)}
        />
      )}
    </div>
  );
}
