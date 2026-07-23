import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { axialDistance, axialEquals, axialKey, type Axial } from "../engine/hexCoords";
import { isBuildableLand, isTransitionTile, terrainAt } from "../engine/terrain";
import { dockBuildCost, dockBuildDurationMs, dockYieldPerSecond } from "../engine/docks";
import { isStructureActive, repairCost, scaledCostMap, structureRepairDurationMs } from "../engine/formulas";
import { yieldPerSecond } from "../engine/tick";
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
import { denDefense } from "../engine/dens";
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
import type { ExtractionTile } from "../data/extractionTiles";
import type { PathTile } from "../data/pathTiles";
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
import {
  BASE_HEX_SIZE,
  HexCanvas,
  PATH_TIER_ICON_NAMES,
  WALL_TIER_ICON_NAMES,
  type HexCanvasHandle,
} from "../render/HexCanvas";
import { NewGameDialog } from "./NewGameDialog";
import {
  type BarracksUpgradeOption,
  type BaseUpgradeOption,
  type BuildOption,
  type DenAssaultOption,
  type ExpeditionOption,
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
  type ReinforcementUpgradeOption,
  type WallActionStatus,
  type WallRepairOption,
  type WallUpgradeOption,
  type WanderingScoutOption,
} from "./tileOptions";
import { ResearchPanel } from "./ResearchPanel";
import { NotificationTray } from "./hud/NotificationTray";
import { ToastStack, type ToastRecord } from "./hud/Toast";
import { Panel } from "./primitives/Panel";
import { PartyDispatchForm } from "./primitives/PartyDispatchForm";
import { GlobalHexCluster } from "./menu/GlobalHexCluster";
import { TileActionRing, type RingAction, type TileActionRingHandle } from "./menu/TileActionRing";
import { HoverTooltip, type HoverTooltipHandle } from "./menu/HoverTooltip";
import { formatCost, formatDuration } from "./format";
import { GarrisonsPanel } from "./panels/GarrisonsPanel";
import { ScoutingPanel } from "./panels/ScoutingPanel";
import { MilitaryPanel } from "./panels/MilitaryPanel";
import { SettingsPanel } from "./panels/SettingsPanel";
import {
  Anchor,
  Archive,
  ArrowUpCircle,
  Binoculars,
  Eye,
  Flag,
  FlaskConical,
  Footprints,
  GraduationCap,
  Hammer,
  HardHat,
  Info,
  Navigation,
  PackageCheck,
  Settings,
  Shield,
  Ship,
  Swords,
  Target,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";

const RESOURCE_ORDER: ResourceType[] = ["food", "wood", "stone", "steel", "power"];

/** Reuses the same painted sprites HexCanvas draws on the map itself — a ring hex for "build/upgrade a tower" shows the actual tower icon, not a generic tool glyph. Sized well above the lucide icons' 18px so the sprite reads clearly inside a ring hex. */
function structureIcon(name: string, size = 45) {
  return <img src={`/tiles/structures/${name}.png`} width={size} height={size} alt="" style={{ objectFit: "contain" }} />;
}
/** Small hand-drawn marker icons (public/tiles/markers/) instead of the full-size in-world resource sprites — those read fine painted on the map itself but turn into an indistinct blob at ring-hex/HUD-chip size. */
function resourceIcon(resource: ResourceType, size = 45) {
  return <img src={`/tiles/markers/icon-${resource}.png`} width={size} height={size} alt="" style={{ objectFit: "contain" }} />;
}
function noiseIcon(size = 45) {
  return <img src="/tiles/markers/icon-noise.png" width={size} height={size} alt="" style={{ objectFit: "contain" }} />;
}

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

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** The hover tooltip's card — icon + type name, a status line, then whatever stat rows apply to this structure kind. Deliberately terser than infoDialogContent's Panel (smaller font/padding, no "Info" heading) since this follows the cursor rather than sitting in a fixed dialog slot. */
function HoverPanel({ icon, title, status, children }: { icon: ReactNode; title: string; status: string; children?: ReactNode }) {
  return (
    <Panel
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.2rem",
        fontSize: "0.75rem",
        lineHeight: 1.4,
        minWidth: 150,
        maxWidth: 230,
        padding: "0.5rem 0.65rem",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        {icon}
        <strong style={{ fontSize: "0.82rem" }}>{title}</strong>
      </span>
      <span style={{ opacity: 0.8 }}>{status}</span>
      {children}
    </Panel>
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
  /** Positioned imperatively, not via React state — see TileActionRing.tsx's doc comment. Repositioned directly inside handleViewportChange below. */
  const ringRef = useRef<TileActionRingHandle>(null);
  /** Same imperative-positioning convention as ringRef — see HoverTooltip.tsx. */
  const hoverTooltipRef = useRef<HoverTooltipHandle>(null);
  const [selected, setSelected] = useState<Axial | null>(null);
  /** Desktop-mouse hover target (HexCanvas's onTileHover) — null on touch devices, which never report hover. Only changes when the hovered tile itself changes (deduped in HexCanvas), not on every mousemove pixel. */
  const [hoveredCoord, setHoveredCoord] = useState<Axial | null>(null);
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

  /** Null once this dock already has as many skiffs (built or under construction) as tweaks.docks.scout_skiff.max_per_dock allows. */
  function scoutSkiffOptionFor(d: DockRecord): SkiffBuildOption | null {
    const existing = scoutSkiffs.filter((s) => axialKey(s.homeDockCoord) === axialKey(d.coord)).length;
    if (existing >= tweaks.docks.scout_skiff.max_per_dock) return null;
    const cost = tweaks.docks.scout_skiff.cost;
    return { cost, affordable: affordable(cost), durationMinutes: tweaks.docks.scout_skiff.build_time_minutes };
  }

  /** Non-null while this dock's newest scout skiff is still under construction. */

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
    // While a tile is already selected (its ring/card open), clicking a
    // DIFFERENT tile just closes the current selection instead of jumping
    // straight to the new tile's menu — closing and re-selecting is a
    // separate, deliberate second click.
    if (selected && !axialEquals(selected, coord)) {
      setSelected(null);
      return;
    }
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

  /**
   * Repositions the action ring by calling its imperative handle directly —
   * deliberately not a React state update. `HexCanvas` calls this from
   * inside its draw effect (via a ref, not a dependency), so routing it
   * through `setState` here would re-render all of GameScreen's ~30
   * `selectedX` derivations on every pan/zoom frame. See TileActionRing.tsx.
   *
   * Passes a coord->screen-position resolver (the same getTileScreenPosition
   * HexCanvas already exposes) plus the current on-screen hex circumradius
   * (BASE_HEX_SIZE * zoom) — TileActionRing looks up whichever hexes are
   * currently mounted (at whatever sub-ring depth) and repositions each via
   * its own registered coordinate. Matches the map's own geometry exactly,
   * not an approximated UI size, so the ring's hexes genuinely overlay the
   * tiles they sit on at any zoom level.
   */
  function handleViewportChange(viewport: { pan: { x: number; y: number }; zoom: number }) {
    ringRef.current?.repositionAll(
      (coord) => hexCanvasRef.current?.getTileScreenPosition(coord) ?? null,
      BASE_HEX_SIZE * viewport.zoom,
    );
    hoverTooltipRef.current?.reposition(
      (coord) => hexCanvasRef.current?.getTileScreenPosition(coord) ?? null,
      BASE_HEX_SIZE * viewport.zoom,
    );
  }

  /** HexCanvas's onTileHover — already deduped to only fire on an actual tile change, so this is a cheap, infrequent state update rather than a per-mousemove-frame one. */
  function handleTileHover(coord: Axial | null) {
    setHoveredCoord(coord);
  }

  /**
   * The structural "commit an action" buttons for the currently selected
   * tile — mirrors TilePopup's own JSX conditionals branch for branch (same
   * gates, same *OptionFor helpers, same handlers) so the ring can never
   * show something the popup wouldn't, or vice versa. Multi-choice actions
   * (which resource to extract, which storage to upgrade) collapse into one
   * hex with a `subActions` sub-ring rather than eating multiple root slots.
   *
   * Called by ringActionsFor below, which appends the universal
   * owned-tile-regardless-of-structure actions (Collect, Garrison, Demolish)
   * on top of whatever this returns.
   */
  function structuralActionsFor(): RingAction[] {
    if (!selected) return [];
    const actions: RingAction[] = [];

    // Den and lab are checked first — `isOwned` can be false for either (a
    // den/lab isn't "owned territory" until cleared/secured), so they'd
    // otherwise fall through to the unowned-tile branch below.
    if (selectedDen) {
      const option = denAssaultOptionFor(selectedDen);
      if (option) {
        const buttonLabel = selectedDen.siege ? "Send reinforcements" : "Assault den";
        actions.push({
          key: "assault-den",
          icon: <Swords size={18} />,
          title: `${buttonLabel} — defense ${option.denDefense.toFixed(0)}, ETA ${Math.ceil(option.etaMs / 60_000)}m`,
          disabled: !option.affordable,
          formContent: dispatchFormContent(
            option,
            <p>Defense: {option.denDefense.toFixed(0)}</p>,
            buttonLabel,
            handleAssaultDen,
          ),
        });
      }
      return actions;
    }

    if (selectedIsLab) {
      const option = labAssaultOptionFor();
      if (option) {
        actions.push({
          key: "secure-lab",
          icon: <FlaskConical size={18} />,
          title: `Secure the lab — guardian defense ${option.guardianDefense.toFixed(0)}`,
          disabled: !option.affordable,
          formContent: dispatchFormContent(
            option,
            <p>Guardian defense: {option.guardianDefense.toFixed(0)}</p>,
            "Secure lab",
            handleSecureLab,
          ),
        });
      }
      return actions;
    }

    // Relocate-here applies to any empty, dry-land, scouted-or-owned tile —
    // computed once up front rather than duplicated into every branch below,
    // since relocationOptionFor already returns null everywhere it doesn't apply.
    if (!selectedIsBase) {
      const relocation = relocationOptionFor(selected);
      if (relocation) {
        actions.push({
          key: "relocate",
          icon: <Navigation size={18} />,
          title: `Relocate base here — ${formatCost(relocation.cost)}, ${Math.ceil(relocation.durationMs / 60_000)}m`,
          disabled: !relocation.affordable,
          onClick: handleRelocateBase,
        });
      }
    }

    if (selectedOutpost) {
      const upgrade = outpostReinforcementUpgradeOptionFor(selectedOutpost);
      if (upgrade) {
        actions.push({
          key: "outpost-upgrade",
          icon: structureIcon("outpost"),
          title: `Upgrade reinforcement to ${Math.floor(upgrade.hp)} HP — ${formatCost(upgrade.cost)}`,
          disabled: !upgrade.affordable,
          upgradeAvailable: upgrade.affordable,
          onClick: handleUpgradeOutpostReinforcement,
        });
      }
      const repair = outpostRepairOptionFor(selectedOutpost);
      if (repair) {
        actions.push({
          key: "outpost-repair",
          icon: <Wrench size={18} />,
          title: `Repair outpost — ${formatCost(repair.cost)}`,
          disabled: !repair.affordable,
          onClick: handleRepairOutpost,
        });
      }
      return actions;
    }

    if (selectedIsBase) {
      const baseUpgrade = baseUpgradeOptionFor();
      if (baseUpgrade) {
        actions.push({
          key: "base-upgrade",
          icon: structureIcon("base"),
          title: `Upgrade base to L${baseUpgrade.targetLevel} — ${formatCost(baseUpgrade.cost)}`,
          disabled: !baseUpgrade.affordable,
          upgradeAvailable: baseUpgrade.affordable,
          onClick: handleUpgradeBase,
        });
      }
      const reinforce = reinforcementUpgradeOptionFor();
      if (reinforce) {
        actions.push({
          key: "base-reinforce",
          icon: <ArrowUpCircle size={18} />,
          title: `Upgrade reinforcement to ${Math.floor(reinforce.hp)} HP — ${formatCost(reinforce.cost)}`,
          disabled: !reinforce.affordable,
          upgradeAvailable: reinforce.affordable,
          onClick: handleUpgradeReinforcement,
        });
      }
      const repair = baseRepairOptionFor();
      if (repair) {
        actions.push({
          key: "base-repair",
          icon: <Wrench size={18} />,
          title: `Repair base — ${formatCost(repair.cost)}`,
          disabled: !repair.affordable || baseAdjacentHordeOccupied,
          onClick: handleRepairBase,
        });
      }
      const storageOptions = storageUpgradesFor().filter((o) => o.inProgress === null);
      if (storageOptions.length > 0) {
        actions.push({
          key: "storage-upgrade",
          icon: <Archive size={18} />,
          title: "Upgrade storage",
          upgradeAvailable: storageOptions.some((o) => o.affordable),
          subActions: storageOptions.map((o) => ({
            key: o.resource,
            icon: resourceIcon(o.resource),
            title: `${o.resource} → L${o.level} (${formatCost(o.cost)})`,
            disabled: !o.affordable,
            upgradeAvailable: o.affordable,
            onClick: () => handleUpgradeStorage(o.resource),
          })),
        });
      }
      return actions;
    }

    if (selectedDock) {
      const fishingBoat = fishingBoatOptionFor(selectedDock);
      if (fishingBoat) {
        actions.push({
          key: "fishing-boat",
          icon: <Anchor size={18} />,
          title: `Build fishing boat — ${formatCost(fishingBoat.cost)}`,
          disabled: !fishingBoat.affordable,
          onClick: handleBuildFishingBoat,
        });
      }
      const scoutSkiff = scoutSkiffOptionFor(selectedDock);
      if (scoutSkiff) {
        actions.push({
          key: "scout-skiff",
          icon: <Ship size={18} />,
          title: `Build scout skiff — ${formatCost(scoutSkiff.cost)}, ${scoutSkiff.durationMinutes}m`,
          disabled: !scoutSkiff.affordable,
          onClick: handleBuildScoutSkiff,
        });
      }
      return actions;
    }

    if (selectedTile) {
      if (selectedTile.damaged) {
        const repair = repairOptionFor(selectedStructure);
        if (repair) {
          actions.push({
            key: "tile-repair",
            icon: <Wrench size={18} />,
            title: `Repair extraction tile — ${formatCost(repair.cost)}, ${repair.durationMinutes}m`,
            disabled: !repair.affordable || selectedHordeOccupied,
            onClick: handleRepairStructure,
          });
        }
      } else {
        const upgrade = tierUpgradeFor(selectedTile);
        if (upgrade) {
          actions.push({
            key: "tile-upgrade",
            icon: resourceIcon(selectedTile.resource),
            title: `Upgrade to ${upgrade.targetTier} — ${formatCost(upgrade.cost)}, ${upgrade.durationMinutes}m`,
            disabled: !upgrade.affordable,
            upgradeAvailable: upgrade.affordable,
            onClick: handleUpgradeTier,
          });
        }
      }
      return actions;
    }

    if (selectedPath) {
      if (selectedPath.damaged) {
        const repair = repairOptionFor(selectedStructure);
        if (repair) {
          actions.push({
            key: "path-repair",
            icon: <Wrench size={18} />,
            title: `Repair path — ${formatCost(repair.cost)}, ${repair.durationMinutes}m`,
            disabled: !repair.affordable || selectedHordeOccupied,
            onClick: handleRepairStructure,
          });
        }
      } else {
        const upgrade = pathUpgradeOptionFor(selectedPath);
        if (upgrade) {
          actions.push({
            key: "path-upgrade",
            icon: structureIcon(PATH_TIER_ICON_NAMES[selectedPath.tier]),
            title: `Upgrade to ${upgrade.targetTier} — ${formatCost(upgrade.cost)}, ${upgrade.durationMinutes}m`,
            disabled: !upgrade.affordable,
            upgradeAvailable: upgrade.affordable,
            onClick: handleUpgradePath,
          });
        }
      }
      return actions;
    }

    if (selectedTower) {
      if (selectedTower.damaged) {
        const repair = repairOptionFor(selectedStructure);
        if (repair) {
          actions.push({
            key: "tower-repair",
            icon: <Wrench size={18} />,
            title: `Repair tower — ${formatCost(repair.cost)}, ${repair.durationMinutes}m`,
            disabled: !repair.affordable || selectedHordeOccupied,
            onClick: handleRepairStructure,
          });
        }
      } else {
        const upgrade = towerUpgradeOptionFor(selectedTower);
        if (upgrade) {
          actions.push({
            key: "tower-upgrade",
            icon: structureIcon("tower"),
            title: `Upgrade to L${upgrade.targetLevel} — ${formatCost(upgrade.cost)}, ${upgrade.durationMinutes}m`,
            disabled: !upgrade.affordable,
            upgradeAvailable: upgrade.affordable,
            onClick: handleUpgradeTower,
          });
        }
      }
      return actions;
    }

    if (selectedWall) {
      // Unlike tile/path/tower/barracks, a wall's upgrade and repair options
      // aren't damaged-XOR-not — both can be independently available at
      // once (below-max durability AND tier-upgradeable), gated by one
      // shared in-progress status rather than each other.
      if (!wallActionStatusFor(selectedWall)) {
        const upgrade = wallUpgradeOptionFor(selectedWall);
        if (upgrade) {
          actions.push({
            key: "wall-upgrade",
            icon: structureIcon(WALL_TIER_ICON_NAMES[selectedWall.tier]),
            title: `Upgrade to ${upgrade.targetTier} — ${formatCost(upgrade.cost)}, ${upgrade.durationMinutes}m`,
            disabled: !upgrade.affordable,
            upgradeAvailable: upgrade.affordable,
            onClick: handleUpgradeWall,
          });
        }
        const repair = wallRepairOptionFor(selectedWall);
        if (repair) {
          actions.push({
            key: "wall-repair",
            icon: <Wrench size={18} />,
            title: `Repair wall — ${formatCost(repair.cost)}, ${repair.durationMinutes}m`,
            disabled: !repair.affordable,
            onClick: handleRepairWall,
          });
        }
      }
      return actions;
    }

    if (selectedBarracks) {
      if (selectedBarracks.damaged) {
        const repair = repairOptionFor(selectedStructure);
        if (repair) {
          actions.push({
            key: "barracks-repair",
            icon: <Wrench size={18} />,
            title: `Repair barracks — ${formatCost(repair.cost)}, ${repair.durationMinutes}m`,
            disabled: !repair.affordable || selectedHordeOccupied,
            onClick: handleRepairStructure,
          });
        }
      } else {
        const upgrade = barracksUpgradeOptionFor(selectedBarracks);
        if (upgrade) {
          actions.push({
            key: "barracks-upgrade",
            icon: structureIcon("barracks"),
            title: `Upgrade to L${upgrade.targetLevel} — ${formatCost(upgrade.cost)}, ${upgrade.durationMinutes}m`,
            disabled: !upgrade.affordable,
            upgradeAvailable: upgrade.affordable,
            onClick: handleUpgradeBarracks,
          });
        }
      }
      const wanderingScout = wanderingScoutOptionFor(selectedBarracks);
      if (wanderingScout) {
        actions.push({
          key: "wandering-scout",
          icon: <Footprints size={18} />,
          title: `Build wandering scout — retires ${wanderingScout.scoutCost} scouts, ${formatCost(wanderingScout.cost)}, ${wanderingScout.durationMinutes}m`,
          disabled: !wanderingScout.affordable || wanderingScout.scoutCost > units.scoutStockpile,
          onClick: handleBuildWanderingScout,
        });
      }

      const trainSubActions: RingAction[] = [];
      if (!selectedBarracks.damaged) {
        trainSubActions.push({
          key: "train-scouts",
          icon: <Footprints size={18} />,
          title: "Train scouts",
          formContent: trainFormContent({
            label: "scouts",
            queueStatus: scoutQueueStatus,
            option: scoutTrainOptionFor(),
            toTrain: scoutsToTrain,
            onChangeToTrain: setScoutsToTrain,
            onTrain: handleTrainScouts,
            onMax: handleMaxScouts,
            onRush: handleRushTrainScouts,
          }),
        });
        trainSubActions.push({
          key: "train-militia",
          icon: <Swords size={18} />,
          title: "Train militia",
          formContent: trainFormContent({
            label: "militia",
            queueStatus: militiaQueueStatus,
            option: militiaTrainOptionFor(),
            toTrain: militiaToTrain,
            onChangeToTrain: setMilitiaToTrain,
            onTrain: handleTrainMilitia,
            onMax: handleMaxMilitia,
            onRush: handleRushTrainMilitia,
          }),
        });
        const knightOption = junkyardKnightTrainOptionFor(selectedBarracks.level);
        if (knightOption) {
          trainSubActions.push({
            key: "train-knights",
            icon: <Shield size={18} />,
            title: "Train junkyard knights",
            formContent: trainFormContent({
              label: "junkyard knights",
              queueStatus: junkyardKnightQueueStatus,
              option: knightOption,
              toTrain: junkyardKnightToTrain,
              onChangeToTrain: setJunkyardKnightToTrain,
              onTrain: handleTrainJunkyardKnight,
              onMax: handleMaxJunkyardKnight,
            }),
          });
        }
        const sniperOption = crossBowSniperTrainOptionFor(selectedBarracks.level);
        if (sniperOption) {
          trainSubActions.push({
            key: "train-snipers",
            icon: <Target size={18} />,
            title: "Train cross-bow snipers",
            formContent: trainFormContent({
              label: "cross-bow snipers",
              queueStatus: crossBowSniperQueueStatus,
              option: sniperOption,
              toTrain: crossBowSniperToTrain,
              onChangeToTrain: setCrossBowSniperToTrain,
              onTrain: handleTrainCrossBowSniper,
              onMax: handleMaxCrossBowSniper,
            }),
          });
        }
      }
      if (trainSubActions.length > 0) {
        actions.push({ key: "train", icon: <GraduationCap size={18} />, title: "Train units", subActions: trainSubActions });
      }

      return actions;
    }

    // Dock build (water-bordering-land, owned-or-scouted) — disjoint from
    // the empty-buildable-land branch below (isBuildableLand excludes water).
    const dockBuildGate =
      (isOwned(selected) || isScouted(selected)) &&
      selectedEmpty &&
      !selectedIsBase &&
      terrainAt(world.seed, selected) === "water" &&
      isTransitionTile(world.seed, selected);
    if (dockBuildGate) {
      const dock = dockBuildOptionFor();
      actions.push({
        key: "build-dock",
        icon: structureIcon("dock"),
        title: `Build dock — ${formatCost(dock.cost)}`,
        disabled: !dock.affordable,
        onClick: handleBuildDock,
      });
      return actions;
    }

    // Empty, buildable, owned land — every structure category is
    // independently available here (they're not mutually exclusive choices
    // at the "what can go here" stage, see GameScreen's selectedEmpty gate),
    // grouped under two root-level category hexes — Civil (resource
    // extraction, paths) and Military (tower, wall, barracks) — rather than
    // one flat "Build" wrapper or 5 separate root slots.
    const emptyBuildableGate = isOwned(selected) && selectedEmpty && !selectedIsBase && isBuildableLand(world.seed, selected);
    if (emptyBuildableGate) {
      // The 5 resource choices sit directly on the Civil level (no separate
      // "Build extraction tile" nesting hex) alongside Build path — all 6
      // neighbor slots stay available for real actions, with Back living
      // outside the ring (see TileActionRing's module doc comment).
      const civilSubActions: RingAction[] = buildOptionsFor().map((o) => ({
        key: o.resource,
        icon: resourceIcon(o.resource),
        title: `${o.resource} — ${formatCost(o.cost)}, ${o.durationMinutes}m`,
        disabled: !o.affordable,
        onClick: () => handleBuild(o.resource),
      }));
      const path = pathBuildOptionFor();
      civilSubActions.push({
        key: "build-path",
        icon: structureIcon(PATH_TIER_ICON_NAMES.goat_track),
        title: `Build goat track — ${formatCost(path.cost)}, ${path.durationMinutes}m`,
        disabled: !path.affordable,
        onClick: handleBuildPath,
      });

      const militarySubActions: RingAction[] = [];
      const tower = towerBuildOptionFor();
      militarySubActions.push({
        key: "build-tower",
        icon: structureIcon("tower"),
        title: `Build tower — ${formatCost(tower.cost)}, ${tower.durationMinutes}m`,
        disabled: !tower.affordable,
        onClick: handleBuildTower,
      });
      const wall = wallBuildOptionFor();
      militarySubActions.push({
        key: "build-wall",
        icon: structureIcon(WALL_TIER_ICON_NAMES.wood),
        title: `Build wall — ${formatCost(wall.cost)}, ${wall.durationMinutes}m`,
        disabled: !wall.affordable,
        onClick: handleBuildWall,
      });
      const barracks = barracksBuildOptionFor();
      militarySubActions.push({
        key: "build-barracks",
        icon: structureIcon("barracks"),
        title: `Build barracks — ${formatCost(barracks.cost)}, ${barracks.durationMinutes}m`,
        disabled: !barracks.affordable,
        onClick: handleBuildBarracks,
      });

      actions.push({
        key: "build-civil",
        icon: <HardHat size={18} />,
        title: "Civil",
        subActions: civilSubActions,
      });
      actions.push({
        key: "build-military",
        icon: <Swords size={18} />,
        title: "Military",
        subActions: militarySubActions,
      });
      return actions;
    }

    // Nothing built here, not (yet) ours: scout it, or send an expedition
    // to claim it if it's already scouted.
    if (!isOwned(selected)) {
      if (!isScouted(selected)) {
        const canScout =
          units.scoutStockpile > 0 && isTileScoutable(world.seed, selected, territory.owned, scoutedTiles);
        if (canScout) {
          actions.push({ key: "scout", icon: <Eye size={18} />, title: "Scout this tile", onClick: handleScoutTile });
        }
      } else {
        const expedition = expeditionRouteOptionFor(selected);
        if (expedition) {
          actions.push({
            key: "expedition",
            icon: <Swords size={18} />,
            title: `Send expedition — ${formatCost(expedition.provisionsCost)}, ETA ${Math.ceil(expedition.etaMs / 60_000)}m`,
            disabled: !expedition.affordable,
            formContent: dispatchFormContent(expedition, undefined, "Send expedition", handleDispatchExpedition),
          });
        }
      }
    }

    return actions;
  }

  /** A barracks training hex's popover content — qty input + Max (+ Rush, scout/militia only) — reuses the exact same state/handlers TilePopup's training rows already use. Shows a queue-progress readout instead of the form while a training queue is already running for this unit type. */
  function trainFormContent(params: {
    label: string;
    queueStatus: TrainQueueStatus | null;
    option: TrainOption | SimpleTrainOption | null;
    toTrain: number;
    onChangeToTrain: (n: number) => void;
    onTrain: () => void;
    onMax: () => void;
    onRush?: () => void;
  }): ReactNode {
    if (params.queueStatus) {
      return (
        <Panel style={{ fontSize: "0.8rem", minWidth: 200 }}>
          Training {params.label}: {params.queueStatus.remaining} left, next in {Math.ceil(params.queueStatus.msUntilNextMs / 60_000)}m
        </Panel>
      );
    }
    if (!params.option) return null;
    const disabled = !params.option.affordable || params.toTrain <= 0;
    return (
      <Panel style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.8rem", minWidth: 220 }}>
        <strong>Train {params.label}</strong>
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <input
            type="number"
            min={0}
            max={params.option.maxQuantity}
            value={params.toTrain}
            onChange={(e) => params.onChangeToTrain(Number(e.target.value))}
            style={{ width: 50 }}
            aria-label={`${params.label} to train`}
          />
          <button type="button" onClick={params.onMax}>
            Max
          </button>
        </div>
        <span>{formatCost(params.option.totalCost)}</span>
        <button type="button" disabled={disabled} onClick={params.onTrain}>
          Train
        </button>
        {params.onRush && (
          <button type="button" disabled={disabled} onClick={params.onRush}>
            Rush (instant, noisy)
          </button>
        )}
      </Panel>
    );
  }

  /** One row of the garrison form: qty input + Max + Go, shown only when at least one such unit is available to station. */
  function garrisonUnitRow(
    label: string,
    available: number,
    toGarrison: number,
    onChangeToGarrison: (n: number) => void,
    onMax: () => void,
    onGo: () => void,
  ): ReactNode {
    if (available <= 0) return null;
    return (
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <input
          type="number"
          min={0}
          max={available}
          value={toGarrison}
          onChange={(e) => onChangeToGarrison(Number(e.target.value))}
          style={{ width: 50 }}
          aria-label={`${label} to garrison`}
        />
        <span>
          {label} ({available} free)
        </span>
        <button type="button" onClick={onMax}>
          Max
        </button>
        <button type="button" disabled={selectedHordeOccupied} onClick={onGo}>
          Go
        </button>
      </div>
    );
  }

  /**
   * Shared popover content for expedition/den-assault/lab-secure — reuses
   * the `PartyDispatchForm` primitive built in Phase 0 for exactly this
   * (previously orphaned: TilePopup never got to Phase 5/6 before the ring
   * replaced it, and the ring's first pass wired these three straight to
   * `onClick` with whatever `militiaToSend` defaulted to, so the player's
   * quantity inputs had no UI to reach them at all — this closes that gap).
   */
  function dispatchFormContent(option: ExpeditionOption, extraInfo: ReactNode | undefined, buttonLabel: string, onCommit: () => void): ReactNode {
    const availMilitia = availableMilitia(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults);
    const availKnight = availableJunkyardKnights(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults);
    const availSniper = availableCrossBowSnipers(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults);
    return (
      <Panel style={{ minWidth: 230 }}>
        <PartyDispatchForm
          extraInfo={extraInfo}
          distanceTiles={option.distanceTiles}
          pathCost={option.pathCost}
          provisionsCost={option.provisionsCost}
          etaMs={option.etaMs}
          affordable={option.affordable}
          militia={{ available: availMilitia, toSend: militiaToSend, onChange: setMilitiaToSend }}
          junkyardKnight={{ available: availKnight, toSend: junkyardKnightToSend, onChange: setJunkyardKnightToSend }}
          crossBowSniper={{ available: availSniper, toSend: crossBowSniperToSend, onChange: setCrossBowSniperToSend }}
          buttonLabel={buttonLabel}
          onCommit={onCommit}
        />
      </Panel>
    );
  }

  /** Garrison hex's popover content — same qty-input-plus-Go pattern the old TilePopup used, reusing its exact state/handlers (militiaToGarrison etc.) rather than duplicating them. */
  function garrisonFormContent(): ReactNode {
    if (!selected) return null;
    const availMilitia = availableMilitia(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults);
    const availKnight = availableJunkyardKnights(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults);
    const availSniper = availableCrossBowSnipers(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults);
    const stationedTotal = selectedGarrison
      ? selectedGarrison.militiaCount + selectedGarrison.junkyardKnightCount + selectedGarrison.crossBowSniperCount
      : 0;
    const recalling = recallInProgressFor(selected) !== null;
    return (
      <Panel style={{ display: "flex", flexDirection: "column", gap: "0.4rem", fontSize: "0.8rem", minWidth: 230 }}>
        <strong>Garrison{stationedTotal > 0 ? ` — ${stationedTotal} stationed` : ""}</strong>
        {garrisonUnitRow("militia", availMilitia, militiaToGarrison, setMilitiaToGarrison, handleMaxGarrison, handleGarrisonMilitia)}
        {garrisonUnitRow(
          "knights",
          availKnight,
          junkyardKnightToGarrison,
          setJunkyardKnightToGarrison,
          handleMaxGarrisonJunkyardKnight,
          handleGarrisonJunkyardKnight,
        )}
        {garrisonUnitRow(
          "snipers",
          availSniper,
          crossBowSniperToGarrison,
          setCrossBowSniperToGarrison,
          handleMaxGarrisonCrossBowSniper,
          handleGarrisonCrossBowSniper,
        )}
        {recalling ? (
          <span>Recalling…</span>
        ) : (
          stationedTotal > 0 && (
            <button type="button" onClick={handleRecallMilitia}>
              Recall
            </button>
          )
        )}
      </Panel>
    );
  }

  /**
   * Every user-created action with a countdown — build/upgrade/repair for
   * each of the 5 structure kinds plus dock/fishing-boat/scout-skiff/
   * wandering-scout builds, base level/reinforcement upgrades, outpost
   * reinforcement, and base relocation — surfaced as mini cards in the
   * notification tray (top-right), the same home expeditions/assaults/
   * garrison recalls/den sieges already use. This is the default home for
   * any timed action from here on, not just a selected-tile display: it
   * scans every owned structure, not only whichever tile happens to be
   * selected, since these used to be visible per-tile via TilePopup but
   * nothing else shows them now that it's gone.
   */
  function activeCountdownRows(): { key: string; icon: ReactNode; label: string; coord: Axial; remainingMs: number }[] {
    const rows: { key: string; icon: ReactNode; label: string; coord: Axial; remainingMs: number }[] = [];
    const buildIcon = <Hammer size={14} />;
    const upgradeIcon = <ArrowUpCircle size={14} />;
    const repairIcon = <Wrench size={14} />;

    for (const tile of extractionTiles) {
      const key = axialKey(tile.coord);
      if (tile.buildStartedAt) {
        rows.push({
          key: `tile-build-${key}`,
          icon: buildIcon,
          label: `Building ${tile.resource} tile`,
          coord: tile.coord,
          remainingMs: remainingMs(tile.buildStartedAt, extractionTileBuildDurationMs(tweaks), now),
        });
      }
      if (tile.upgrade) {
        rows.push({
          key: `tile-upgrade-${key}`,
          icon: upgradeIcon,
          label: `Upgrading ${tile.resource} tile to ${tile.upgrade.targetTier}`,
          coord: tile.coord,
          remainingMs: remainingMs(tile.upgrade.startedAt, tierUpgradeDurationMs(tweaks, tile.upgrade.targetTier), now),
        });
      }
      if (tile.damageRepair) {
        rows.push({
          key: `tile-repair-${key}`,
          icon: repairIcon,
          label: `Repairing ${tile.resource} tile`,
          coord: tile.coord,
          remainingMs: remainingMs(tile.damageRepair.startedAt, structureRepairDurationMs(tweaks), now),
        });
      }
    }

    for (const path of pathTiles) {
      const key = axialKey(path.coord);
      if (path.buildStartedAt) {
        rows.push({
          key: `path-build-${key}`,
          icon: buildIcon,
          label: "Building path",
          coord: path.coord,
          remainingMs: remainingMs(path.buildStartedAt, pathBuildDurationMs(tweaks), now),
        });
      }
      if (path.upgrade) {
        rows.push({
          key: `path-upgrade-${key}`,
          icon: upgradeIcon,
          label: `Upgrading path to ${path.upgrade.targetTier}`,
          coord: path.coord,
          remainingMs: remainingMs(path.upgrade.startedAt, pathUpgradeDurationMs(tweaks, path.upgrade.targetTier), now),
        });
      }
      if (path.damageRepair) {
        rows.push({
          key: `path-repair-${key}`,
          icon: repairIcon,
          label: "Repairing path",
          coord: path.coord,
          remainingMs: remainingMs(path.damageRepair.startedAt, structureRepairDurationMs(tweaks), now),
        });
      }
    }

    for (const tower of towers) {
      const key = axialKey(tower.coord);
      if (tower.buildStartedAt) {
        rows.push({
          key: `tower-build-${key}`,
          icon: buildIcon,
          label: "Building tower",
          coord: tower.coord,
          remainingMs: remainingMs(tower.buildStartedAt, towerBuildDurationMs(tweaks), now),
        });
      }
      if (tower.upgrade) {
        rows.push({
          key: `tower-upgrade-${key}`,
          icon: upgradeIcon,
          label: `Upgrading tower to L${tower.upgrade.targetLevel}`,
          coord: tower.coord,
          remainingMs: remainingMs(tower.upgrade.startedAt, towerUpgradeDurationMs(tweaks, tower.upgrade.targetLevel), now),
        });
      }
      if (tower.damageRepair) {
        rows.push({
          key: `tower-repair-${key}`,
          icon: repairIcon,
          label: "Repairing tower",
          coord: tower.coord,
          remainingMs: remainingMs(tower.damageRepair.startedAt, structureRepairDurationMs(tweaks), now),
        });
      }
    }

    for (const wall of walls) {
      const key = axialKey(wall.coord);
      if (wall.buildStartedAt) {
        rows.push({
          key: `wall-build-${key}`,
          icon: buildIcon,
          label: "Building wall",
          coord: wall.coord,
          remainingMs: remainingMs(wall.buildStartedAt, wallBuildDurationMs(tweaks), now),
        });
      }
      const wallStatus = wallActionStatusFor(wall);
      if (wallStatus) {
        rows.push({
          key: `wall-action-${key}`,
          icon: wallStatus.kind === "upgrade" ? upgradeIcon : repairIcon,
          label: wallStatus.kind === "upgrade" ? `Upgrading wall to ${wallStatus.targetTier}` : "Repairing wall",
          coord: wall.coord,
          remainingMs: wallStatus.remainingMs,
        });
      }
      if (wall.damageRepair) {
        rows.push({
          key: `wall-damage-repair-${key}`,
          icon: repairIcon,
          label: "Repairing wall (horde damage)",
          coord: wall.coord,
          remainingMs: remainingMs(wall.damageRepair.startedAt, structureRepairDurationMs(tweaks), now),
        });
      }
    }

    for (const b of barracksList) {
      const key = axialKey(b.coord);
      if (b.buildStartedAt) {
        rows.push({
          key: `barracks-build-${key}`,
          icon: buildIcon,
          label: "Building barracks",
          coord: b.coord,
          remainingMs: remainingMs(b.buildStartedAt, barracksBuildDurationMs(tweaks), now),
        });
      }
      if (b.upgrade) {
        rows.push({
          key: `barracks-upgrade-${key}`,
          icon: upgradeIcon,
          label: `Upgrading barracks to L${b.upgrade.targetLevel}`,
          coord: b.coord,
          remainingMs: remainingMs(b.upgrade.startedAt, barracksUpgradeDurationMs(tweaks, b.upgrade.targetLevel), now),
        });
      }
      if (b.damageRepair) {
        rows.push({
          key: `barracks-repair-${key}`,
          icon: repairIcon,
          label: "Repairing barracks",
          coord: b.coord,
          remainingMs: remainingMs(b.damageRepair.startedAt, structureRepairDurationMs(tweaks), now),
        });
      }
    }

    for (const dock of docks) {
      const key = axialKey(dock.coord);
      if (dock.buildStartedAt) {
        rows.push({
          key: `dock-build-${key}`,
          icon: buildIcon,
          label: "Building dock",
          coord: dock.coord,
          remainingMs: remainingMs(dock.buildStartedAt, dockBuildDurationMs(tweaks), now),
        });
      }
      if (dock.fishingBoatUpgrade) {
        rows.push({
          key: `dock-boat-${key}`,
          icon: buildIcon,
          label: "Building fishing boat",
          coord: dock.coord,
          remainingMs: remainingMs(dock.fishingBoatUpgrade.startedAt, tweaks.docks.fishing_boat.build_time_minutes * 60_000, now),
        });
      }
    }

    for (const skiff of scoutSkiffs) {
      if (skiff.buildStartedAt) {
        rows.push({
          key: `skiff-${skiff.id}`,
          icon: buildIcon,
          label: "Building scout skiff",
          coord: skiff.homeDockCoord,
          remainingMs: remainingMs(skiff.buildStartedAt, tweaks.docks.scout_skiff.build_time_minutes * 60_000, now),
        });
      }
    }

    for (const scout of wanderingScouts) {
      if (scout.buildStartedAt) {
        rows.push({
          key: `wscout-${scout.id}`,
          icon: buildIcon,
          label: "Training wandering scout",
          coord: scout.homeBarracksCoord,
          remainingMs: remainingMs(scout.buildStartedAt, tweaks.units.wandering_scout.build_time_minutes * 60_000, now),
        });
      }
    }

    if (base.upgrade) {
      rows.push({
        key: "base-upgrade",
        icon: upgradeIcon,
        label: `Upgrading base to L${base.upgrade.targetLevel}`,
        coord: territory.base,
        remainingMs: remainingMs(base.upgrade.startedAt, baseUpgradeDurationMs(tweaks, base.upgrade.targetLevel), now),
      });
    }
    if (base.reinforcementAction) {
      const action = base.reinforcementAction;
      if (action.kind === "upgrade") {
        rows.push({
          key: "base-reinforce",
          icon: upgradeIcon,
          label: `Upgrading base reinforcement to L${action.targetLevel}`,
          coord: territory.base,
          remainingMs: remainingMs(action.startedAt, baseReinforcementUpgradeDurationMs(tweaks, action.targetLevel), now),
        });
      } else {
        const maxHp = baseReinforcementHp(tweaks, base.reinforcementLevel);
        rows.push({
          key: "base-reinforce-repair",
          icon: repairIcon,
          label: "Repairing base reinforcement",
          coord: territory.base,
          remainingMs: remainingMs(action.startedAt, baseReinforcementRepairDurationMs(tweaks, base.currentHp, maxHp), now),
        });
      }
    }

    for (const outpost of outposts) {
      if (!outpost.reinforcementAction) continue;
      const action = outpost.reinforcementAction;
      if (action.kind === "upgrade") {
        rows.push({
          key: `outpost-reinforce-${outpost.id}`,
          icon: upgradeIcon,
          label: `Upgrading outpost reinforcement to L${action.targetLevel}`,
          coord: outpost.coord,
          remainingMs: remainingMs(action.startedAt, outpostReinforcementUpgradeDurationMs(tweaks, action.targetLevel), now),
        });
      } else {
        const maxHp = outpostReinforcementHp(tweaks, outpost.reinforcementLevel);
        rows.push({
          key: `outpost-reinforce-repair-${outpost.id}`,
          icon: repairIcon,
          label: "Repairing outpost reinforcement",
          coord: outpost.coord,
          remainingMs: remainingMs(action.startedAt, outpostReinforcementRepairDurationMs(tweaks, outpost.currentHp, maxHp), now),
        });
      }
    }

    if (baseRelocationInProgress) {
      rows.push({
        key: "base-relocation",
        icon: <Navigation size={14} />,
        label: "Relocating base",
        coord: baseRelocationInProgress.destination,
        remainingMs: baseRelocationInProgress.remainingMs,
      });
    }

    return rows;
  }

  /**
   * The passive status info that doesn't have a "first glance" home
   * elsewhere on the map/HUD (unlike tombstones, HP/durability bars, and the
   * siege countdown, which do) — auto-flow/connected status for extraction
   * tiles, noise floor contribution, and tower range/damage. Returns null
   * when the selected tile has none of these, so the ring's Info hex only
   * appears when there's something to show. Countdown-style status (base
   * relocation, every build/upgrade/repair timer) lives in the notification
   * tray instead — see activeCountdownRows below.
   */
  function infoDialogContent(): ReactNode | null {
    if (!selected) return null;
    const rows: ReactNode[] = [];
    if (selectedTile) {
      rows.push(
        <div key="flow">{selectedConnected ? "Connected — auto-flowing to base" : "Not connected — manual collection only"}</div>,
      );
    }
    if (selectedNoiseFloorContribution !== null) {
      rows.push(<div key="noise">Noise floor: +{selectedNoiseFloorContribution.toFixed(1)}db</div>);
    }
    if (selectedTower) {
      rows.push(
        <div key="tower-stats">
          Range {towerRange(tweaks, selectedTower.level)}, damage {towerDamage(tweaks, selectedTower.level).toFixed(1)}
        </div>,
      );
    }
    if (selectedTombstone) {
      rows.push(<div key="tombstone">Tombstone — fades in {formatDuration(Math.max(0, selectedTombstone.expiresAt - now))}</div>);
    }
    if (rows.length === 0) return null;
    return (
      <Panel style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontSize: "0.8rem", minWidth: 220, maxWidth: 320 }}>
        <strong>Info</strong>
        {rows}
      </Panel>
    );
  }

  /**
   * Read-only hover-tooltip content for whatever's at `coord` — desktop-mouse
   * only (see HexCanvas's onTileHover), independent of the click-to-select
   * flow the ring menu uses, so this re-derives its own lookups rather than
   * reusing the `selectedX` family above (those are keyed off `selected`,
   * not whatever tile the cursor happens to be over). Covers the same set of
   * tile kinds as structuralActionsFor, in the same precedence order, but
   * reports status/stats instead of offering actions. Returns null for empty
   * or not-yet-scouted-lab ground — nothing to show.
   */
  function hoverInfoFor(coord: Axial): ReactNode | null {
    if (axialEquals(coord, territory.base)) {
      const status = base.relocation
        ? "Relocating…"
        : base.reinforcementAction
          ? base.reinforcementAction.kind === "upgrade"
            ? `Upgrading reinforcement to L${base.reinforcementAction.targetLevel}…`
            : "Repairing…"
          : base.upgrade
            ? `Upgrading to L${base.upgrade.targetLevel}…`
            : "Operational";
      const maxHp = baseReinforcementHp(tweaks, base.reinforcementLevel);
      return (
        <HoverPanel icon={structureIcon("base", 28)} title={`Base — L${base.level}`} status={status}>
          <span>HP: {Math.floor(base.currentHp)}/{Math.floor(maxHp)}</span>
          <span>Noise cap: {noiseCap(tweaks, base.level)}db</span>
        </HoverPanel>
      );
    }

    const outpost = outpostAt(coord);
    if (outpost) {
      const status = outpost.reinforcementAction
        ? outpost.reinforcementAction.kind === "upgrade"
          ? `Upgrading to L${outpost.reinforcementAction.targetLevel}…`
          : "Repairing…"
        : "Operational";
      const maxHp = outpostReinforcementHp(tweaks, outpost.reinforcementLevel);
      return (
        <HoverPanel icon={structureIcon("outpost", 28)} title={`Outpost — L${outpost.reinforcementLevel}`} status={status}>
          <span>HP: {Math.floor(outpost.currentHp)}/{Math.floor(maxHp)}</span>
        </HoverPanel>
      );
    }

    const den = dens.find((d) => axialEquals(d.coord, coord));
    if (den) {
      const status = den.siege ? `Under siege — wave ${den.siege.waveIndex + 1}` : "Hostile";
      return (
        <HoverPanel icon={<Swords size={22} />} title={`Den — L${den.level}`} status={status}>
          <span>Defense: {denDefense(tweaks, den.level).toFixed(1)}</span>
        </HoverPanel>
      );
    }

    if (isScouted(coord) && axialEquals(lab.coord, coord)) {
      const status = lab.secured ? "Secured" : "Guarded";
      return (
        <HoverPanel icon={<FlaskConical size={22} />} title="Research lab" status={status}>
          {!lab.secured && <span>Guardian defense: {tweaks.lab.guardian_defense.toFixed(0)}</span>}
        </HoverPanel>
      );
    }

    const tile = tileAt(coord);
    if (tile) {
      const status = tile.buildStartedAt
        ? "Under construction"
        : tile.damaged
          ? tile.damageRepair
            ? "Repairing…"
            : "Damaged"
          : tile.upgrade
            ? `Upgrading to ${tile.upgrade.targetTier}…`
            : "Operational";
      const connected = findResourceTileConnection(extractionTiles, pathTiles, territory.base, coord) !== null;
      return (
        <HoverPanel icon={resourceIcon(tile.resource, 28)} title={`${capitalize(tile.resource)} — ${tile.tier}`} status={status}>
          {isStructureActive(tile) && (
            <span>
              Yield: {yieldPerSecond(tweaks, tile, world.seed).toFixed(1)} {tile.resource}/sec
            </span>
          )}
          <span>{connected ? "Connected — auto-flows to base" : "Not connected — manual collection"}</span>
          <span>Stockpile: {Math.floor(tile.stockpile)}</span>
        </HoverPanel>
      );
    }

    const path = pathAt(coord);
    if (path) {
      const status = path.buildStartedAt
        ? "Under construction"
        : path.damaged
          ? path.damageRepair
            ? "Repairing…"
            : "Damaged"
          : path.upgrade
            ? `Upgrading to ${path.upgrade.targetTier}…`
            : "Operational";
      return (
        <HoverPanel icon={structureIcon(PATH_TIER_ICON_NAMES[path.tier], 28)} title={`Path — ${path.tier}`} status={status}>
          <span>Noise floor: +{pathFloorContribution(tweaks, path).toFixed(1)}db</span>
        </HoverPanel>
      );
    }

    const tower = towerAt(coord);
    if (tower) {
      const status = tower.buildStartedAt
        ? "Under construction"
        : tower.damaged
          ? tower.damageRepair
            ? "Repairing…"
            : "Damaged"
          : tower.upgrade
            ? `Upgrading to L${tower.upgrade.targetLevel}…`
            : "Operational";
      return (
        <HoverPanel icon={structureIcon("tower", 28)} title={`Tower — L${tower.level}`} status={status}>
          {isStructureActive(tower) && (
            <>
              <span>Range: {towerRange(tweaks, tower.level)} tiles</span>
              <span>Damage: {towerDamage(tweaks, tower.level).toFixed(1)} DPS</span>
            </>
          )}
          <span>Noise floor: +{towerFloorContribution(tweaks, tower).toFixed(1)}db</span>
        </HoverPanel>
      );
    }

    const wall = wallAt(coord);
    if (wall) {
      const status = wall.buildStartedAt
        ? "Under construction"
        : wall.damaged
          ? wall.damageRepair
            ? "Repairing…"
            : "Damaged"
          : wall.action
            ? wall.action.kind === "upgrade"
              ? `Upgrading to ${wall.action.targetTier}…`
              : "Repairing durability…"
            : "Operational";
      const maxHp = maxWallDurability(tweaks, wall.tier);
      return (
        <HoverPanel icon={structureIcon(WALL_TIER_ICON_NAMES[wall.tier], 28)} title={`Wall — ${wall.tier}`} status={status}>
          <span>
            Durability: {Math.floor(wall.durability)}/{maxHp}
          </span>
          <span>Noise floor: +{wallFloorContribution(tweaks, wall).toFixed(1)}db</span>
        </HoverPanel>
      );
    }

    const barracks = barracksAt(coord);
    if (barracks) {
      const status = barracks.buildStartedAt
        ? "Under construction"
        : barracks.damaged
          ? barracks.damageRepair
            ? "Repairing…"
            : "Damaged"
          : barracks.upgrade
            ? `Upgrading to L${barracks.upgrade.targetLevel}…`
            : "Operational";
      return <HoverPanel icon={structureIcon("barracks", 28)} title={`Barracks — L${barracks.level}`} status={status} />;
    }

    const dock = dockAt(coord);
    if (dock) {
      const status = dock.buildStartedAt ? "Under construction" : "Operational";
      return (
        <HoverPanel icon={structureIcon("dock", 28)} title={dock.fishingBoat ? "Dock — with fishing boat" : "Dock"} status={status}>
          {!dock.buildStartedAt && <span>Yield: {dockYieldPerSecond(tweaks, dock).toFixed(1)} food/sec</span>}
          <span>Stockpile: {Math.floor(dock.stockpile)}</span>
        </HoverPanel>
      );
    }

    const tombstone = tombstones.find((t) => axialEquals(t.coord, coord));
    if (tombstone) {
      const lost = tombstone.militiaLost + tombstone.junkyardKnightLost + tombstone.crossBowSniperLost;
      return (
        <HoverPanel icon={<Info size={22} />} title="Tombstone" status={`Fades in ${formatDuration(Math.max(0, tombstone.expiresAt - now))}`}>
          <span>Lost: {lost} unit{lost === 1 ? "" : "s"}</span>
        </HoverPanel>
      );
    }

    return null;
  }

  /**
   * The full ring for the selected tile: structural actions (above) plus
   * the universal, structure-independent actions available on any owned
   * tile — Collect, Garrison (a form, not a discrete choice — quantities
   * aren't a fixed list), and Demolish. These were originally scoped to stay
   * in the tile info card, but the card is being retired in favor of the
   * ring covering everything; folding them in here as its own layer keeps
   * structuralActionsFor's tile-type branching (already mirrored 1:1 against
   * TilePopup) untouched.
   */
  function ringActionsFor(): RingAction[] {
    if (!selected) return [];
    const actions = structuralActionsFor();

    // Unlike Collect/Garrison/Demolish below, Info isn't owned-tile-only — a
    // tombstone can sit on unowned ground, so this is pushed before the
    // isOwned gate rather than after it.
    const info = infoDialogContent();
    if (info) {
      actions.push({ key: "info", icon: <Info size={18} />, title: "Info", dialogContent: info });
    }

    if (!isOwned(selected)) return actions;

    if (selectedTile && !selectedTile.damaged && selectedTile.stockpile > 0) {
      actions.push({
        key: "collect",
        icon: <PackageCheck size={18} />,
        title: `Collect (${Math.floor(selectedTile.stockpile)})`,
        onClick: handleCollect,
      });
    }
    if (selectedDock && !selectedDock.buildStartedAt && selectedDock.stockpile > 0) {
      actions.push({
        key: "collect-dock",
        icon: <PackageCheck size={18} />,
        title: `Collect (${Math.floor(selectedDock.stockpile)})`,
        onClick: handleCollectDock,
      });
    }

    const canGarrisonHere =
      !!selectedGarrison ||
      availableMilitia(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults) > 0 ||
      availableJunkyardKnights(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults) > 0 ||
      availableCrossBowSnipers(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults) > 0;
    if (canGarrisonHere) {
      actions.push({ key: "garrison", icon: <Users size={18} />, title: "Garrison", formContent: garrisonFormContent() });
    }

    const canDemolishHere = !selectedIsBase && (!!selectedStructure || !!selectedDock);
    if (canDemolishHere) {
      actions.push({ key: "demolish", icon: <Trash2 size={18} />, title: "Demolish", onClick: handleDemolish });
    }

    return actions;
  }
  const ringActions = ringActionsFor();
  // Suppressed on the currently-selected tile — its ring (and Info hex,
  // where applicable) already covers the same ground, and the two floating
  // panels would otherwise visually collide right where the player's about
  // to click.
  const hoverInfoContent =
    hoveredCoord && !(selected && axialEquals(hoveredCoord, selected)) ? hoverInfoFor(hoveredCoord) : null;

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
              icon={resourceIcon(type, 18)}
              value={Math.floor(resources[type]).toLocaleString()}
              delta={resourceRates[type]}
              title={type}
            />
          ))}
          <StatChip icon={noiseIcon(18)} value={`${Math.floor(noise.value)}db`} title="noise" />
        </div>
      </header>
      {actionError && (
        <div
          onClick={() => setActionError(null)}
          style={{
            position: "fixed",
            top: "3.5rem",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 60,
            background: "rgba(20, 20, 22, 0.92)",
            color: "#ff8080",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            fontSize: "0.85rem",
            cursor: "pointer",
          }}
        >
          {actionError}
        </div>
      )}
      <div style={{ flex: "1 1 auto", minHeight: 0 }}>
        <HexCanvas
          ref={hexCanvasRef}
          seed={world.seed}
          gridSize={tweaks.game.grid_size}
          tweaks={tweaks}
          base={territory.base}
          baseLevel={base.level}
          baseCurrentHp={base.currentHp}
          baseMaxHp={baseReinforcementHp(tweaks, base.reinforcementLevel)}
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
          onTileHover={handleTileHover}
          onViewportChange={handleViewportChange}
        />
      </div>
      <HoverTooltip ref={hoverTooltipRef} coord={hoveredCoord} content={hoverInfoContent} />
      {selected && ringActions.length > 0 && (
        <TileActionRing key={axialKey(selected)} ref={ringRef} rootCoord={selected} actions={ringActions} />
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
            icon: <FlaskConical size={20} />,
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
          siegedDens={dens
            .filter((d) => d.siege)
            .map((d) => ({
              coord: d.coord,
              holdRemainingMs: remainingMs(d.siege!.startedAt, tweaks.dens.siege.hold_duration_minutes * 60_000, now),
            }))}
          countdowns={activeCountdownRows()}
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
