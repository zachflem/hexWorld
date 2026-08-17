import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { axialDistance, axialEquals, axialKey, type Axial } from "../engine/hexCoords";
import { isBuildableLand, isTransitionTile, terrainAt } from "../engine/terrain";
import {
  nextScrapYardLevel,
  scrapYardBuildCost,
  scrapYardBuildDurationMs,
  scrapYardUpgradeCost,
  scrapYardUpgradeDurationMs,
} from "../engine/scrapYards";
import { scrapYardYieldPerSecond } from "../engine/scrappers";
import {
  dockBuildCost,
  dockBuildDurationMs,
  dockLevel,
  dockUpgradeCost,
  dockUpgradeDurationMs,
  dockYieldPerSecond,
  nextDockLevel,
} from "../engine/docks";
import {
  buildSlotCap,
  isStructureActive,
  repairCost,
  scaledCostMap,
  structureRepairDurationMs,
  totalStructureCount,
} from "../engine/formulas";
import { yieldPerSecond } from "../engine/tick";
import {
  extractionTierDisplayLabel,
  extractionTierLevel,
  extractionTileBuildDurationMs,
  nextTier,
  tierUpgradeCost,
  tierUpgradeDurationMs,
} from "../engine/tiers";
import { structureHasCourierAutomation } from "../engine/couriers";
import { storageCapacity, storageUpgradeCost, storageUpgradeDurationMs } from "../engine/storage";
import { collectPinVisible } from "../render/stockpileState";
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
  computePowerNetwork,
  consumerDraw,
  nextPowerStationLevel,
  powerStateLabel,
  powerStationAoeRadius,
  powerStationBuildCost,
  powerStationBuildDurationMs,
  powerStationCapacity,
  powerStationUpgradeCost,
  powerStationUpgradeDurationMs,
  structurePowerState,
  type PowerConsumerKind,
} from "../engine/power";
import {
  maxWallDurability,
  nextWallTier,
  WALL_TIER_LEVEL,
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
  barracksUpgradeCost,
  barracksUpgradeDurationMs,
  crossBowSniperCapacity as crossBowSniperCapacityFor,
  junkyardKnightCapacity as junkyardKnightCapacityFor,
  militiaCapacity as militiaCapacityFor,
  nextBarracksLevel,
  trainingUnitDurationMs,
  trainingUnitLabel,
} from "../engine/barracks";
import {
  crossBowSniperTrainCost,
  junkyardKnightTrainCost,
  militiaTrainCost,
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
import {
  countDockTasks,
  hasAnyStructureTask,
  isBarracksAtTaskCap,
  isBaseHubAtTaskCap,
  isDockAtTaskCap,
  isHordeRepairBlocked,
  isLandStructureAtTaskCap,
  isOutpostReinforcementBusy,
  isWallAtTaskCap,
} from "../engine/structureBusy";
import { remainingMs } from "../engine/timers";
import {
  extractionFloorContribution,
  noiseCap,
  powerStationFloorContribution,
  scrapYardFloorContribution,
  towerFloorContribution,
  wallFloorContribution,
} from "../engine/noiseMeter";
import { computeResourceRates } from "../engine/resourceRates";
import { canRepairHordeDamagedTile } from "../engine/territory";
import {
  assaultProvisionsCost,
  expeditionProvisionsCost,
  expeditionTravelDurationMs,
  findBestExpeditionRoute,
  partyAttackPower,
  pathHordeWipeRisk,
  reinforceProvisionsCost,
  reinforceTravelDurationMs,
} from "../engine/expeditions";
import { hasStartableResearch, troopSpeedMultiplier, researchDurationMs } from "../engine/research";
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
import {
  availableCrossBowSnipers,
  availableJunkyardKnights,
  availableMilitia,
  garrisonAt,
  isHordeReachableFromGarrison,
} from "../engine/garrisons";
import type { Player } from "../data/player";
import { RESOURCE_ORDER, type ResourceAmounts, type ResourceType } from "../data/resources";
import { assetUrlCandidates, resolveAssetPath } from "../render/assetPaths";
import {
  dockSpriteCandidates,
  extractionTierCandidates,
  scrapYardSpriteCandidates,
  structureAssetUrlCandidates,
  structureLevelCandidates,
} from "../render/structureSprites";
import type { TerritoryRecord } from "../data/territory";
import type { BaseRecord } from "../data/base";
import type { ExtractionTile } from "../data/extractionTiles";
import type { PowerStation } from "../data/powerStations";
import type { ScrapYardRecord, ScrapYardsRecord } from "../data/scrapYards";
import type { Tower } from "../data/towers";
import type { Wall } from "../data/walls";
import type { Barracks, TrainingUnitType } from "../data/barracks";
import type { UnitsRecord } from "../data/units";
import type { GarrisonsRecord } from "../data/garrisons";
import type { ScoutedTiles } from "../data/scoutedTiles";
import type { StorageLevels } from "../data/storageLevels";
import type { StorageUpgradesRecord } from "../data/storageUpgrades";
import type { NoiseRecord } from "../data/noise";
import type { DenRecord, DensRecord } from "../data/dens";
import type { ScrapStashRecord, ScrapStashesRecord } from "../data/scrapStashes";
import { isActiveScrapStash } from "../data/scrapStashes";
import {
  formatRemainingResource,
  hexTileLevel,
  remainingResourceAt,
  type HexResourcePoolsRecord,
} from "../data/hexResourcePools";
import type { DenAssaultsRecord } from "../data/denAssaults";
import type { TombstoneRecord, TombstonesRecord } from "../data/tombstones";
import type { LabRecord } from "../data/lab";
import type { LabAssaultsRecord } from "../data/labAssaults";
import type { GarrisonRecallsRecord } from "../data/garrisonRecalls";
import type { OutpostRecord, OutpostsRecord } from "../data/outposts";
import type { HordesRecord } from "../data/hordes";
import type { Expedition, ExpeditionsRecord } from "../data/expeditions";
import type { DockRecord, DocksRecord } from "../data/docks";
import type { ScoutSkiffsRecord } from "../data/scoutSkiffs";
import type { WanderingScoutsRecord } from "../data/wanderingScouts";
import type { Tweaks } from "../data/tweaksSchema";
import { resolveWorldGridSize } from "../data/mapSize";
import { generateSeed, type WorldRecord } from "../data/world";
import type { BuildResult } from "../App";
import {
  BASE_HEX_SIZE,
  HexCanvas,
  UPGRADE_AVAILABLE_BADGE_COLOR,
  WALL_TIER_ICON_NAMES,
  type HexCanvasHandle,
} from "../render/HexCanvas";
import {
  type BarracksUpgradeOption,
  type BaseUpgradeOption,
  type BuildOption,
  type DenAssaultOption,
  type ExpeditionOption,
  type LabAssaultOption,
  type PowerStationUpgradeOption,
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
import { NotificationTray, type NotificationCountdownRow } from "./hud/NotificationTray";
import { structureProgressByKey } from "./structureProgress";
import { NOTIFICATION_ICON_SIZE } from "./hud/CollapsibleNotificationRow";
import { RESEARCH_LABEL } from "./researchLabels";
import { ResourceHud } from "./hud/ResourceHud";
import { LabAssaultCeremony } from "./hud/LabAssaultCeremony";
import { MapControls } from "./hud/MapControls";
import { ToastStack, type ToastRecord } from "./hud/Toast";
import { Panel } from "./primitives/Panel";
import { StatRow } from "./primitives/StatRow";
import { PartyDispatchForm } from "./primitives/PartyDispatchForm";
import { TrainForm } from "./primitives/TrainForm";
import { GarrisonForm } from "./primitives/GarrisonForm";
import { GlobalHexCluster } from "./menu/GlobalHexCluster";
import { TileActionSheet, type SheetAction, type SheetQuickAction } from "./menu/TileActionSheet";
import { HoverTooltip, type HoverTooltipHandle } from "./menu/HoverTooltip";
import { CollectPinOverlay, type CollectPinOverlayHandle } from "./menu/CollectPinOverlay";
import {
  PowerStatusPinOverlay,
  type PowerPinStatus,
  type PowerStatusPin,
  type PowerStatusPinOverlayHandle,
} from "./menu/PowerStatusPinOverlay";
import { CostDetail, formatDuration } from "./format";
import { GarrisonsPanel } from "./panels/GarrisonsPanel";
import { IntelligencePanel } from "./panels/IntelligencePanel";
import { PersonnelPanel } from "./panels/PersonnelPanel";
import { DevToolsPanel, type DevLabMode } from "./panels/DevToolsPanel";
import { labSearchZoneCenter } from "../engine/lab";
import { SettingsPanel } from "./panels/SettingsPanel";
import { useConfirm } from "./primitives/ConfirmProvider";
import {
  Anchor,
  Archive,
  ArrowUpCircle,
  Binoculars,
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
  Undo2,
  Wrench,
  Zap,
} from "lucide-react";

type OpenPanel = "garrisons" | "intelligence" | "personnel" | "settings" | "research" | "dev";

/**
 * Reuses the same painted sprites HexCanvas draws on the map — ring-hex actions
 * show the real structure icon. Tries name candidates in order (levelled →
 * unlevelled) across the profile→default URL chain (Milestone 24 / #P13).
 */
function StructureIcon({
  names,
  size = 45,
  fallback = null,
}: {
  names: string | string[];
  size?: number;
  fallback?: ReactNode;
}) {
  const nameList = Array.isArray(names) ? names : [names];
  const candidateKey = nameList.join("|");
  const candidates = structureAssetUrlCandidates(nameList, assetUrlCandidates);
  const [index, setIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setIndex(0);
    setExhausted(false);
  }, [candidateKey]);

  if (exhausted || candidates.length === 0) return <>{fallback}</>;
  const src = candidates[index];
  if (!src) return <>{fallback}</>;

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt=""
      style={{ objectFit: "contain" }}
      onError={() => {
        if (index + 1 < candidates.length) setIndex(index + 1);
        else setExhausted(true);
      }}
    />
  );
}

function structureIcon(names: string | string[], size = 45, fallback?: ReactNode) {
  return <StructureIcon names={names} size={size} fallback={fallback} />;
}
/** Small hand-drawn marker icons (profiles/default/assets/markers/) instead of the full-size in-world resource sprites — those read fine painted on the map itself but turn into an indistinct blob at ring-hex/HUD-chip size. */
function resourceIcon(resource: ResourceType, size = 45) {
  return (
    <img
      src={resolveAssetPath("markers", `icon-${resource}.png`)}
      width={size}
      height={size}
      alt=""
      style={{ objectFit: "contain" }}
    />
  );
}
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Power stations ship small/mid/large art (public/profiles assets/structures) rather than per-level sprites like tower/barracks — bucket the 1-4 level range onto those three stems. */
function powerStationTierIconName(level: number): string {
  if (level <= 1) return "power-small";
  if (level === 2) return "power-mid";
  return "power-large";
}

/** Walls use fractional slot_cost — show one decimal when needed. */
function formatBuildSlots(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Banded richness copy for stash intel (Q51/Q52) — no exact tile level shown. */
function scrapRichnessHint(tileLevel: number, maxLevel: number): string {
  const t = maxLevel <= 1 ? 1 : tileLevel / maxLevel;
  if (t >= 0.8) return "This scrap heap looks rich.";
  if (t >= 0.5) return "A decent pile of salvage.";
  return "A sparse scrap dump.";
}

/** The hover tooltip's card — icon + type name, a status line, then whatever stat rows apply to this structure kind. Deliberately terser than the sheet Info tab (smaller font/padding) since this follows the cursor rather than sitting in a fixed dialog slot. */
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
  towers,
  walls,
  barracksList,
  powerStations,
  scrapYards,
  units,
  garrisons,
  scoutedTiles,
  storageLevels,
  storageUpgrades,
  noise,
  dens,
  scrapStashes,
  hexResourcePools,
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
  onSetSpeedMultiplier,
  onDismissToast,
  onStartResearch,
  onBuildExtractionTile,
  onUpgradeExtractionTile,
  onUpgradeStorage,
  onCollectTile,
  onBuildTower,
  onUpgradeTower,
  onBuildPowerStation,
  onUpgradePowerStation,
  onBuildScrapYard,
  onUpgradeScrapYard,
  onCollectScrapYard,
  onAssignScrapperStash,
  onRecallScrapper,
  onBuildWall,
  onUpgradeWall,
  onRepairWall,
  onRepairStructure,
  onDemolish,
  onBuildBarracks,
  onUpgradeBarracks,
  onTrainMilitia,
  onTrainJunkyardKnight,
  onTrainCrossBowSniper,
  onRushTrainMilitia,
  onRushActiveTraining,
  onUpgradeBase,
  onUpgradeReinforcement,
  onRepairBase,
  onUpgradeOutpostReinforcement,
  onRepairOutpost,
  onRelocateBase,
  onDispatchExpedition,
  onRecallExpedition,
  onGarrisonExpedition,
  onRedeployExpedition,
  onReinforceExpedition,
  onAssaultDen,
  onSecureLab,
  onRecallDenAssault,
  onRecallLabAssault,
  onGarrisonUnits,
  onRecallMilitia,
  onBuildDock,
  onUpgradeDock,
  onBuildScoutSkiff,
  onCollectDock,
  onBuildWanderingScout,
  onReplayCurrent,
  onStartNewSeed,
  onNewPlayer,
  onSaveToFile,
  onLoadFromFile,
}: {
  tweaks: Tweaks;
  player: Player;
  world: WorldRecord;
  territory: TerritoryRecord;
  base: BaseRecord;
  resources: ResourceAmounts;
  extractionTiles: ExtractionTile[];
  towers: Tower[];
  walls: Wall[];
  barracksList: Barracks[];
  powerStations: PowerStation[];
  scrapYards: ScrapYardsRecord;
  units: UnitsRecord;
  garrisons: GarrisonsRecord;
  scoutedTiles: ScoutedTiles;
  storageLevels: StorageLevels;
  storageUpgrades: StorageUpgradesRecord;
  noise: NoiseRecord;
  dens: DensRecord;
  scrapStashes: ScrapStashesRecord;
  hexResourcePools: HexResourcePoolsRecord;
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
  /** Dev tools — set an explicit speed rate (1x / 10x toggle). */
  onSetSpeedMultiplier: (rate: number) => void;
  onDismissToast: (id: string) => void;
  onStartResearch: (id: ResearchId) => Promise<BuildResult>;
  onBuildExtractionTile: (coord: Axial, resource: ResourceType) => Promise<BuildResult>;
  onUpgradeExtractionTile: (coord: Axial) => Promise<BuildResult>;
  onUpgradeStorage: (resource: ResourceType) => Promise<BuildResult>;
  onCollectTile: (coord: Axial) => Promise<BuildResult>;
  onBuildTower: (coord: Axial) => Promise<BuildResult>;
  onUpgradeTower: (coord: Axial) => Promise<BuildResult>;
  onBuildPowerStation: (coord: Axial) => Promise<BuildResult>;
  onUpgradePowerStation: (coord: Axial) => Promise<BuildResult>;
  onBuildScrapYard: (coord: Axial) => Promise<BuildResult>;
  onUpgradeScrapYard: (coord: Axial) => Promise<BuildResult>;
  onCollectScrapYard: (coord: Axial) => Promise<BuildResult>;
  onAssignScrapperStash: (yardCoord: Axial, stashId: string) => Promise<BuildResult>;
  onRecallScrapper: (yardCoord: Axial) => Promise<BuildResult>;
  onBuildWall: (coord: Axial) => Promise<BuildResult>;
  onUpgradeWall: (coord: Axial) => Promise<BuildResult>;
  onRepairWall: (coord: Axial) => Promise<BuildResult>;
  onRepairStructure: (coord: Axial) => Promise<BuildResult>;
  onDemolish: (coord: Axial) => Promise<BuildResult>;
  onBuildBarracks: (coord: Axial) => Promise<BuildResult>;
  onUpgradeBarracks: (coord: Axial) => Promise<BuildResult>;
  onTrainMilitia: (coord: Axial, quantity: number) => Promise<BuildResult>;
  onTrainJunkyardKnight: (coord: Axial, quantity: number) => Promise<BuildResult>;
  onTrainCrossBowSniper: (coord: Axial, quantity: number) => Promise<BuildResult>;
  onRushTrainMilitia: (coord: Axial, quantity: number) => Promise<BuildResult>;
  onRushActiveTraining: (coord: Axial) => Promise<BuildResult>;
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
  onRecallExpedition: (expeditionId: string) => Promise<BuildResult>;
  onGarrisonExpedition: (expeditionId: string) => Promise<BuildResult>;
  onRedeployExpedition: (expeditionId: string, target: Axial) => Promise<BuildResult>;
  onReinforceExpedition: (
    expeditionId: string,
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
  onRecallDenAssault: (assaultId: string) => Promise<BuildResult>;
  onRecallLabAssault: (assaultId: string) => Promise<BuildResult>;
  onGarrisonUnits: (
    coord: Axial,
    militiaCount: number,
    junkyardKnightCount: number,
    crossBowSniperCount: number,
  ) => Promise<BuildResult>;
  onRecallMilitia: (coord: Axial) => Promise<BuildResult>;
  onBuildDock: (coord: Axial) => Promise<BuildResult>;
  onUpgradeDock: (coord: Axial) => Promise<BuildResult>;
  onBuildScoutSkiff: (coord: Axial) => Promise<BuildResult>;
  onCollectDock: (coord: Axial) => Promise<BuildResult>;
  onBuildWanderingScout: (coord: Axial) => Promise<BuildResult>;
  /** Settings / New Game (App.tsx) — same player, same map, progress reset. */
  onReplayCurrent: () => void;
  /** Settings / New Game (App.tsx) — same player, a chosen (or freshly-generated) map. */
  onStartNewSeed: (seed: number) => void;
  /** Settings / New Game (App.tsx) — drops back to onboarding. */
  onNewPlayer: () => void;
  /** Settings — download current session as JSON. */
  onSaveToFile: () => void;
  /** Settings — replace session from a JSON save file. */
  onLoadFromFile: () => void;
}) {
  const confirm = useConfirm();
  const hexCanvasRef = useRef<HexCanvasHandle>(null);
  const gridSize = resolveWorldGridSize(world, tweaks);
  /** Same imperative-positioning convention as TileActionSheet's predecessor used — see HoverTooltip.tsx. */
  const hoverTooltipRef = useRef<HoverTooltipHandle>(null);
  const collectPinOverlayRef = useRef<CollectPinOverlayHandle>(null);
  const powerStatusPinOverlayRef = useRef<PowerStatusPinOverlayHandle>(null);
  const [selected, setSelected] = useState<Axial | null>(null);
  /** When set, next eligible tile selection redeploys this awaiting/marching expedition. */
  const [redeployExpeditionId, setRedeployExpeditionId] = useState<string | null>(null);
  /** Desktop-mouse hover target (HexCanvas's onTileHover) — null on touch devices, which never report hover. Only changes when the hovered tile itself changes (deduped in HexCanvas), not on every mousemove pixel. */
  const [hoveredCoord, setHoveredCoord] = useState<Axial | null>(null);
  /** Which of the global hex cluster's panel slots is open, if any. Only one at a time. Dismissed via BottomSheet Close/backdrop. */
  const [openPanel, setOpenPanel] = useState<OpenPanel | null>(null);
  /** Hammer slot parked (UI commented out) — leave false; re-add setter when re-enabling Build mode. */
  const [buildModeActive] = useState(false);
  /** Dev-server-only — reveals the whole map through fog of war. Session-local; never persisted. */
  const [fogDisabled, setFogDisabled] = useState(false);
  /** Dev-server-only — Off | final-clue search hint | exact lab reveal. */
  const [devLabMode, setDevLabMode] = useState<DevLabMode>("off");
  const mapRevealed = fogDisabled || devLabMode === "reveal";
  /** Scaled ResourceHud height — when the bar shrinks (narrow viewport), notifications sit below it so they don't cover the noise chip. */
  const [resourceHudLayout, setResourceHudLayout] = useState({ height: 0, scale: 1 });
  const handleResourceHudLayout = useCallback((metrics: { height: number; scale: number }) => {
    setResourceHudLayout(metrics);
  }, []);
  /** Lab-assault ceremony banner height — resource HUD + tray sit below it. */
  const [labAssaultBannerHeight, setLabAssaultBannerHeight] = useState(0);
  const handleLabAssaultBannerHeight = useCallback((height: number) => {
    setLabAssaultBannerHeight(height);
  }, []);

  /** Open a global cluster panel (or toggle the same slot closed). Clears any tile sheet so only one BottomSheet is up. */
  function toggleOpenPanel(panel: OpenPanel) {
    setSelected(null);
    setOpenPanel((p) => (p === panel ? null : panel));
  }

  function handleDevToggleFog() {
    if (mapRevealed) {
      setFogDisabled(false);
      setDevLabMode("off");
    } else {
      setFogDisabled(true);
    }
  }

  function handleDevCycleLabMode() {
    setDevLabMode((mode) => {
      const next: DevLabMode = mode === "off" ? "hint" : mode === "hint" ? "reveal" : "off";
      if (next === "hint") {
        const center = labSearchZoneCenter(
          world.seed,
          lab.coord,
          tweaks.lab_clues.final_search_area_radius_tiles,
          gridSize,
        );
        hexCanvasRef.current?.centerOnCoord(center);
      } else if (next === "reveal") {
        hexCanvasRef.current?.centerOnCoord(lab.coord);
      }
      return next;
    });
  }

  function handleDevToggleSpeed10x() {
    onSetSpeedMultiplier(speedMultiplier === 10 ? 1 : 10);
  }

  function handleDevRerollSeed() {
    setOpenPanel(null);
    onStartNewSeed(generateSeed());
  }
  const [actionError, setActionError] = useState<string | null>(null);
  const [militiaToSend, setMilitiaToSend] = useState(1);
  const [junkyardKnightToSend, setJunkyardKnightToSend] = useState(0);
  const [crossBowSniperToSend, setCrossBowSniperToSend] = useState(0);
  const [militiaToTrain, setMilitiaToTrain] = useState(1);
  const [junkyardKnightToTrain, setJunkyardKnightToTrain] = useState(1);
  const [crossBowSniperToTrain, setCrossBowSniperToTrain] = useState(1);
  const [militiaToGarrison, setMilitiaToGarrison] = useState(1);
  const [junkyardKnightToGarrison, setJunkyardKnightToGarrison] = useState(0);
  const [crossBowSniperToGarrison, setCrossBowSniperToGarrison] = useState(0);

  const ownedKeys = useMemo(() => new Set(territory.owned.map(axialKey)), [territory.owned]);
  const isOwned = (coord: Axial) => ownedKeys.has(axialKey(coord));

  const scoutedKeys = useMemo(() => new Set(scoutedTiles.map(axialKey)), [scoutedTiles]);
  const isScouted = (coord: Axial) => scoutedKeys.has(axialKey(coord));

  const baseHubAtTaskCap = isBaseHubAtTaskCap(base, storageUpgrades, research);

  const tileAt = (coord: Axial): ExtractionTile | null =>
    extractionTiles.find((tile) => axialKey(tile.coord) === axialKey(coord)) ?? null;

  const towerAt = (coord: Axial): Tower | null =>
    towers.find((t) => axialKey(t.coord) === axialKey(coord)) ?? null;

  const powerStationAt = (coord: Axial): PowerStation | null =>
    powerStations.find((s) => axialKey(s.coord) === axialKey(coord)) ?? null;

  const scrapYardAt = (coord: Axial): ScrapYardRecord | null =>
    scrapYards.find((s) => axialKey(s.coord) === axialKey(coord)) ?? null;

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

  /** Sheet-row cost line — lacking resources render red via CostDetail. */
  function costDetail(
    cost: Partial<Record<ResourceType, number>>,
    suffix?: string,
    prefix?: string,
  ): ReactNode {
    return <CostDetail cost={cost} resources={resources} prefix={prefix} suffix={suffix} />;
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
    return RESOURCE_ORDER.filter((resource) => resource !== "steel").map((resource) => {
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
    if (tile.damaged || isLandStructureAtTaskCap(tile, research)) return null;
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
      const targetLevel = level + 1;
      const pending = storageUpgrades[resource];
      const inProgress = pending
        ? {
            targetLevel: pending.targetLevel,
            remainingMs: remainingMs(pending.startedAt, storageUpgradeDurationMs(tweaks, pending.targetLevel), now),
          }
        : null;
      return {
        resource,
        level,
        capacity: storageCapacity(tweaks, level),
        cost,
        affordable: affordable(cost),
        durationMinutes: storageUpgradeDurationMs(tweaks, targetLevel) / 60_000,
        inProgress,
      };
    });
  }

  function towerBuildOptionFor(): RepairOption {
    const cost = towerBuildCost(tweaks, towers.length + 1);
    return { cost, affordable: affordable(cost), durationMinutes: towerBuildDurationMs(tweaks) / 60_000 };
  }

  function towerUpgradeOptionFor(t: Tower): TowerUpgradeOption | null {
    if (t.damaged || isLandStructureAtTaskCap(t, research)) return null;
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

  function powerStationBuildOptionFor(): RepairOption {
    const cost = powerStationBuildCost(tweaks, powerStations.length + 1);
    return { cost, affordable: affordable(cost), durationMinutes: powerStationBuildDurationMs(tweaks) / 60_000 };
  }

  function powerStationUpgradeOptionFor(s: PowerStation): PowerStationUpgradeOption | null {
    if (s.damaged || isLandStructureAtTaskCap(s, research)) return null;
    const targetLevel = nextPowerStationLevel(s.level);
    if (!targetLevel) return null;
    const cost = powerStationUpgradeCost(tweaks, targetLevel);
    return {
      targetLevel,
      cost,
      affordable: affordable(cost),
      durationMinutes: powerStationUpgradeDurationMs(tweaks, targetLevel) / 60_000,
    };
  }

  function scrapYardBuildOptionFor(): RepairOption {
    const cost = scrapYardBuildCost(tweaks, scrapYards.length + 1);
    return { cost, affordable: affordable(cost), durationMinutes: scrapYardBuildDurationMs(tweaks) / 60_000 };
  }

  function scrapYardUpgradeOptionFor(y: ScrapYardRecord): PowerStationUpgradeOption | null {
    if (y.damaged || isLandStructureAtTaskCap(y, research)) return null;
    const targetLevel = nextScrapYardLevel(y.level);
    if (!targetLevel) return null;
    const cost = scrapYardUpgradeCost(tweaks, targetLevel as 2 | 3);
    return {
      targetLevel,
      cost,
      affordable: affordable(cost),
      durationMinutes: scrapYardUpgradeDurationMs(tweaks, targetLevel as 2 | 3) / 60_000,
    };
  }

  function wallBuildOptionFor(): RepairOption {
    const cost = wallBuildCost(tweaks, walls.length + 1);
    return { cost, affordable: affordable(cost), durationMinutes: wallBuildDurationMs(tweaks) / 60_000 };
  }

  function wallUpgradeOptionFor(w: Wall): WallUpgradeOption | null {
    if (w.damaged || isWallAtTaskCap(w, research)) return null;
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
    if (w.damaged || isWallAtTaskCap(w, research)) return null;
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

  /** Null at max level or while the dock hub is busy. */
  function dockUpgradeOptionFor(d: DockRecord): {
    targetLevel: 2 | 3;
    cost: Partial<Record<ResourceType, number>>;
    affordable: boolean;
    durationMinutes: number;
  } | null {
    if (d.buildStartedAt != null || isDockAtTaskCap(d, research)) return null;
    const target = nextDockLevel(dockLevel(d));
    if (target !== 2 && target !== 3) return null;
    const cost = dockUpgradeCost(tweaks, target);
    return {
      targetLevel: target,
      cost,
      affordable: affordable(cost),
      durationMinutes: dockUpgradeDurationMs(tweaks, target) / 60_000,
    };
  }

  /** Null once this dock already has as many skiffs (built or under construction) as tweaks.docks.scout_skiff.max_per_dock allows. */
  function scoutSkiffOptionFor(d: DockRecord): SkiffBuildOption | null {
    if (isDockAtTaskCap(d, research)) return null;
    const existing = scoutSkiffs.filter((s) => axialKey(s.homeDockCoord) === axialKey(d.coord)).length;
    if (existing >= tweaks.docks.scout_skiff.max_per_dock) return null;
    const cost = tweaks.docks.scout_skiff.cost;
    return { cost, affordable: affordable(cost), durationMinutes: tweaks.docks.scout_skiff.build_time_minutes };
  }

  /** Non-null while this dock's newest scout skiff is still under construction. */

  /** Null once this barracks already has as many wandering scouts (built or under construction) as allowed. */
  function wanderingScoutOptionFor(b: Barracks): WanderingScoutOption | null {
    if (isBarracksAtTaskCap(b, research)) return null;
    const existing = wanderingScouts.filter((s) => axialKey(s.homeBarracksCoord) === axialKey(b.coord)).length;
    if (existing >= tweaks.units.wandering_scout.max_per_barracks) return null;
    const cost = tweaks.units.wandering_scout.cost;
    return {
      cost,
      affordable: affordable(cost),
      durationMinutes: tweaks.units.wandering_scout.build_time_minutes,
    };
  }

  /** Non-null while this barracks's newest wandering scout is still under construction. */

  function barracksUpgradeOptionFor(b: Barracks): BarracksUpgradeOption | null {
    if (b.damaged || isBarracksAtTaskCap(b, research)) return null;
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

  function baseUpgradeOptionFor(): BaseUpgradeOption | null {
    if (base.action) return null;
    if (baseHubAtTaskCap) return null;
    const targetLevel = base.level + 1;
    const cost = baseUpgradeCost(tweaks, targetLevel);
    return { targetLevel, cost, affordable: affordable(cost), durationMs: baseUpgradeDurationMs(tweaks, targetLevel) };
  }

  /** Timed like every other upgrade (engine/base.ts:baseReinforcementUpgradeDurationMs). Null while the base hub is busy. */
  function reinforcementUpgradeOptionFor(): ReinforcementUpgradeOption | null {
    if (base.action) return null;
    if (baseHubAtTaskCap) return null;
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

  /** Null once base.currentHp is already at max — nothing to repair — or while the base hub is busy. */
  function baseRepairOptionFor(): RepairOption | null {
    if (base.action) return null;
    if (baseHubAtTaskCap) return null;
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
    if (isOutpostReinforcementBusy(outpost)) return null;
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
    if (isOutpostReinforcementBusy(outpost)) return null;
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
      gridSize,
      coord,
    );
    if (!route) return null;
    const partySize = militiaToSend + junkyardKnightToSend + crossBowSniperToSend;
    const provisionsCost: Partial<Record<ResourceType, number>> = {
      food: expeditionProvisionsCost(tweaks, partySize, route.cost),
    };
    const attackPower = partyAttackPower(tweaks, militiaToSend, junkyardKnightToSend, crossBowSniperToSend);
    const hordeSizeByKey = new Map(hordes.map((h) => [axialKey(h.path[h.pathIndex]), h.size]));
    const wipeRisk = pathHordeWipeRisk(route.path, attackPower, hordeSizeByKey);
    return {
      distanceTiles: route.path.length - 1,
      pathCost: route.cost,
      provisionsCost,
      affordable: affordable(provisionsCost),
      etaMs: expeditionTravelDurationMs(tweaks, route.cost, troopSpeedMultiplier(tweaks, research)),
      attackPower,
      wipeRisk,
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
      gridSize,
      den.coord,
    );
    if (!route) return null;
    const partySize = militiaToSend + junkyardKnightToSend + crossBowSniperToSend;
    const provisionsCost: Partial<Record<ResourceType, number>> = {
      food: assaultProvisionsCost(tweaks, partySize, route.cost),
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
      gridSize,
      lab.coord,
    );
    if (!route) return null;
    const partySize = militiaToSend + junkyardKnightToSend + crossBowSniperToSend;
    const provisionsCost: Partial<Record<ResourceType, number>> = {
      food: assaultProvisionsCost(tweaks, partySize, route.cost),
    };
    return {
      distanceTiles: route.path.length - 1,
      pathCost: route.cost,
      provisionsCost,
      affordable: affordable(provisionsCost),
      etaMs: expeditionTravelDurationMs(tweaks, route.cost, troopSpeedMultiplier(tweaks, research)),
      guardianDefense: lab.guardianDefense,
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
    if (!canRelocateBase(tweaks, base.level) || baseHubAtTaskCap) return null;
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

  /** Surfaces failures; on success collapses the tile action sheet so the map is visible again. */
  function applyActionResult(result: BuildResult, options?: { keepSelection?: boolean }) {
    setActionError(result.ok ? null : result.reason);
    if (result.ok && !options?.keepSelection) setSelected(null);
  }

  async function handleRelocateBase() {
    if (!selected) return;
    const result = await onRelocateBase(selected);
    applyActionResult(result);
  }

  function goToTile(coord: Axial) {
    setOpenPanel(null);
    setActionError(null);
    setSelected(coord);
    requestAnimationFrame(() => {
      hexCanvasRef.current?.centerOnCoord(coord);
    });
    setMilitiaToSend(1);
    setMilitiaToTrain(1);
    setMilitiaToGarrison(1);
    setJunkyardKnightToGarrison(0);
    setCrossBowSniperToGarrison(0);
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
    // Tile sheet and global cluster panels share BottomSheet — never stack them.
    setOpenPanel(null);
    setActionError(null);

    if (redeployExpeditionId) {
      void (async () => {
        const result = await onRedeployExpedition(redeployExpeditionId, coord);
        setRedeployExpeditionId(null);
        applyActionResult(result);
      })();
      return;
    }

    setSelected(coord);
    setMilitiaToSend(1);
    setMilitiaToTrain(1);
    setMilitiaToGarrison(1);
    setJunkyardKnightToGarrison(0);
    setCrossBowSniperToGarrison(0);
  }

  async function handleBuild(resource: ResourceType) {
    if (!selected) return;
    const result = await onBuildExtractionTile(selected, resource);
    applyActionResult(result);
  }

  async function handleUpgradeTier() {
    if (!selected) return;
    const result = await onUpgradeExtractionTile(selected);
    applyActionResult(result);
  }

  async function handleUpgradeStorage(resource: ResourceType) {
    const result = await onUpgradeStorage(resource);
    applyActionResult(result);
  }

  async function handleCollect() {
    if (!selected) return;
    const result = await onCollectTile(selected);
    applyActionResult(result);
  }

  async function handleQuickCollect(coord: Axial) {
    const result = scrapYardAt(coord)
      ? await onCollectScrapYard(coord)
      : dockAt(coord)
        ? await onCollectDock(coord)
        : await onCollectTile(coord);
    setActionError(result.ok ? null : result.reason);
  }

  async function handleBuildTower() {
    if (!selected) return;
    const result = await onBuildTower(selected);
    applyActionResult(result);
  }

  async function handleUpgradeTower() {
    if (!selected) return;
    const result = await onUpgradeTower(selected);
    applyActionResult(result);
  }

  async function handleBuildPowerStation() {
    if (!selected) return;
    const result = await onBuildPowerStation(selected);
    applyActionResult(result);
  }

  async function handleUpgradePowerStation() {
    if (!selected) return;
    const result = await onUpgradePowerStation(selected);
    applyActionResult(result);
  }

  async function handleBuildScrapYard() {
    if (!selected) return;
    const result = await onBuildScrapYard(selected);
    applyActionResult(result);
  }

  async function handleUpgradeScrapYard() {
    if (!selected) return;
    const result = await onUpgradeScrapYard(selected);
    applyActionResult(result);
  }

  async function handleCollectScrapYard() {
    if (!selected) return;
    const result = await onCollectScrapYard(selected);
    applyActionResult(result);
  }

  async function handleAssignScrapperStash(yardCoord: Axial, stashId: string) {
    const result = await onAssignScrapperStash(yardCoord, stashId);
    applyActionResult(result);
  }

  async function handleRecallScrapper() {
    if (!selected) return;
    const result = await onRecallScrapper(selected);
    applyActionResult(result);
  }

  async function handleSendScrapperFromStash() {
    if (!selected) return;
    const stash = scrapStashes.find((s) => isActiveScrapStash(tweaks, world.seed, hexResourcePools, s) && axialEquals(s.coord, selected));
    if (!stash) return;
    const idleYard = scrapYards.find((y) => {
      if (!y.scrapperReady || !isStructureActive(y)) return false;
      const trip = y.scrapper;
      return !trip || trip.phase === "idle";
    });
    if (!idleYard) {
      applyActionResult({ ok: false, reason: "No idle Scrapper ready" });
      return;
    }
    await handleAssignScrapperStash(idleYard.coord, stash.id);
  }

  function scrapperStatusText(yard: ScrapYardRecord): string {
    if (!yard.scrapperReady) return "Scrapper not ready yet";
    const trip = yard.scrapper;
    const stockpileCap = tweaks.storage.capacity_base_per_resource;
    if (
      trip &&
      trip.phase === "idle" &&
      trip.assignedStashId &&
      yard.stockpile >= stockpileCap
    ) {
      return "Scrapper paused — stockpile full";
    }
    if (!trip || trip.phase === "idle") return "Scrapper idle at yard";
    if (trip.phase === "toStash") return "Scrapper en route to stash";
    if (trip.cargo > 0) return `Scrapper returning with ${Math.floor(trip.cargo)} steel`;
    return "Scrapper returning to yard";
  }

  async function handleBuildWall() {
    if (!selected) return;
    const result = await onBuildWall(selected);
    applyActionResult(result);
  }

  async function handleUpgradeWall() {
    if (!selected) return;
    const result = await onUpgradeWall(selected);
    applyActionResult(result);
  }

  async function handleRepairWall() {
    if (!selected) return;
    const result = await onRepairWall(selected);
    applyActionResult(result);
  }

  async function handleDemolish() {
    if (!selected) return;
    const ok = await confirm({
      title: "Demolish structure?",
      message: "You'll only recover a fraction of what you spent on it.",
      confirmLabel: "Demolish",
    });
    if (!ok) return;
    const result = await onDemolish(selected);
    applyActionResult(result);
  }

  async function handleBuildBarracks() {
    if (!selected) return;
    const result = await onBuildBarracks(selected);
    applyActionResult(result);
  }

  async function handleUpgradeBarracks() {
    if (!selected) return;
    const result = await onUpgradeBarracks(selected);
    applyActionResult(result);
  }

  async function handleBuildDock() {
    if (!selected) return;
    const result = await onBuildDock(selected);
    applyActionResult(result);
  }

  async function handleUpgradeDockLevel() {
    if (!selected) return;
    const result = await onUpgradeDock(selected);
    applyActionResult(result);
  }

  async function handleBuildScoutSkiff() {
    if (!selected) return;
    const result = await onBuildScoutSkiff(selected);
    applyActionResult(result);
  }

  async function handleBuildWanderingScout() {
    if (!selected) return;
    const result = await onBuildWanderingScout(selected);
    applyActionResult(result);
  }

  async function handleCollectDock() {
    if (!selected) return;
    const result = await onCollectDock(selected);
    applyActionResult(result);
  }

  async function handleTrainMilitia(quantity = militiaToTrain) {
    if (!selected) return;
    const result = await onTrainMilitia(selected, quantity);
    applyActionResult(result, { keepSelection: true });
  }

  async function handleTrainJunkyardKnight(quantity = junkyardKnightToTrain) {
    if (!selected) return;
    const result = await onTrainJunkyardKnight(selected, quantity);
    applyActionResult(result, { keepSelection: true });
  }

  async function handleTrainCrossBowSniper(quantity = crossBowSniperToTrain) {
    if (!selected) return;
    const result = await onTrainCrossBowSniper(selected, quantity);
    applyActionResult(result, { keepSelection: true });
  }

  /**
   * Compact +1 / +5 / Max commits for the Train tab list. Quantities are
   * gated by maxQuantity (capacity ∩ affordability); a live queue disables
   * every shortcut so you open the row for status instead.
   */
  function trainQuickActions(
    option: TrainOption | SimpleTrainOption | null,
    queueStatus: TrainQueueStatus | null,
    otherTrainingBlocked: boolean,
    onTrainQuantity: (quantity: number) => void,
  ): SheetQuickAction[] {
    const maxQuantity = option?.maxQuantity ?? 0;
    const blocked = !!queueStatus || otherTrainingBlocked || maxQuantity <= 0;
    return [
      {
        label: "+1",
        disabled: blocked || maxQuantity < 1,
        onClick: () => onTrainQuantity(1),
      },
      {
        label: "+5",
        disabled: blocked || maxQuantity < 5,
        onClick: () => onTrainQuantity(5),
      },
      {
        label: "Max",
        disabled: blocked,
        onClick: () => onTrainQuantity(maxQuantity),
      },
    ];
  }

  function trainQueueDetail(queueStatus: TrainQueueStatus | null): string | undefined {
    if (!queueStatus) return undefined;
    return `${queueStatus.remaining} left · next in ${formatDuration(queueStatus.msUntilNextMs)}`;
  }

  function trainQueueStatusFor(barracks: Barracks | null, unitType: TrainingUnitType): TrainQueueStatus | null {
    const queue = barracks?.trainingQueue;
    if (!queue || queue.remaining <= 0 || queue.unitType !== unitType) return null;
    return {
      remaining: queue.remaining,
      msUntilNextMs: remainingMs(
        queue.currentUnitStartedAt,
        trainingUnitDurationMs(tweaks, unitType, barracks.level),
        now,
      ),
    };
  }

  function otherTrainingBlocks(barracks: Barracks | null, unitType: TrainingUnitType): boolean {
    const queue = barracks?.trainingQueue;
    return queue != null && queue.remaining > 0 && queue.unitType !== unitType;
  }

  async function handleRushTrainMilitia() {
    if (!selected) return;
    const result = await onRushTrainMilitia(selected, militiaToTrain);
    applyActionResult(result, { keepSelection: true });
  }

  async function handleRushActiveTraining(coord: Axial) {
    const result = await onRushActiveTraining(coord);
    applyActionResult(result);
  }

  async function handleUpgradeBase() {
    const result = await onUpgradeBase();
    applyActionResult(result);
  }

  async function handleUpgradeReinforcement() {
    const result = await onUpgradeReinforcement();
    applyActionResult(result);
  }

  async function handleDispatchExpedition() {
    if (!selected) return;
    const result = await onDispatchExpedition(selected, militiaToSend, junkyardKnightToSend, crossBowSniperToSend);
    applyActionResult(result);
  }

  async function handleAssaultDen() {
    if (!selectedDen) return;
    const result = await onAssaultDen(selectedDen.id, militiaToSend, junkyardKnightToSend, crossBowSniperToSend);
    applyActionResult(result);
  }

  async function handleSecureLab() {
    const result = await onSecureLab(militiaToSend, junkyardKnightToSend, crossBowSniperToSend);
    applyActionResult(result);
  }

  async function handleGarrisonUnit(kind: "militia" | "junkyardKnight" | "crossBowSniper") {
    if (!selected) return;
    // Clamp against current free pools — quantity state can linger from a
    // previous tile where a unit type was available (row hidden when free=0).
    const militia =
      kind === "militia"
        ? Math.min(
            militiaToGarrison,
            availableMilitia(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults),
          )
        : 0;
    const knights =
      kind === "junkyardKnight"
        ? Math.min(
            junkyardKnightToGarrison,
            availableJunkyardKnights(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults),
          )
        : 0;
    const snipers =
      kind === "crossBowSniper"
        ? Math.min(
            crossBowSniperToGarrison,
            availableCrossBowSnipers(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults),
          )
        : 0;
    const result = await onGarrisonUnits(selected, militia, knights, snipers);
    applyActionResult(result);
  }

  async function handleRecallMilitia() {
    if (!selected) return;
    const result = await onRecallMilitia(selected);
    applyActionResult(result);
  }

  async function handleRepairStructure() {
    if (!selected) return;
    const result = await onRepairStructure(selected);
    applyActionResult(result);
  }

  async function handleRepairBase() {
    const result = await onRepairBase();
    applyActionResult(result);
  }

  async function handleUpgradeOutpostReinforcement() {
    if (!selectedOutpost) return;
    const result = await onUpgradeOutpostReinforcement(selectedOutpost.id);
    applyActionResult(result);
  }

  async function handleRepairOutpost() {
    if (!selectedOutpost) return;
    const result = await onRepairOutpost(selectedOutpost.id);
    applyActionResult(result);
  }

  function canRepairHordeDamagedAt(coord: Axial): boolean {
    return canRepairHordeDamagedTile(tweaks, towers, territory, coord, gridSize, world.seed);
  }

  /**
   * A structure a horde captured stays in place but goes `damaged` (see
   * markCapturedStructuresDamaged, engine/hordes.ts) — this surfaces the
   * fixed-percentage-of-original-build-cost repair option (repairCost,
   * engine/formulas.ts), timed (structureRepairDurationMs), once the tile
   * is owned or within an active tower's viewshed (canRepairHordeDamagedTile).
   * Generic over whichever of the five structure kinds is actually sitting
   * there, since only one can occupy a tile at a time. Null while a horde-
   * damage repair timer is already running on that structure.
   */
  function repairOptionFor(
    structure: {
      damaged: boolean;
      damageRepair?: { startedAt: number } | null;
      buildCost: Partial<Record<ResourceType, number>>;
    } | null,
  ): RepairOption | null {
    if (!structure || !structure.damaged || isHordeRepairBlocked(structure)) return null;
    const cost = repairCost(tweaks, structure.buildCost);
    return { cost, affordable: affordable(cost), durationMinutes: structureRepairDurationMs(tweaks) / 60_000 };
  }

  const selectedTile = selected ? tileAt(selected) : null;
  const selectedTower = selected ? towerAt(selected) : null;
  const selectedPowerStation = selected ? powerStationAt(selected) : null;
  const selectedScrapYard = selected ? scrapYardAt(selected) : null;
  const selectedWall = selected ? wallAt(selected) : null;
  const selectedBarracks = selected ? barracksAt(selected) : null;
  const militiaQueueStatus = trainQueueStatusFor(selectedBarracks, "militia");
  const junkyardKnightQueueStatus = trainQueueStatusFor(selectedBarracks, "junkyard_knight");
  const crossBowSniperQueueStatus = trainQueueStatusFor(selectedBarracks, "cross_bow_sniper");
  const selectedDock = selected ? dockAt(selected) : null;
  const selectedIsBase = selected ? axialEquals(selected, territory.base) : false;
  const selectedDen: DenRecord | null = selected ? (dens.find((d) => axialEquals(d.coord, selected)) ?? null) : null;
  const selectedScrapStash: ScrapStashRecord | null =
    selected && (isOwned(selected) || isScouted(selected))
      ? (scrapStashes.find((s) => isActiveScrapStash(tweaks, world.seed, hexResourcePools, s) && axialEquals(s.coord, selected)) ?? null)
      : null;
  const selectedOutpost: OutpostRecord | null = selected ? outpostAt(selected) : null;
  const selectedTombstone: TombstoneRecord | null = selected
    ? (tombstones.find((t) => axialEquals(t.coord, selected)) ?? null)
    : null;
  // The lab stays indistinguishable from ordinary unscouted ground until the
  // player actually scouts its exact tile (DESIGN.md §13 — "hidden from
  // normal scouting") — isScouted gates this the same way it gates every
  // other "reveal what's here" branch below. Owned-but-not-scouted is also
  // treated as known: a pre-fix Improved Optics ring claim could own the
  // hex without scouting it, which drew the marker but left the sheet as
  // "Empty tile" with no assault.
  const selectedIsLab =
    selected !== null &&
    axialEquals(lab.coord, selected) &&
    (isScouted(selected) || isOwned(selected));
  // A den's or outpost's own core coordinate can end up in territory.owned
  // (the hold/starting ring, axialSpiral, includes its center) but still
  // isn't buildable ground — same exclusion as the main base tile.
  const selectedEmpty =
    !selectedTile &&
    !selectedTower &&
    !selectedPowerStation &&
    !selectedScrapYard &&
    !selectedWall &&
    !selectedBarracks &&
    !selectedDock &&
    !selectedDen &&
    !selectedScrapStash &&
    !selectedOutpost &&
    !selectedIsLab;
  const selectedCourierAutomated =
    selectedTile != null && structureHasCourierAutomation(extractionTierLevel(selectedTile.tier));
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
    : selectedTower
      ? towerFloorContribution(tweaks, selectedTower)
      : selectedPowerStation
        ? powerStationFloorContribution(tweaks, selectedPowerStation)
        : selectedScrapYard
          ? scrapYardFloorContribution(tweaks, selectedScrapYard)
          : selectedWall
            ? wallFloorContribution(tweaks, selectedWall)
            : null;
  const selectedStructure =
    selectedTile ?? selectedTower ?? selectedPowerStation ?? selectedScrapYard ?? selectedWall ?? selectedBarracks;
  const selectedGarrison = selected ? garrisonAt(garrisons, selected) : null;
  /** Recomputed once per render from the current structure lists — feeds both the resource-rate throughput calc below and every selected/hovered structure's power-state display (structurePowerState/powerStateLabel). */
  const powerNetwork = useMemo(
    () => computePowerNetwork(tweaks, powerStations, extractionTiles, towers, walls, barracksList, docks, scrapYards),
    [tweaks, powerStations, extractionTiles, towers, walls, barracksList, docks, scrapYards],
  );
  /** Null when the structure is L1/exempt or fully powered — see powerStateLabel. */
  function powerStateLabelFor(level: number, coord: Axial): string | null {
    return powerStateLabel(structurePowerState(powerNetwork, level, coord));
  }
  /** Nominal draw at this level (draw_base × level). L1 is always "none". */
  function powerDrawText(kind: PowerConsumerKind, level: number): string {
    if (level < 2) return "Power draw: none (L1)";
    return `Power draw: ${consumerDraw(tweaks, kind, level)}`;
  }
  /** Suffix for upgrade action details — shows how draw changes after the upgrade. */
  function powerDrawUpgradeSuffix(kind: PowerConsumerKind, fromLevel: number, toLevel: number): string {
    const to = consumerDraw(tweaks, kind, toLevel);
    if (fromLevel < 2) return `Power draw → ${to}`;
    return `Power draw ${consumerDraw(tweaks, kind, fromLevel)} → ${to}`;
  }
  /**
   * "No power" / brownout label for whichever L2+ consumer (extraction,
   * tower, wall, barracks) is currently selected — power stations
   * themselves are the source, not a consumer, so they're excluded here.
   */
  const selectedPowerStateLabel = selectedTile
    ? powerStateLabelFor(extractionTierLevel(selectedTile.tier), selectedTile.coord)
    : selectedTower
      ? powerStateLabelFor(selectedTower.level, selectedTower.coord)
      : selectedWall
        ? powerStateLabelFor(WALL_TIER_LEVEL[selectedWall.tier], selectedWall.coord)
        : selectedBarracks
          ? powerStateLabelFor(selectedBarracks.level, selectedBarracks.coord)
          : selectedScrapYard
            ? powerStateLabelFor(selectedScrapYard.level, selectedScrapYard.coord)
            : null;
  /** Nominal power draw for the selected consumer structure (null for stations / hubs). */
  const selectedPowerDrawText = selectedTile
    ? powerDrawText("extraction", extractionTierLevel(selectedTile.tier))
    : selectedTower
      ? powerDrawText("tower", selectedTower.level)
      : selectedWall
        ? powerDrawText("wall", WALL_TIER_LEVEL[selectedWall.tier])
        : selectedBarracks
          ? powerDrawText("barracks", selectedBarracks.level)
          : selectedScrapYard
            ? powerDrawText("scrap_yard", selectedScrapYard.level)
            : null;
  const resourceRates = useMemo(() => {
    const gridSize = resolveWorldGridSize(world, tweaks);
    return computeResourceRates(
      tweaks,
      extractionTiles,
      docks,
      resources,
      storageLevels,
      units,
      world.seed,
      powerNetwork,
      territory.base,
      territory,
      scoutedTiles,
      gridSize,
      hexResourcePools,
      {
        garrisons,
        expeditions,
        denAssaults,
        garrisonRecalls,
        labAssaults,
      },
    );
  }, [
    tweaks,
    extractionTiles,
    docks,
    resources,
    storageLevels,
    units,
    world,
    powerNetwork,
    territory,
    scoutedTiles,
    hexResourcePools,
    garrisons,
    expeditions,
    denAssaults,
    garrisonRecalls,
    labAssaults,
  ]);
  const collectableTiles = useMemo(() => {
    const stockpileCap = tweaks.storage.capacity_base_per_resource;
    const manualShowRatio = tweaks.storage.collect_pin_show_ratio;
    const courierShowRatio = tweaks.storage.collect_pin_courier_show_ratio;
    const fromExtraction = extractionTiles
      .filter((tile) => {
        if (tile.damaged || !isStructureActive(tile)) return false;
        return collectPinVisible(
          tile.stockpile,
          stockpileCap,
          structureHasCourierAutomation(extractionTierLevel(tile.tier)),
          manualShowRatio,
          courierShowRatio,
        );
      })
      .map((tile) => ({
        coord: tile.coord,
        resource: tile.resource,
        stockpile: tile.stockpile,
        stockpileCap,
        upgradeAvailable: tierUpgradeFor(tile)?.affordable ?? false,
      }));
    // Docks stockpile food the same way extraction tiles do — same pin, food icon.
    const fromDocks = docks
      .filter((dock) => {
        if (dock.buildStartedAt) return false;
        return collectPinVisible(
          dock.stockpile,
          stockpileCap,
          structureHasCourierAutomation(dockLevel(dock)),
          manualShowRatio,
          courierShowRatio,
        );
      })
      .map((dock) => ({
        coord: dock.coord,
        resource: "food" as const,
        stockpile: dock.stockpile,
        stockpileCap,
        upgradeAvailable: dockUpgradeOptionFor(dock)?.affordable ?? false,
      }));
    const fromScrapYards = scrapYards
      .filter((yard) => {
        if (!isStructureActive(yard)) return false;
        return collectPinVisible(
          yard.stockpile,
          stockpileCap,
          structureHasCourierAutomation(yard.level),
          manualShowRatio,
          courierShowRatio,
        );
      })
      .map((yard) => ({
        coord: yard.coord,
        resource: "steel" as const,
        stockpile: yard.stockpile,
        stockpileCap,
        upgradeAvailable: scrapYardUpgradeOptionFor(yard)?.affordable ?? false,
      }));
    return [...fromExtraction, ...fromDocks, ...fromScrapYards];
  }, [extractionTiles, docks, scrapYards, tweaks, resources]);
  /**
   * Coord keys of every upgradeable structure (base, Tower, Barracks, extraction
   * tile) whose next upgrade is unlocked and affordable right now — reuses the
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
      if (t.buildStartedAt != null) continue;
      if (towerUpgradeOptionFor(t)?.affordable) set.add(axialKey(t.coord));
    }
    for (const s of powerStations) {
      if (s.buildStartedAt != null) continue;
      if (powerStationUpgradeOptionFor(s)?.affordable) set.add(axialKey(s.coord));
    }
    for (const y of scrapYards) {
      if (y.buildStartedAt != null) continue;
      if (scrapYardUpgradeOptionFor(y)?.affordable) set.add(axialKey(y.coord));
    }
    for (const b of barracksList) {
      if (b.buildStartedAt != null) continue;
      if (barracksUpgradeOptionFor(b)?.affordable) set.add(axialKey(b.coord));
    }
    for (const t of extractionTiles) {
      if (t.buildStartedAt != null) continue;
      if (tierUpgradeFor(t)?.affordable) set.add(axialKey(t.coord));
    }
    for (const d of docks) {
      if (d.buildStartedAt != null) continue;
      if (dockUpgradeOptionFor(d)?.affordable) set.add(axialKey(d.coord));
    }
    return set;
  }
  const upgradeAvailableKeys = upgradeAvailableKeysFor();

  /**
   * Collect-style pins above built power stations (same map slot as extraction
   * collect pins). Green = grid OK, orange = brownout, red = blackout.
   */
  const powerStatusPins = useMemo((): PowerStatusPin[] => {
    let status: PowerPinStatus = "full";
    if (powerNetwork.totalDraw > 0 && powerNetwork.factor < 1) {
      status = powerNetwork.factor >= powerNetwork.cutoff ? "degraded" : "offline";
    }
    return powerStations
      .filter((station) => station.buildStartedAt == null)
      .map((station) => ({ coord: station.coord, status }));
  }, [powerNetwork, powerStations]);

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
   * functions directly (scaledCostMap/towerBuildCost/etc.), not the
   * component's local *OptionFor closures, so the dependency array stays
   * exhaustively correct without oxlint's closure-tracking limitations
   * (see resourceRates above for the same reasoning).
   */
  const buildModeEligibleKeys = useMemo(() => {
    if (!buildModeActive) return new Set<string>();

    const canAfford = (cost: Partial<Record<ResourceType, number>>) =>
      Object.entries(cost).every(([res, amount]) => resources[res as ResourceType] >= (amount ?? 0));

    const anyExtractionAffordable = RESOURCE_ORDER.filter((resource) => resource !== "steel").some((resource) => {
      const existingCount = extractionTiles.filter((t) => t.resource === resource).length;
      return canAfford(scaledCostMap(tweaks.extraction_tiles[resource].build_cost_base, existingCount + 1));
    });
    const anyBuildAffordable =
      anyExtractionAffordable ||
      canAfford(towerBuildCost(tweaks, towers.length + 1)) ||
      canAfford(powerStationBuildCost(tweaks, powerStations.length + 1)) ||
      canAfford(scrapYardBuildCost(tweaks, scrapYards.length + 1)) ||
      canAfford(wallBuildCost(tweaks, walls.length + 1)) ||
      canAfford(barracksBuildCost(tweaks, barracksList.length + 1));

    if (!anyBuildAffordable) return new Set<string>();

    const occupiedKeys = new Set<string>();
    for (const t of extractionTiles) occupiedKeys.add(axialKey(t.coord));
    for (const t of towers) occupiedKeys.add(axialKey(t.coord));
    for (const s of powerStations) occupiedKeys.add(axialKey(s.coord));
    for (const y of scrapYards) occupiedKeys.add(axialKey(y.coord));
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
  }, [
    buildModeActive,
    resources,
    extractionTiles,
    towers,
    powerStations,
    scrapYards,
    walls,
    barracksList,
    docks,
    territory.owned,
    territory.base,
    world.seed,
    tweaks,
  ]);

  /**
   * Repositions the hover tooltip by calling its imperative handle directly —
   * deliberately not a React state update. `HexCanvas` calls this from
   * inside its draw effect (via a ref, not a dependency), so routing it
   * through `setState` here would re-render all of GameScreen's ~30
   * `selectedX` derivations on every pan/zoom frame. See HoverTooltip.tsx.
   * The tile action sheet is viewport-fixed and needs no repositioning.
   */
  function handleViewportChange(viewport: { pan: { x: number; y: number }; zoom: number }) {
    const getScreenPosition = (coord: Axial) => hexCanvasRef.current?.getTileScreenPosition(coord) ?? null;
    const hexCircumradius = BASE_HEX_SIZE * viewport.zoom;
    hoverTooltipRef.current?.reposition(getScreenPosition, hexCircumradius);
    collectPinOverlayRef.current?.reposition(getScreenPosition, hexCircumradius);
    powerStatusPinOverlayRef.current?.reposition(getScreenPosition, hexCircumradius);
  }

  /** HexCanvas's onTileHover — already deduped to only fire on an actual tile change, so this is a cheap, infrequent state update rather than a per-mousemove-frame one. */
  function handleTileHover(coord: Axial | null) {
    setHoveredCoord(coord);
  }

  /**
   * Expedition for unowned scouted tiles — empty hexes and horde-captured
   * structures (#17). Reclaim ownership before repair is allowed. Fog reveal
   * is Wandering Scout / Scout Skiff only (#76).
   */
  function unownedClaimActionsFor(): SheetAction[] {
    if (!selected || isOwned(selected)) return [];

    if (redeployExpeditionId) {
      return [
        {
          key: "redeploy-here",
          icon: <Swords size={18} />,
          title: "Redeploy expedition here",
          onClick: () => {
            void (async () => {
              const result = await onRedeployExpedition(redeployExpeditionId, selected);
              setRedeployExpeditionId(null);
              applyActionResult(result);
            })();
          },
        },
      ];
    }

    // Fog reveal is Wandering Scout / Scout Skiff only (#76).
    if (!isScouted(selected)) return [];

    const expedition = expeditionRouteOptionFor(selected);
    if (!expedition) return [];
    return [
      {
        key: "expedition",
        icon: <Swords size={18} />,
        title: "Send expedition",
        detail: costDetail(expedition.provisionsCost, `ETA ${Math.ceil(expedition.etaMs / 60_000)}m`),
        disabled: !expedition.affordable,
        formContent: dispatchFormContent(expedition, undefined, "Send expedition", handleDispatchExpedition),
      },
    ];
  }

  /**
   * The structural "commit an action" buttons for the currently selected
   * tile — mirrors the old TilePopup / TileActionRing gates branch for
   * branch (same *OptionFor helpers, same handlers). Multi-choice actions
   * (which resource to extract, which storage to upgrade) collapse into
   * category groups via `subActions` rather than a flat root list (the sheet
   * flattens them into one list with filter pills).
   *
   * Called by sheetActionsFor below, which appends the universal
   * owned-tile-regardless-of-structure actions (Collect, Garrison, Demolish)
   * on top of whatever this returns.
   *
   * Unowned tiles with a damaged structure (#17): scout/expedition only —
   * repair/upgrade once owned again.
   */
  function canGarrisonAtSelected(): boolean {
    return (
      !!selectedGarrison ||
      availableMilitia(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults) > 0 ||
      availableJunkyardKnights(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults) > 0 ||
      availableCrossBowSnipers(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults) > 0
    );
  }

  /** Leaf row opening the garrison form — always on base; elsewhere only when units are free or already stationed. */
  function garrisonSheetAction(): SheetAction | null {
    if (!selected || !isOwned(selected)) return null;
    const canStation = canGarrisonAtSelected();
    if (!selectedIsBase && !canStation) return null;
    return {
      key: "garrison-manage",
      icon: <Flag size={18} />,
      title: "Garrison",
      detail: selectedGarrison ? "Units stationed — tap to manage or recall" : undefined,
      disabled: !canStation,
      formContent: garrisonFormContent(),
    };
  }

  /** True when a live horde stands on this tile or within garrison strike range (incl. wall bonus). */
  function selectedThreatenedByHorde(): boolean {
    if (!selected || !isOwned(selected)) return false;
    return hordes.some((h) => {
      const tile = h.path[h.pathIndex];
      return tile != null && isHordeReachableFromGarrison(tweaks, walls, selected, tile);
    });
  }

  /** Category tab for Garrison — preferDefault when a horde threatens so the sheet opens on the form. */
  function garrisonCategoryAction(preferDefault: boolean): SheetAction | null {
    const leaf = garrisonSheetAction();
    if (!leaf) return null;
    return {
      key: "garrison",
      icon: <Flag size={18} />,
      title: "Garrison",
      preferDefault,
      subActions: [leaf],
    };
  }

  function structuralActionsFor(): SheetAction[] {
    if (!selected) return [];
    const actions: SheetAction[] = [];

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
          title: buttonLabel,
          detail: `Defense ${option.denDefense.toFixed(0)}, ETA ${Math.ceil(option.etaMs / 60_000)}m`,
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
          title: "Secure the lab",
          detail: `Guardian defense ${option.guardianDefense.toFixed(0)}`,
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
          title: "Relocate base here",
          detail: costDetail(relocation.cost, `${Math.ceil(relocation.durationMs / 60_000)}m`),
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
          title: `Upgrade reinforcement to ${Math.floor(upgrade.hp)} HP`,
          detail: costDetail(upgrade.cost),
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
          title: "Repair outpost",
          detail: costDetail(repair.cost),
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
          icon: structureIcon(structureLevelCandidates("base", baseUpgrade.targetLevel)),
          title: `Upgrade base to L${baseUpgrade.targetLevel}`,
          detail: costDetail(baseUpgrade.cost),
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
          title: `Upgrade reinforcement to ${Math.floor(reinforce.hp)} HP`,
          detail: costDetail(reinforce.cost),
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
          title: "Repair base",
          detail: costDetail(repair.cost),
          disabled: !repair.affordable || baseAdjacentHordeOccupied,
          onClick: handleRepairBase,
        });
      }
      const storageOptions = storageUpgradesFor();
      if (storageOptions.length > 0) {
        actions.push({
          key: "storage-upgrade",
          icon: <Archive size={18} />,
          title: "Storage",
          upgradeAvailable: storageOptions.some((o) => o.inProgress === null && !baseHubAtTaskCap && o.affordable),
          subActions: storageOptions.map((o) => ({
            key: o.resource,
            icon: resourceIcon(o.resource),
            title: o.inProgress
              ? `${o.resource} storage → L${o.inProgress.targetLevel}`
              : `${o.resource} → L${o.level + 1}`,
            detail: o.inProgress
              ? formatDuration(o.inProgress.remainingMs)
              : costDetail(o.cost, `${o.durationMinutes}m`),
            disabled: o.inProgress !== null || baseHubAtTaskCap || !o.affordable,
            upgradeAvailable: o.inProgress === null && !baseHubAtTaskCap && o.affordable,
            onClick: () => handleUpgradeStorage(o.resource),
          })),
        });
      }
      const garrison = garrisonCategoryAction(selectedThreatenedByHorde());
      if (garrison) {
        actions.push(garrison);
      }
      return actions;
    }

    if (selectedDock) {
      const dockUpgrade = dockUpgradeOptionFor(selectedDock);
      if (dockUpgrade) {
        const levelNote =
          dockUpgrade.targetLevel === 2
            ? " — automate collection"
            : " — increase production";
        actions.push({
          key: "dock-upgrade",
          icon: structureIcon(dockSpriteCandidates(dockUpgrade.targetLevel), 45, <Anchor size={18} />),
          title: `Upgrade to L${dockUpgrade.targetLevel}${levelNote}`,
          detail: costDetail(dockUpgrade.cost, `${dockUpgrade.durationMinutes}m`),
          disabled: !dockUpgrade.affordable,
          upgradeAvailable: dockUpgrade.affordable,
          onClick: handleUpgradeDockLevel,
        });
      }
      const scoutSkiff = scoutSkiffOptionFor(selectedDock);
      if (scoutSkiff) {
        actions.push({
          key: "scout-skiff",
          icon: <Ship size={18} />,
          title: "Build scout skiff",
          detail: costDetail(scoutSkiff.cost, `${scoutSkiff.durationMinutes}m`),
          disabled: !scoutSkiff.affordable,
          onClick: handleBuildScoutSkiff,
        });
      }
      return actions;
    }

    if (selectedTile) {
      if (selectedTile.damaged && canRepairHordeDamagedAt(selected)) {
        const repair = repairOptionFor(selectedStructure);
        if (repair) {
          actions.push({
            key: "tile-repair",
            icon: <Wrench size={18} />,
            title: "Repair extraction tile",
            detail: costDetail(repair.cost, `${repair.durationMinutes}m`),
            disabled: !repair.affordable || selectedHordeOccupied,
            onClick: handleRepairStructure,
          });
        }
        return actions;
      }
      if (isOwned(selected)) {
        const upgrade = tierUpgradeFor(selectedTile);
        if (upgrade) {
          const fromLevel = extractionTierLevel(selectedTile.tier);
          const toLevel = extractionTierLevel(upgrade.targetTier);
          const levelNote =
            toLevel === 2 ? " — automate collection" : toLevel === 3 ? " — increase production" : "";
          actions.push({
            key: "tile-upgrade",
            icon: resourceIcon(selectedTile.resource),
            title: `Upgrade to ${extractionTierDisplayLabel(upgrade.targetTier)}${levelNote}`,
            detail: costDetail(upgrade.cost, `${upgrade.durationMinutes}m, ${powerDrawUpgradeSuffix("extraction", fromLevel, toLevel)}`),
            disabled: !upgrade.affordable,
            upgradeAvailable: upgrade.affordable,
            onClick: handleUpgradeTier,
          });
        }
        return actions;
      }
    } else if (selectedTower) {
      if (selectedTower.damaged && canRepairHordeDamagedAt(selected)) {
        const repair = repairOptionFor(selectedStructure);
        if (repair) {
          actions.push({
            key: "tower-repair",
            icon: <Wrench size={18} />,
            title: "Repair tower",
            detail: costDetail(repair.cost, `${repair.durationMinutes}m`),
            disabled: !repair.affordable || selectedHordeOccupied,
            onClick: handleRepairStructure,
          });
        }
        return actions;
      }
      if (isOwned(selected)) {
        const upgrade = towerUpgradeOptionFor(selectedTower);
        if (upgrade) {
          actions.push({
            key: "tower-upgrade",
            icon: structureIcon(structureLevelCandidates("tower", upgrade.targetLevel)),
            title: `Upgrade to L${upgrade.targetLevel}`,
            detail: costDetail(upgrade.cost, `${upgrade.durationMinutes}m, ${powerDrawUpgradeSuffix("tower", selectedTower.level, upgrade.targetLevel)}`),
            disabled: !upgrade.affordable,
            upgradeAvailable: upgrade.affordable,
            onClick: handleUpgradeTower,
          });
        }
        return actions;
      }
    } else if (selectedPowerStation) {
      if (selectedPowerStation.damaged && canRepairHordeDamagedAt(selected)) {
        const repair = repairOptionFor(selectedStructure);
        if (repair) {
          actions.push({
            key: "power-station-repair",
            icon: <Wrench size={18} />,
            title: "Repair power station",
            detail: costDetail(repair.cost, `${repair.durationMinutes}m`),
            disabled: !repair.affordable || selectedHordeOccupied,
            onClick: handleRepairStructure,
          });
        }
        return actions;
      }
      if (isOwned(selected)) {
        const upgrade = powerStationUpgradeOptionFor(selectedPowerStation);
        if (upgrade) {
          const fromCap = powerStationCapacity(tweaks, selectedPowerStation.level).toFixed(0);
          const toCap = powerStationCapacity(tweaks, upgrade.targetLevel).toFixed(0);
          const fromAoe = powerStationAoeRadius(tweaks, selectedPowerStation.level);
          const toAoe = powerStationAoeRadius(tweaks, upgrade.targetLevel);
          actions.push({
            key: "power-station-upgrade",
            icon: structureIcon(powerStationTierIconName(upgrade.targetLevel), 45, <Zap size={18} />),
            title: `Upgrade to L${upgrade.targetLevel}`,
            detail: costDetail(upgrade.cost, `${upgrade.durationMinutes}m, capacity ${fromCap} → ${toCap}, AoE ${fromAoe} → ${toAoe}`),
            disabled: !upgrade.affordable,
            upgradeAvailable: upgrade.affordable,
            onClick: handleUpgradePowerStation,
          });
        }
        return actions;
      }
    } else if (selectedScrapYard) {
      if (selectedScrapYard.damaged && canRepairHordeDamagedAt(selected)) {
        const repair = repairOptionFor(selectedStructure);
        if (repair) {
          actions.push({
            key: "scrap-yard-repair",
            icon: <Wrench size={18} />,
            title: "Repair scrap yard",
            detail: costDetail(repair.cost, `${repair.durationMinutes}m`),
            disabled: !repair.affordable || selectedHordeOccupied,
            onClick: handleRepairStructure,
          });
        }
        return actions;
      }
      if (isOwned(selected)) {
        const upgrade = scrapYardUpgradeOptionFor(selectedScrapYard);
        if (upgrade) {
          actions.push({
            key: "scrap-yard-upgrade",
            icon: structureIcon(scrapYardSpriteCandidates(upgrade.targetLevel), 45, resourceIcon("steel", 18)),
            title: `Upgrade to L${upgrade.targetLevel}`,
            detail: costDetail(upgrade.cost, `${upgrade.durationMinutes}m, ${powerDrawUpgradeSuffix("scrap_yard", selectedScrapYard.level, upgrade.targetLevel)}`),
            disabled: !upgrade.affordable,
            upgradeAvailable: upgrade.affordable,
            onClick: handleUpgradeScrapYard,
          });
        }
        if (selectedScrapYard.scrapperReady && isStructureActive(selectedScrapYard)) {
          const knownKeys = new Set([...territory.owned, ...scoutedTiles].map(axialKey));
          const knownStashes = scrapStashes.filter(
            (s) => isActiveScrapStash(tweaks, world.seed, hexResourcePools, s) && knownKeys.has(axialKey(s.coord)),
          );
          const trip = selectedScrapYard.scrapper;
          // Assign only when parked with no stash job — not while looping a haul
          // (outbound used to re-show Assign for mid-route redirect and flickered).
          const canAssign =
            knownStashes.length > 0 && (!trip || (trip.phase === "idle" && trip.assignedStashId == null));
          if (canAssign) {
            // Flatten stash targets as Actions leaves. All shows only the
            // closest; the Actions filter lists every known stash (#71).
            for (const stash of knownStashes) {
              const distance = axialDistance(selectedScrapYard.coord, stash.coord);
              actions.push({
                key: `scrapper-assign-${stash.id}`,
                icon: resourceIcon("steel", 18),
                title: `Assign Scrapper — stash (${formatRemainingResource(remainingResourceAt(world.seed, stash.coord, hexResourcePools, tweaks), tweaks)} steel)`,
                detail: `Distance ${distance}`,
                distance,
                allListClosestGroup: "scrapper-assign",
                onClick: () => {
                  void handleAssignScrapperStash(selectedScrapYard.coord, stash.id);
                },
              });
            }
          }
          if (trip && trip.phase !== "idle") {
            actions.push({
              key: "scrapper-recall",
              icon: <Undo2 size={18} />,
              title: "Recall Scrapper",
              detail: trip.cargo > 0 ? `Returning with ${Math.floor(trip.cargo)} steel` : "Pull back to yard",
              onClick: handleRecallScrapper,
            });
          }
        }
        return actions;
      }
    } else if (selectedWall) {
      if (selectedWall.damaged && canRepairHordeDamagedAt(selected)) {
        const repair = repairOptionFor(selectedStructure);
        if (repair) {
          actions.push({
            key: "wall-horde-repair",
            icon: <Wrench size={18} />,
            title: "Repair wall",
            detail: costDetail(repair.cost, `${repair.durationMinutes}m`),
            disabled: !repair.affordable || selectedHordeOccupied,
            onClick: handleRepairStructure,
          });
        }
        return actions;
      }
      if (isOwned(selected)) {
        // Unlike tile/path/tower/barracks, a wall's upgrade and repair options
        // aren't damaged-XOR-not — both can be independently available at
        // once (below-max durability AND tier-upgradeable), gated by one
        // shared in-progress status rather than each other.
        if (!wallActionStatusFor(selectedWall)) {
          const upgrade = wallUpgradeOptionFor(selectedWall);
          if (upgrade) {
            const fromLevel = WALL_TIER_LEVEL[selectedWall.tier];
            const toLevel = WALL_TIER_LEVEL[upgrade.targetTier];
            actions.push({
              key: "wall-upgrade",
              icon: structureIcon(WALL_TIER_ICON_NAMES[selectedWall.tier]),
              title: `Upgrade to ${upgrade.targetTier}`,
              detail: costDetail(upgrade.cost, `${upgrade.durationMinutes}m, ${powerDrawUpgradeSuffix("wall", fromLevel, toLevel)}`),
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
              title: "Repair wall",
              detail: costDetail(repair.cost, `${repair.durationMinutes}m`),
              disabled: !repair.affordable,
              onClick: handleRepairWall,
            });
          }
        }
        return actions;
      }
    } else if (selectedBarracks) {
      if (selectedBarracks.damaged && canRepairHordeDamagedAt(selected)) {
        const repair = repairOptionFor(selectedStructure);
        if (repair) {
          actions.push({
            key: "barracks-repair",
            icon: <Wrench size={18} />,
            title: "Repair barracks",
            detail: costDetail(repair.cost, `${repair.durationMinutes}m`),
            disabled: !repair.affordable || selectedHordeOccupied,
            onClick: handleRepairStructure,
          });
        }
        return actions;
      }
      if (isOwned(selected)) {
        const upgrade = barracksUpgradeOptionFor(selectedBarracks);
        if (upgrade) {
          actions.push({
            key: "barracks-upgrade",
            icon: structureIcon(structureLevelCandidates("barracks", upgrade.targetLevel)),
            title: `Upgrade to L${upgrade.targetLevel}`,
            detail: costDetail(upgrade.cost, `${upgrade.durationMinutes}m, ${powerDrawUpgradeSuffix("barracks", selectedBarracks.level, upgrade.targetLevel)}`),
            disabled: !upgrade.affordable,
            upgradeAvailable: upgrade.affordable,
            onClick: handleUpgradeBarracks,
          });
        }

        const trainSubActions: SheetAction[] = [];
        // Wandering Scout lives under Train (replaced stockpile scouts there) —
        // not a leaf Actions row, so it isn't buried behind Upgrades/Train tabs.
        const wanderingScout = wanderingScoutOptionFor(selectedBarracks);
        if (wanderingScout) {
          trainSubActions.push({
            key: "wandering-scout",
            icon: <Footprints size={18} />,
            title: "Wandering scout",
            detail: costDetail(wanderingScout.cost, `${wanderingScout.durationMinutes}m`),
            disabled: !wanderingScout.affordable,
            onClick: handleBuildWanderingScout,
          });
        }
        if (isStructureActive(selectedBarracks) && !isBarracksAtTaskCap(selectedBarracks, research)) {
        const militiaOption = otherTrainingBlocks(selectedBarracks, "militia") ? null : militiaTrainOptionFor();
        trainSubActions.push({
          key: "train-militia",
          icon: <Swords size={18} />,
          title: "Militia",
          detail: trainQueueDetail(militiaQueueStatus),
          formContent: (
            <TrainForm
              label="militia"
              queueStatus={militiaQueueStatus}
              option={militiaOption}
              toTrain={militiaToTrain}
              onChangeToTrain={setMilitiaToTrain}
              onTrain={() => handleTrainMilitia()}
              onRush={handleRushTrainMilitia}
            />
          ),
          quickActions: trainQuickActions(militiaOption, militiaQueueStatus, otherTrainingBlocks(selectedBarracks, "militia"), (qty) => {
            void handleTrainMilitia(qty);
          }),
        });
        const knightOption = otherTrainingBlocks(selectedBarracks, "junkyard_knight")
          ? null
          : junkyardKnightTrainOptionFor(selectedBarracks.level);
        if (knightOption || junkyardKnightQueueStatus) {
          trainSubActions.push({
            key: "train-knights",
            icon: <Shield size={18} />,
            title: "Junkyard knights",
            detail: trainQueueDetail(junkyardKnightQueueStatus),
            formContent: (
              <TrainForm
                label="junkyard knights"
                queueStatus={junkyardKnightQueueStatus}
                option={knightOption}
                toTrain={junkyardKnightToTrain}
                onChangeToTrain={setJunkyardKnightToTrain}
                onTrain={() => handleTrainJunkyardKnight()}
              />
            ),
            quickActions: trainQuickActions(
              knightOption,
              junkyardKnightQueueStatus,
              otherTrainingBlocks(selectedBarracks, "junkyard_knight"),
              (qty) => {
                void handleTrainJunkyardKnight(qty);
              },
            ),
          });
        }
        const sniperOption = otherTrainingBlocks(selectedBarracks, "cross_bow_sniper")
          ? null
          : crossBowSniperTrainOptionFor(selectedBarracks.level);
        if (sniperOption || crossBowSniperQueueStatus) {
          trainSubActions.push({
            key: "train-snipers",
            icon: <Target size={18} />,
            title: "Cross-bow snipers",
            detail: trainQueueDetail(crossBowSniperQueueStatus),
            formContent: (
              <TrainForm
                label="cross-bow snipers"
                queueStatus={crossBowSniperQueueStatus}
                option={sniperOption}
                toTrain={crossBowSniperToTrain}
                onChangeToTrain={setCrossBowSniperToTrain}
                onTrain={() => handleTrainCrossBowSniper()}
              />
            ),
            quickActions: trainQuickActions(
              sniperOption,
              crossBowSniperQueueStatus,
              otherTrainingBlocks(selectedBarracks, "cross_bow_sniper"),
              (qty) => {
                void handleTrainCrossBowSniper(qty);
              },
            ),
          });
        }
        }
        if (trainSubActions.length > 0) {
          actions.push({ key: "train", icon: <GraduationCap size={18} />, title: "Train", subActions: trainSubActions });
        }

        return actions;
      }
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
        icon: structureIcon(dockSpriteCandidates(false)),
        title: "Build dock",
        detail: costDetail(dock.cost),
        disabled: !dock.affordable,
        onClick: handleBuildDock,
      });
      return actions;
    }

    // Empty, buildable, owned land — every structure category is
    // independently available here (they're not mutually exclusive choices
    // at the "what can go here" stage, see GameScreen's selectedEmpty gate),
    // grouped under two category filters — Civil (resource extraction, power)
    // and Military (tower, wall, barracks).
    const emptyBuildableGate = isOwned(selected) && selectedEmpty && !selectedIsBase && isBuildableLand(world.seed, selected);
    if (emptyBuildableGate) {
      const civilSubActions: SheetAction[] = buildOptionsFor().map((o) => ({
        key: o.resource,
        icon: resourceIcon(o.resource),
        title: o.resource,
        detail: costDetail(o.cost, `${o.durationMinutes}m`),
        disabled: !o.affordable,
        onClick: () => handleBuild(o.resource),
      }));
      const powerStation = powerStationBuildOptionFor();
      civilSubActions.push({
        key: "build-power-station",
        icon: structureIcon(powerStationTierIconName(1), 45, <Zap size={18} />),
        title: "Build power station",
        detail: costDetail(powerStation.cost, `${powerStation.durationMinutes}m`),
        disabled: !powerStation.affordable,
        onClick: handleBuildPowerStation,
      });
      const scrapYard = scrapYardBuildOptionFor();
      civilSubActions.push({
        key: "build-scrap-yard",
        icon: structureIcon(scrapYardSpriteCandidates(1), 45, resourceIcon("steel", 18)),
        title: "Build scrap yard",
        detail: costDetail(scrapYard.cost, `${scrapYard.durationMinutes}m`),
        disabled: !scrapYard.affordable,
        onClick: handleBuildScrapYard,
      });

      const militarySubActions: SheetAction[] = [];
      const tower = towerBuildOptionFor();
      militarySubActions.push({
        key: "build-tower",
        icon: structureIcon(structureLevelCandidates("tower", 1)),
        title: "Build tower",
        detail: costDetail(tower.cost, `${tower.durationMinutes}m`),
        disabled: !tower.affordable,
        onClick: handleBuildTower,
      });
      const wall = wallBuildOptionFor();
      militarySubActions.push({
        key: "build-wall",
        icon: structureIcon(WALL_TIER_ICON_NAMES.wood),
        title: "Build wall",
        detail: costDetail(wall.cost, `${wall.durationMinutes}m`),
        disabled: !wall.affordable,
        onClick: handleBuildWall,
      });
      const barracks = barracksBuildOptionFor();
      militarySubActions.push({
        key: "build-barracks",
        icon: structureIcon(structureLevelCandidates("barracks", 1)),
        title: "Build barracks",
        detail: costDetail(barracks.cost, `${barracks.durationMinutes}m`),
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

    actions.push(...unownedClaimActionsFor());
    return actions;
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
    const powerLine =
      option.attackPower != null ? (
        <span>
          Party power: {option.attackPower}
          {option.wipeRisk
            ? ` — wipe risk: horde ${option.wipeRisk.hordeSize} on route (need ≥${option.wipeRisk.hordeSize})`
            : " — no wipe risk from known hordes"}
        </span>
      ) : null;
    const combinedExtra =
      extraInfo || powerLine ? (
        <>
          {extraInfo}
          {powerLine}
        </>
      ) : undefined;
    return (
      <PartyDispatchForm
        extraInfo={combinedExtra}
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
    );
  }

  /** Garrison hex's sheet form — one compact stepper + check-to-station row per unit type. */
  function garrisonFormContent(): ReactNode {
    if (!selected) return null;
    const availMilitia = availableMilitia(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults);
    const availKnight = availableJunkyardKnights(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults);
    const availSniper = availableCrossBowSnipers(units, garrisons, expeditions, denAssaults, garrisonRecalls, labAssaults);
    const stationedParts: string[] = [];
    if (selectedGarrison) {
      if (selectedGarrison.militiaCount > 0) stationedParts.push(`${selectedGarrison.militiaCount} militia`);
      if (selectedGarrison.junkyardKnightCount > 0) stationedParts.push(`${selectedGarrison.junkyardKnightCount} knights`);
      if (selectedGarrison.crossBowSniperCount > 0) stationedParts.push(`${selectedGarrison.crossBowSniperCount} snipers`);
    }
    return (
      <GarrisonForm
        stationedSummary={stationedParts.length > 0 ? stationedParts.join(" · ") : undefined}
        militia={{ available: availMilitia, toGarrison: militiaToGarrison, onChange: setMilitiaToGarrison }}
        junkyardKnight={{
          available: availKnight,
          toGarrison: junkyardKnightToGarrison,
          onChange: setJunkyardKnightToGarrison,
        }}
        crossBowSniper={{
          available: availSniper,
          toGarrison: crossBowSniperToGarrison,
          onChange: setCrossBowSniperToGarrison,
        }}
        recalling={recallInProgressFor(selected) !== null}
        hordeOccupied={selectedHordeOccupied}
        onStation={handleGarrisonUnit}
        onRecall={handleRecallMilitia}
      />
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
  function activeCountdownRows(): NotificationCountdownRow[] {
    const rows: NotificationCountdownRow[] = [];
    const buildIcon = <Hammer size={NOTIFICATION_ICON_SIZE} />;
    const upgradeIcon = <ArrowUpCircle size={NOTIFICATION_ICON_SIZE} />;
    const repairIcon = <Wrench size={NOTIFICATION_ICON_SIZE} />;

    for (const tile of extractionTiles) {
      const key = axialKey(tile.coord);
      if (tile.buildStartedAt) {
        const durationMs = extractionTileBuildDurationMs(tweaks);
        rows.push({
          key: `tile-build-${key}`,
          kind: "build",
          icon: buildIcon,
          label: `Building ${tile.resource} tile`,
          coord: tile.coord,
          durationMs,
          remainingMs: remainingMs(tile.buildStartedAt, durationMs, now),
        });
      }
      if (tile.upgrade) {
        const durationMs = tierUpgradeDurationMs(tweaks, tile.upgrade.targetTier);
        rows.push({
          key: `tile-upgrade-${key}`,
          kind: "upgrade",
          icon: upgradeIcon,
          label: `Upgrading ${tile.resource} tile to ${tile.upgrade.targetTier}`,
          coord: tile.coord,
          durationMs,
          remainingMs: remainingMs(tile.upgrade.startedAt, durationMs, now),
        });
      }
      if (tile.damageRepair) {
        const durationMs = structureRepairDurationMs(tweaks);
        rows.push({
          key: `tile-repair-${key}`,
          kind: "repair",
          icon: repairIcon,
          label: `Repairing ${tile.resource} tile`,
          coord: tile.coord,
          durationMs,
          remainingMs: remainingMs(tile.damageRepair.startedAt, durationMs, now),
        });
      }
    }


    for (const tower of towers) {
      const key = axialKey(tower.coord);
      if (tower.buildStartedAt) {
        const durationMs = towerBuildDurationMs(tweaks);
        rows.push({
          key: `tower-build-${key}`,
          kind: "build",
          icon: buildIcon,
          label: "Building tower",
          coord: tower.coord,
          durationMs,
          remainingMs: remainingMs(tower.buildStartedAt, durationMs, now),
        });
      }
      if (tower.upgrade) {
        const durationMs = towerUpgradeDurationMs(tweaks, tower.upgrade.targetLevel);
        rows.push({
          key: `tower-upgrade-${key}`,
          kind: "upgrade",
          icon: upgradeIcon,
          label: `Upgrading tower to L${tower.upgrade.targetLevel}`,
          coord: tower.coord,
          durationMs,
          remainingMs: remainingMs(tower.upgrade.startedAt, durationMs, now),
        });
      }
      if (tower.damageRepair) {
        const durationMs = structureRepairDurationMs(tweaks);
        rows.push({
          key: `tower-repair-${key}`,
          kind: "repair",
          icon: repairIcon,
          label: "Repairing tower",
          coord: tower.coord,
          durationMs,
          remainingMs: remainingMs(tower.damageRepair.startedAt, durationMs, now),
        });
      }
    }

    for (const station of powerStations) {
      const key = axialKey(station.coord);
      if (station.buildStartedAt) {
        const durationMs = powerStationBuildDurationMs(tweaks);
        rows.push({
          key: `power-station-build-${key}`,
          kind: "build",
          icon: buildIcon,
          label: "Building power station",
          coord: station.coord,
          durationMs,
          remainingMs: remainingMs(station.buildStartedAt, durationMs, now),
        });
      }
      if (station.upgrade) {
        const durationMs = powerStationUpgradeDurationMs(tweaks, station.upgrade.targetLevel);
        rows.push({
          key: `power-station-upgrade-${key}`,
          kind: "upgrade",
          icon: upgradeIcon,
          label: `Upgrading power station to L${station.upgrade.targetLevel}`,
          coord: station.coord,
          durationMs,
          remainingMs: remainingMs(station.upgrade.startedAt, durationMs, now),
        });
      }
      if (station.damageRepair) {
        const durationMs = structureRepairDurationMs(tweaks);
        rows.push({
          key: `power-station-repair-${key}`,
          kind: "repair",
          icon: repairIcon,
          label: "Repairing power station",
          coord: station.coord,
          durationMs,
          remainingMs: remainingMs(station.damageRepair.startedAt, durationMs, now),
        });
      }
    }

    for (const yard of scrapYards) {
      const key = axialKey(yard.coord);
      if (yard.buildStartedAt) {
        const durationMs = scrapYardBuildDurationMs(tweaks);
        rows.push({
          key: `scrap-yard-build-${key}`,
          kind: "build",
          icon: buildIcon,
          label: "Building scrap yard",
          coord: yard.coord,
          durationMs,
          remainingMs: remainingMs(yard.buildStartedAt, durationMs, now),
        });
      }
      if (yard.upgrade) {
        const durationMs = scrapYardUpgradeDurationMs(tweaks, yard.upgrade.targetLevel as 2 | 3);
        rows.push({
          key: `scrap-yard-upgrade-${key}`,
          kind: "upgrade",
          icon: upgradeIcon,
          label: `Upgrading scrap yard to L${yard.upgrade.targetLevel}`,
          coord: yard.coord,
          durationMs,
          remainingMs: remainingMs(yard.upgrade.startedAt, durationMs, now),
        });
      }
      if (yard.damageRepair) {
        const durationMs = structureRepairDurationMs(tweaks);
        rows.push({
          key: `scrap-yard-repair-${key}`,
          kind: "repair",
          icon: repairIcon,
          label: "Repairing scrap yard",
          coord: yard.coord,
          durationMs,
          remainingMs: remainingMs(yard.damageRepair.startedAt, durationMs, now),
        });
      }
    }

    for (const wall of walls) {
      const key = axialKey(wall.coord);
      if (wall.buildStartedAt) {
        const durationMs = wallBuildDurationMs(tweaks);
        rows.push({
          key: `wall-build-${key}`,
          kind: "build",
          icon: buildIcon,
          label: "Building wall",
          coord: wall.coord,
          durationMs,
          remainingMs: remainingMs(wall.buildStartedAt, durationMs, now),
        });
      }
      if (wall.action) {
        if (wall.action.kind === "upgrade") {
          const durationMs = wallUpgradeDurationMs(tweaks, wall.action.targetTier);
          rows.push({
            key: `wall-action-${key}`,
            kind: "upgrade",
            icon: upgradeIcon,
            label: `Upgrading wall to ${wall.action.targetTier}`,
            coord: wall.coord,
            durationMs,
            remainingMs: remainingMs(wall.action.startedAt, durationMs, now),
          });
        } else {
          const maxHp = maxWallDurability(tweaks, wall.tier);
          const durationMs = wallRepairDurationMs(tweaks, wall, maxHp);
          rows.push({
            key: `wall-action-${key}`,
            kind: "repair",
            icon: repairIcon,
            label: "Repairing wall",
            coord: wall.coord,
            durationMs,
            remainingMs: remainingMs(wall.action.startedAt, durationMs, now),
          });
        }
      }
      if (wall.damageRepair) {
        const durationMs = structureRepairDurationMs(tweaks);
        rows.push({
          key: `wall-damage-repair-${key}`,
          kind: "repair",
          icon: repairIcon,
          label: "Repairing wall (horde damage)",
          coord: wall.coord,
          durationMs,
          remainingMs: remainingMs(wall.damageRepair.startedAt, durationMs, now),
        });
      }
    }

    for (const b of barracksList) {
      const key = axialKey(b.coord);
      if (b.buildStartedAt) {
        const durationMs = barracksBuildDurationMs(tweaks);
        rows.push({
          key: `barracks-build-${key}`,
          kind: "build",
          icon: buildIcon,
          label: "Building barracks",
          coord: b.coord,
          durationMs,
          remainingMs: remainingMs(b.buildStartedAt, durationMs, now),
        });
      }
      if (b.upgrade) {
        const durationMs = barracksUpgradeDurationMs(tweaks, b.upgrade.targetLevel);
        rows.push({
          key: `barracks-upgrade-${key}`,
          kind: "upgrade",
          icon: upgradeIcon,
          label: `Upgrading barracks to L${b.upgrade.targetLevel}`,
          coord: b.coord,
          durationMs,
          remainingMs: remainingMs(b.upgrade.startedAt, durationMs, now),
        });
      }
      if (b.damageRepair) {
        const durationMs = structureRepairDurationMs(tweaks);
        rows.push({
          key: `barracks-repair-${key}`,
          kind: "repair",
          icon: repairIcon,
          label: "Repairing barracks",
          coord: b.coord,
          durationMs,
          remainingMs: remainingMs(b.damageRepair.startedAt, durationMs, now),
        });
      }
      const training = b.trainingQueue;
      if (training && training.remaining > 0 && isStructureActive(b)) {
        const perUnitMs = trainingUnitDurationMs(tweaks, training.unitType, b.level);
        const nextUnitRemainingMs = remainingMs(training.currentUnitStartedAt, perUnitMs, now);
        const remainingMsTotal = nextUnitRemainingMs + (training.remaining - 1) * perUnitMs;
        rows.push({
          key: `barracks-train-${key}`,
          kind: "train",
          icon: <GraduationCap size={NOTIFICATION_ICON_SIZE} />,
          label: `Training ${trainingUnitLabel(training.unitType)}`,
          coord: b.coord,
          durationMs: training.remaining * perUnitMs,
          remainingMs: remainingMsTotal,
          onRush:
            training.unitType === "militia"
              ? () => {
                  void handleRushActiveTraining(b.coord);
                }
              : undefined,
        });
      }
    }

    for (const dock of docks) {
      const key = axialKey(dock.coord);
      if (dock.buildStartedAt) {
        const durationMs = dockBuildDurationMs(tweaks);
        rows.push({
          key: `dock-build-${key}`,
          kind: "build",
          icon: buildIcon,
          label: "Building dock",
          coord: dock.coord,
          durationMs,
          remainingMs: remainingMs(dock.buildStartedAt, durationMs, now),
        });
      }
      if (dock.upgrade) {
        const durationMs = dockUpgradeDurationMs(tweaks, dock.upgrade.targetLevel as 2 | 3);
        rows.push({
          key: `dock-upgrade-${key}`,
          kind: "build",
          icon: buildIcon,
          label: `Upgrading dock to L${dock.upgrade.targetLevel}`,
          coord: dock.coord,
          durationMs,
          remainingMs: remainingMs(dock.upgrade.startedAt, durationMs, now),
        });
      } else if (dock.fishingBoatUpgrade) {
        const durationMs = tweaks.docks.fishing_boat.build_time_minutes * 60_000;
        rows.push({
          key: `dock-boat-${key}`,
          kind: "build",
          icon: buildIcon,
          label: "Upgrading dock to L3",
          coord: dock.coord,
          durationMs,
          remainingMs: remainingMs(dock.fishingBoatUpgrade.startedAt, durationMs, now),
        });
      }
    }

    for (const skiff of scoutSkiffs) {
      if (skiff.buildStartedAt != null) {
        const durationMs = tweaks.docks.scout_skiff.build_time_minutes * 60_000;
        rows.push({
          key: `skiff-${skiff.id}`,
          kind: "build",
          icon: buildIcon,
          label: "Building scout skiff",
          coord: skiff.homeDockCoord,
          durationMs,
          remainingMs: remainingMs(skiff.buildStartedAt, durationMs, now),
        });
      }
    }

    for (const scout of wanderingScouts) {
      if (scout.buildStartedAt != null) {
        const durationMs = tweaks.units.wandering_scout.build_time_minutes * 60_000;
        rows.push({
          key: `wscout-${scout.id}`,
          kind: "train",
          icon: buildIcon,
          label: "Training wandering scout",
          coord: scout.homeBarracksCoord,
          durationMs,
          remainingMs: remainingMs(scout.buildStartedAt, durationMs, now),
        });
      }
    }

    if (base.action) {
      const action = base.action;
      if (action.kind === "level_upgrade") {
        const durationMs = baseUpgradeDurationMs(tweaks, action.targetLevel);
        rows.push({
          key: "base-upgrade",
          kind: "upgrade",
          icon: upgradeIcon,
          label: `Upgrading base to L${action.targetLevel}`,
          coord: territory.base,
          durationMs,
          remainingMs: remainingMs(action.startedAt, durationMs, now),
        });
      } else if (action.kind === "reinforcement_upgrade") {
        const durationMs = baseReinforcementUpgradeDurationMs(tweaks, action.targetLevel);
        rows.push({
          key: "base-reinforce",
          kind: "upgrade",
          icon: upgradeIcon,
          label: `Upgrading base reinforcement to L${action.targetLevel}`,
          coord: territory.base,
          durationMs,
          remainingMs: remainingMs(action.startedAt, durationMs, now),
        });
      } else {
        const maxHp = baseReinforcementHp(tweaks, base.reinforcementLevel);
        const durationMs = baseReinforcementRepairDurationMs(tweaks, base.currentHp, maxHp);
        rows.push({
          key: "base-reinforce-repair",
          kind: "repair",
          icon: repairIcon,
          label: "Repairing base reinforcement",
          coord: territory.base,
          durationMs,
          remainingMs: remainingMs(action.startedAt, durationMs, now),
        });
      }
    }

    for (const outpost of outposts) {
      if (!outpost.reinforcementAction) continue;
      const action = outpost.reinforcementAction;
      if (action.kind === "upgrade") {
        const durationMs = outpostReinforcementUpgradeDurationMs(tweaks, action.targetLevel);
        rows.push({
          key: `outpost-reinforce-${outpost.id}`,
          kind: "upgrade",
          icon: upgradeIcon,
          label: `Upgrading outpost reinforcement to L${action.targetLevel}`,
          coord: outpost.coord,
          durationMs,
          remainingMs: remainingMs(action.startedAt, durationMs, now),
        });
      } else {
        const maxHp = outpostReinforcementHp(tweaks, outpost.reinforcementLevel);
        const durationMs = outpostReinforcementRepairDurationMs(tweaks, outpost.currentHp, maxHp);
        rows.push({
          key: `outpost-reinforce-repair-${outpost.id}`,
          kind: "repair",
          icon: repairIcon,
          label: "Repairing outpost reinforcement",
          coord: outpost.coord,
          durationMs,
          remainingMs: remainingMs(action.startedAt, durationMs, now),
        });
      }
    }

    if (base.relocation && baseRelocationInProgress) {
      const durationMs = baseRelocationDurationMs(
        tweaks,
        axialDistance(territory.base, base.relocation.destination),
      );
      rows.push({
        key: "base-relocation",
        kind: "relocate",
        icon: <Navigation size={NOTIFICATION_ICON_SIZE} />,
        label: "Relocating base",
        coord: baseRelocationInProgress.destination,
        durationMs,
        remainingMs: baseRelocationInProgress.remainingMs,
        });
    }

    for (const [resource, pending] of Object.entries(storageUpgrades) as [
      ResourceType,
      { targetLevel: number; startedAt: number } | undefined,
    ][]) {
      if (!pending) continue;
      const durationMs = storageUpgradeDurationMs(tweaks, pending.targetLevel);
      rows.push({
        key: `storage-${resource}`,
        kind: "upgrade",
        icon: resourceIcon(resource, NOTIFICATION_ICON_SIZE),
        label: `Upgrading ${resource} storage to L${pending.targetLevel}`,
        coord: territory.base,
        durationMs,
        remainingMs: remainingMs(pending.startedAt, durationMs, now),
        });
    }

    if (research.pending) {
      const durationMs = researchDurationMs(tweaks, research.pending.id);
      rows.push({
        key: `research-${research.pending.id}`,
        kind: "upgrade",
        icon: <FlaskConical size={NOTIFICATION_ICON_SIZE} />,
        label: `Researching ${RESEARCH_LABEL[research.pending.id]}`,
        durationMs,
        remainingMs: remainingMs(research.pending.startedAt, durationMs, now),
        onLabelClick: () => toggleOpenPanel("research"),
        });
    }

    return rows;
  }

  /**
   * Passive status for the sheet Info filter — the touch / selected-tile path
   * for structure stats (desktop still has the mouse hover tooltip; hover is
   * suppressed on the selected tile). Covers the same glance stats as
   * hoverInfoFor, plus base storage fill which only belongs here. Selected-tile
   * countdown timers also appear under In progress (and the notification tray)
   * — see activeCountdownRows. Returns null when the selected tile has nothing
   * to show, so the Info filter only appears when needed.
   */
  function infoSheetContent(): ReactNode | null {
    if (!selected) return null;
    const rows: ReactNode[] = [];
    if (selectedIsBase) {
      const status = base.relocation
        ? "Relocating…"
        : base.action
          ? base.action.kind === "level_upgrade"
            ? `Upgrading to L${base.action.targetLevel}…`
            : base.action.kind === "reinforcement_upgrade"
              ? `Upgrading reinforcement to L${base.action.targetLevel}…`
              : "Repairing…"
          : "Operational";
      const maxHp = baseReinforcementHp(tweaks, base.reinforcementLevel);
      const usedSlots = totalStructureCount(
        tweaks,
        extractionTiles,
        towers,
        walls,
        barracksList,
        docks,
        powerStations,
        scrapYards,
      );
      const slotCap = buildSlotCap(tweaks, base.level);
      rows.push(
        <div key="base-status">{status}</div>,
        <StatRow
          key="base-hp"
          label={`HP (L${base.reinforcementLevel})`}
          current={base.currentHp}
          max={maxHp}
        />,
        <div key="base-noise">Noise cap: {noiseCap(tweaks, base.level)}db</div>,
        <StatRow
          key="base-build-slots"
          label="Build slots"
          current={usedSlots}
          max={slotCap}
          displayValue={`${formatBuildSlots(usedSlots)}/${formatBuildSlots(slotCap)}`}
        />,
      );
      for (const resource of RESOURCE_ORDER) {
        const level = storageLevels[resource];
        rows.push(
          <StatRow
            key={`storage-${resource}`}
            icon={resourceIcon(resource, 18)}
            label={`${capitalize(resource)} · L${level}`}
            current={resources[resource]}
            max={storageCapacity(tweaks, level)}
          />,
        );
      }
    }
    if (selectedOutpost) {
      const status = selectedOutpost.reinforcementAction
        ? selectedOutpost.reinforcementAction.kind === "upgrade"
          ? `Upgrading to L${selectedOutpost.reinforcementAction.targetLevel}…`
          : "Repairing…"
        : "Operational";
      const maxHp = outpostReinforcementHp(tweaks, selectedOutpost.reinforcementLevel);
      rows.push(
        <div key="outpost-status">{status}</div>,
        <StatRow
          key="outpost-hp"
          label={`HP (L${selectedOutpost.reinforcementLevel})`}
          current={selectedOutpost.currentHp}
          max={maxHp}
        />,
      );
    }
    if (selectedDen) {
      const status = selectedDen.siege
        ? `Under siege — wave ${selectedDen.siege.waveIndex + 1}`
        : "Hostile";
      rows.push(
        <div key="den-status">{status}</div>,
        <div key="den-defense">Defense: {denDefense(tweaks, selectedDen.level).toFixed(1)}</div>,
      );
    }
    if (selectedIsLab) {
      rows.push(
        <div key="lab-status">{lab.secured ? "Secured" : "Guarded"}</div>,
      );
      if (!lab.secured) {
        rows.push(
          <div key="lab-guardian">Guardian defense: {lab.guardianDefense.toFixed(0)}</div>,
        );
      }
    }
    if (selectedTile) {
      const status = selectedTile.buildStartedAt
        ? "Under construction"
        : selectedTile.damaged
          ? selectedTile.damageRepair
            ? "Repairing…"
            : "Damaged"
          : selectedTile.upgrade
            ? `Upgrading to ${extractionTierDisplayLabel(selectedTile.upgrade.targetTier)}…`
            : "Operational";
      rows.push(<div key="tile-status">{status}</div>);
      if (isStructureActive(selectedTile)) {
        rows.push(
          <div key="tile-yield">
            Yield: {yieldPerSecond(tweaks, selectedTile, world.seed).toFixed(1)} {selectedTile.resource}/sec
          </div>,
        );
      }
      rows.push(
        <div key="flow">
          {selectedCourierAutomated
            ? selectedTile.courier
              ? selectedTile.courier.phase === "toBase"
                ? "Courier — delivering to base"
                : "Courier — returning"
              : "Courier — automated collection"
            : "Manual collection only (upgrade to L2 to automate)"}
        </div>,
        <div key="tile-stockpile">Stockpile: {Math.floor(selectedTile.stockpile)}</div>,
        <div key="tile-remaining">
          Hex remaining:{" "}
          {formatRemainingResource(
            remainingResourceAt(world.seed, selectedTile.coord, hexResourcePools, tweaks),
            tweaks,
          )}
        </div>,
      );
    }
    if (selectedDock) {
      const level = dockLevel(selectedDock);
      const status = selectedDock.buildStartedAt
        ? "Under construction"
        : selectedDock.upgrade
          ? `Upgrading to L${selectedDock.upgrade.targetLevel}…`
          : selectedDock.fishingBoatUpgrade
            ? "Upgrading to L3…"
            : "Operational";
      const automated = structureHasCourierAutomation(level);
      rows.push(<div key="dock-status">{status}</div>);
      if (!selectedDock.buildStartedAt) {
        rows.push(
          <div key="dock-yield">Yield: {dockYieldPerSecond(tweaks, selectedDock).toFixed(1)} food/sec</div>,
        );
      }
      rows.push(
        <div key="dock-courier">
          {automated
            ? selectedDock.courier
              ? selectedDock.courier.phase === "toBase"
                ? "Courier — delivering to base"
                : "Courier — returning"
              : "Courier — automated collection"
            : "Manual collection only (upgrade to L2 to automate)"}
        </div>,
        <div key="dock-stockpile">Stockpile: {Math.floor(selectedDock.stockpile)}</div>,
        <div key="dock-remaining">
          Hex remaining:{" "}
          {formatRemainingResource(
            remainingResourceAt(world.seed, selectedDock.coord, hexResourcePools, tweaks),
            tweaks,
          )}
        </div>,
      );
    }
    if (selectedWall) {
      const status = selectedWall.buildStartedAt
        ? "Under construction"
        : selectedWall.damaged
          ? selectedWall.damageRepair
            ? "Repairing…"
            : "Damaged"
          : selectedWall.action
            ? selectedWall.action.kind === "upgrade"
              ? `Upgrading to ${selectedWall.action.targetTier}…`
              : "Repairing durability…"
            : "Operational";
      const maxHp = maxWallDurability(tweaks, selectedWall.tier);
      rows.push(
        <div key="wall-status">{status}</div>,
        <StatRow
          key="wall-hp"
          label="Durability"
          current={selectedWall.durability}
          max={maxHp}
        />,
      );
    }
    if (selectedBarracks) {
      const status = selectedBarracks.buildStartedAt
        ? "Under construction"
        : selectedBarracks.damaged
          ? selectedBarracks.damageRepair
            ? "Repairing…"
            : "Damaged"
          : selectedBarracks.upgrade
            ? `Upgrading to L${selectedBarracks.upgrade.targetLevel}…`
            : "Operational";
      rows.push(<div key="barracks-status">{status}</div>);
    }
    if (selectedNoiseFloorContribution !== null) {
      rows.push(<div key="noise">Noise floor: +{selectedNoiseFloorContribution.toFixed(1)}db</div>);
    }
    if (selectedTower) {
      const status = selectedTower.buildStartedAt
        ? "Under construction"
        : selectedTower.damaged
          ? selectedTower.damageRepair
            ? "Repairing…"
            : "Damaged"
          : selectedTower.upgrade
            ? `Upgrading to L${selectedTower.upgrade.targetLevel}…`
            : "Operational";
      rows.push(<div key="tower-status">{status}</div>);
      if (isStructureActive(selectedTower)) {
        rows.push(
          <div key="tower-stats">
            Range {towerRange(tweaks, selectedTower.level, terrainAt(world.seed, selectedTower.coord))} tiles,
            damage {towerDamage(tweaks, selectedTower.level).toFixed(1)} DPS
          </div>,
        );
      }
    }
    if (selectedPowerStation) {
      const status = selectedPowerStation.buildStartedAt
        ? "Under construction"
        : selectedPowerStation.damaged
          ? selectedPowerStation.damageRepair
            ? "Repairing…"
            : "Damaged"
          : selectedPowerStation.upgrade
            ? `Upgrading to L${selectedPowerStation.upgrade.targetLevel}…`
            : "Operational";
      rows.push(<div key="power-station-status">{status}</div>);
      if (isStructureActive(selectedPowerStation)) {
        rows.push(
          <div key="power-station-stats">
            Capacity {powerStationCapacity(tweaks, selectedPowerStation.level).toFixed(0)}, AoE{" "}
            {powerStationAoeRadius(tweaks, selectedPowerStation.level)} tiles
          </div>,
        );
      }
      rows.push(
        <div key="power-station-network">
          Network draw {powerNetwork.totalDraw.toFixed(0)}/{powerNetwork.totalCapacity.toFixed(0)} (
          {Math.round(powerNetwork.factor * 100)}%)
        </div>,
      );
    }
    if (selectedScrapYard) {
      const status = selectedScrapYard.buildStartedAt
        ? "Under construction"
        : selectedScrapYard.damaged
          ? selectedScrapYard.damageRepair
            ? "Repairing…"
            : "Damaged"
          : selectedScrapYard.upgrade
            ? `Upgrading to L${selectedScrapYard.upgrade.targetLevel}…`
            : "Operational";
      const yardCourierAutomated = structureHasCourierAutomation(selectedScrapYard.level);
      const scrapYield = scrapYardYieldPerSecond(
        tweaks,
        world.seed,
        selectedScrapYard,
        scrapStashes,
        hexResourcePools,
        territory,
        scoutedTiles,
        gridSize,
        powerNetwork,
      );
      rows.push(<div key="scrap-yard-status">{status}</div>);
      if (isStructureActive(selectedScrapYard)) {
        rows.push(<div key="scrap-yard-yield">Yield: {scrapYield.toFixed(1)} steel/sec</div>);
      }
      rows.push(
        <div key="scrap-yard-stockpile">Stockpile: {Math.floor(selectedScrapYard.stockpile)} steel</div>,
        <div key="scrap-yard-courier">
          {yardCourierAutomated
            ? selectedScrapYard.courier
              ? selectedScrapYard.courier.phase === "toBase"
                ? "Courier — delivering to base"
                : "Courier — returning"
              : "Courier — automated collection"
            : "Manual collection only (upgrade to L2 to automate)"}
        </div>,
        <div key="scrap-yard-scrapper">{scrapperStatusText(selectedScrapYard)}</div>,
      );
    }
    if (selectedPowerDrawText) {
      rows.push(<div key="power-draw">{selectedPowerDrawText}</div>);
    }
    if (selectedPowerStateLabel) {
      rows.push(<div key="power-state">{selectedPowerStateLabel}</div>);
    }
    if (selectedScrapStash) {
      rows.push(
        <div key="scrap-steel">
          Steel remaining:{" "}
          {formatRemainingResource(
            remainingResourceAt(world.seed, selectedScrapStash.coord, hexResourcePools, tweaks),
            tweaks,
          )}
        </div>,
        <div key="scrap-hint">
          {scrapRichnessHint(
            hexTileLevel(world.seed, selectedScrapStash.coord, tweaks),
            tweaks.hex_resource_pools.tile_level_max,
          )}
        </div>,
        <div key="scrap-note">Build a Scrap Yard and send a Scrapper to haul steel here.</div>,
      );
    }
    if (selectedTombstone) {
      const lost =
        selectedTombstone.militiaLost +
        selectedTombstone.junkyardKnightLost +
        selectedTombstone.crossBowSniperLost;
      const cause =
        selectedTombstone.cause.kind === "horde_blocked"
          ? `Horde (${selectedTombstone.cause.hordeSize}) vs party power ${selectedTombstone.attackPower}`
          : `Tile defense ${selectedTombstone.cause.defense} vs party power ${selectedTombstone.attackPower}`;
      rows.push(
        <div key="tombstone">
          Tombstone — lost {lost}; {cause}. Fades in{" "}
          {formatDuration(Math.max(0, selectedTombstone.expiresAt - now))}
        </div>,
      );
    }
    if (rows.length === 0) return null;
    return <>{rows}</>;
  }

  /** Short header label for the tile action sheet. */
  function selectedSheetTitle(): string {
    if (!selected) return "Selected tile";
    if (selectedIsBase) return `Base — L${base.level}`;
    if (selectedOutpost) return `Outpost — L${selectedOutpost.reinforcementLevel}`;
    if (selectedDen) return `Den — L${selectedDen.level}`;
    if (selectedScrapStash) return "Scrap stash";
    if (selectedIsLab) return "Research lab";
    if (selectedDock) return `Dock — L${dockLevel(selectedDock)}`;
    if (selectedBarracks) return `Barracks — L${selectedBarracks.level}`;
    if (selectedTower) return `Tower — L${selectedTower.level}`;
    if (selectedPowerStation) return `Power station — L${selectedPowerStation.level}`;
    if (selectedScrapYard) return `Scrap yard — L${selectedScrapYard.level}`;
    if (selectedWall) return `Wall — ${selectedWall.tier}`;
    if (selectedTile) return `${selectedTile.resource} — ${selectedTile.tier}`;
    if (selectedEmpty) return isOwned(selected) ? "Empty tile" : isScouted(selected) ? "Scouted tile" : "Unexplored tile";
    return "Selected tile";
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
        : base.action
          ? base.action.kind === "level_upgrade"
            ? `Upgrading to L${base.action.targetLevel}…`
            : base.action.kind === "reinforcement_upgrade"
              ? `Upgrading reinforcement to L${base.action.targetLevel}…`
              : "Repairing…"
          : "Operational";
      const maxHp = baseReinforcementHp(tweaks, base.reinforcementLevel);
      return (
        <HoverPanel icon={structureIcon(structureLevelCandidates("base", base.level), 28)} title={`Base — L${base.level}`} status={status}>
          <span>HP: {Math.floor(base.currentHp)}/{Math.floor(maxHp)}</span>
          <span>Noise cap: {noiseCap(tweaks, base.level)}db</span>
          <span>
            Build slots:{" "}
            {formatBuildSlots(
              totalStructureCount(
                tweaks,
                extractionTiles,
                towers,
                walls,
                barracksList,
                docks,
                powerStations,
                scrapYards,
              ),
            )}
            /{formatBuildSlots(buildSlotCap(tweaks, base.level))}
          </span>
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

    const scrapStash =
      isOwned(coord) || isScouted(coord)
        ? scrapStashes.find((s) => isActiveScrapStash(tweaks, world.seed, hexResourcePools, s) && axialEquals(s.coord, coord))
        : undefined;
    if (scrapStash) {
      return (
        <HoverPanel icon={<Archive size={22} />} title="Scrap stash" status="Salvage site">
          <span>
            Steel remaining:{" "}
            {formatRemainingResource(
              remainingResourceAt(world.seed, scrapStash.coord, hexResourcePools, tweaks),
              tweaks,
            )}
          </span>
          <span>
            {scrapRichnessHint(
              hexTileLevel(world.seed, scrapStash.coord, tweaks),
              tweaks.hex_resource_pools.tile_level_max,
            )}
          </span>
        </HoverPanel>
      );
    }

    if ((isScouted(coord) || isOwned(coord)) && axialEquals(lab.coord, coord)) {
      const status = lab.secured ? "Secured" : "Guarded";
      return (
        <HoverPanel icon={<FlaskConical size={22} />} title="Research lab" status={status}>
          {!lab.secured && <span>Guardian defense: {lab.guardianDefense.toFixed(0)}</span>}
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
            ? `Upgrading to ${extractionTierDisplayLabel(tile.upgrade.targetTier)}…`
            : "Operational";
      const automated = structureHasCourierAutomation(extractionTierLevel(tile.tier));
      return (
        <HoverPanel
          icon={structureIcon(extractionTierCandidates(tile.resource, tile.tier), 28, resourceIcon(tile.resource, 28))}
          title={`${capitalize(tile.resource)} — ${extractionTierDisplayLabel(tile.tier)}`}
          status={status}
        >
          {isStructureActive(tile) && (
            <span>
              Yield: {yieldPerSecond(tweaks, tile, world.seed).toFixed(1)} {tile.resource}/sec
            </span>
          )}
          <span>
            {automated
              ? tile.courier
                ? tile.courier.phase === "toBase"
                  ? "Courier delivering to base"
                  : "Courier returning"
                : "Courier automated"
              : "Manual collection (L2 automates)"}
          </span>
          <span>Stockpile: {Math.floor(tile.stockpile)}</span>
          <span>
            Hex remaining:{" "}
            {formatRemainingResource(
              remainingResourceAt(world.seed, tile.coord, hexResourcePools, tweaks),
              tweaks,
            )}
          </span>
          <span>{powerDrawText("extraction", extractionTierLevel(tile.tier))}</span>
          {powerStateLabelFor(extractionTierLevel(tile.tier), tile.coord) && (
            <span>{powerStateLabelFor(extractionTierLevel(tile.tier), tile.coord)}</span>
          )}
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
        <HoverPanel icon={structureIcon(structureLevelCandidates("tower", tower.level), 28)} title={`Tower — L${tower.level}`} status={status}>
          {isStructureActive(tower) && (
            <>
              <span>Range: {towerRange(tweaks, tower.level, terrainAt(world.seed, tower.coord))} tiles</span>
              <span>Damage: {towerDamage(tweaks, tower.level).toFixed(1)} DPS</span>
            </>
          )}
          <span>Noise floor: +{towerFloorContribution(tweaks, tower).toFixed(1)}db</span>
          <span>{powerDrawText("tower", tower.level)}</span>
          {powerStateLabelFor(tower.level, tower.coord) && <span>{powerStateLabelFor(tower.level, tower.coord)}</span>}
        </HoverPanel>
      );
    }

    const powerStation = powerStationAt(coord);
    if (powerStation) {
      const status = powerStation.buildStartedAt
        ? "Under construction"
        : powerStation.damaged
          ? powerStation.damageRepair
            ? "Repairing…"
            : "Damaged"
          : powerStation.upgrade
            ? `Upgrading to L${powerStation.upgrade.targetLevel}…`
            : "Operational";
      return (
        <HoverPanel
          icon={structureIcon(powerStationTierIconName(powerStation.level), 28, <Zap size={22} />)}
          title={`Power station — L${powerStation.level}`}
          status={status}
        >
          {isStructureActive(powerStation) && (
            <>
              <span>Capacity: {powerStationCapacity(tweaks, powerStation.level).toFixed(0)}</span>
              <span>AoE: {powerStationAoeRadius(tweaks, powerStation.level)} tiles</span>
            </>
          )}
          <span>Noise floor: +{powerStationFloorContribution(tweaks, powerStation).toFixed(1)}db</span>
        </HoverPanel>
      );
    }

    const scrapYard = scrapYardAt(coord);
    if (scrapYard) {
      const status = scrapYard.buildStartedAt
        ? "Under construction"
        : scrapYard.damaged
          ? scrapYard.damageRepair
            ? "Repairing…"
            : "Damaged"
          : scrapYard.upgrade
            ? `Upgrading to L${scrapYard.upgrade.targetLevel}…`
            : "Operational";
      const yardCourierAutomated = structureHasCourierAutomation(scrapYard.level);
      const scrapYield = scrapYardYieldPerSecond(
        tweaks,
        world.seed,
        scrapYard,
        scrapStashes,
        hexResourcePools,
        territory,
        scoutedTiles,
        gridSize,
        powerNetwork,
      );
      return (
        <HoverPanel
          icon={structureIcon(scrapYardSpriteCandidates(scrapYard.level), 28, resourceIcon("steel", 22))}
          title={`Scrap yard — L${scrapYard.level}`}
          status={status}
        >
          {isStructureActive(scrapYard) && (
            <span>Yield: {scrapYield.toFixed(1)} steel/sec</span>
          )}
          <span>
            {yardCourierAutomated
              ? scrapYard.courier
                ? scrapYard.courier.phase === "toBase"
                  ? "Courier delivering to base"
                  : "Courier returning"
                : "Courier automated"
              : "Manual collection (L2 automates)"}
          </span>
          <span>Stockpile: {Math.floor(scrapYard.stockpile)} steel</span>
          <span>{scrapperStatusText(scrapYard)}</span>
          <span>Noise floor: +{scrapYardFloorContribution(tweaks, scrapYard).toFixed(1)}db</span>
          <span>{powerDrawText("scrap_yard", scrapYard.level)}</span>
          {powerStateLabelFor(scrapYard.level, scrapYard.coord) && (
            <span>{powerStateLabelFor(scrapYard.level, scrapYard.coord)}</span>
          )}
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
          <span>{powerDrawText("wall", WALL_TIER_LEVEL[wall.tier])}</span>
          {powerStateLabelFor(WALL_TIER_LEVEL[wall.tier], wall.coord) && (
            <span>{powerStateLabelFor(WALL_TIER_LEVEL[wall.tier], wall.coord)}</span>
          )}
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
      return (
        <HoverPanel
          icon={structureIcon(structureLevelCandidates("barracks", barracks.level), 28)}
          title={`Barracks — L${barracks.level}`}
          status={status}
        >
          <span>{powerDrawText("barracks", barracks.level)}</span>
          {powerStateLabelFor(barracks.level, barracks.coord) && <span>{powerStateLabelFor(barracks.level, barracks.coord)}</span>}
        </HoverPanel>
      );
    }

    const dock = dockAt(coord);
    if (dock) {
      const level = dockLevel(dock);
      const status = dock.buildStartedAt
        ? "Under construction"
        : dock.upgrade
          ? `Upgrading to L${dock.upgrade.targetLevel}…`
          : dock.fishingBoatUpgrade
            ? "Upgrading to L3…"
            : "Operational";
      const automated = structureHasCourierAutomation(level);
      return (
        <HoverPanel
          icon={structureIcon(dockSpriteCandidates(level), 28)}
          title={`Dock — L${level}`}
          status={status}
        >
          {!dock.buildStartedAt && <span>Yield: {dockYieldPerSecond(tweaks, dock).toFixed(1)} food/sec</span>}
          <span>
            {automated
              ? dock.courier
                ? dock.courier.phase === "toBase"
                  ? "Courier delivering to base"
                  : "Courier returning"
                : "Courier automated"
              : "Manual collection (L2 automates)"}
          </span>
          <span>Stockpile: {Math.floor(dock.stockpile)}</span>
          <span>
            Hex remaining:{" "}
            {formatRemainingResource(
              remainingResourceAt(world.seed, dock.coord, hexResourcePools, tweaks),
              tweaks,
            )}
          </span>
        </HoverPanel>
      );
    }

    const tombstone = tombstones.find((t) => axialEquals(t.coord, coord));
    if (tombstone) {
      const lost = tombstone.militiaLost + tombstone.junkyardKnightLost + tombstone.crossBowSniperLost;
      const cause =
        tombstone.cause.kind === "horde_blocked"
          ? `Horde (${tombstone.cause.hordeSize}) vs power ${tombstone.attackPower}`
          : `Defense ${tombstone.cause.defense} vs power ${tombstone.attackPower}`;
      return (
        <HoverPanel icon={<Info size={22} />} title="Tombstone" status={`Fades in ${formatDuration(Math.max(0, tombstone.expiresAt - now))}`}>
          <span>Lost: {lost} unit{lost === 1 ? "" : "s"}</span>
          <span>{cause}</span>
        </HoverPanel>
      );
    }

    return null;
  }

  /** Party sitting on a hex waiting for arrival orders (#73). */
  function awaitingExpeditionAt(coord: Axial): Expedition | null {
    return (
      expeditions.find(
        (e) =>
          e.phase === "awaitingOrders" &&
          axialEquals(e.path[e.path.length - 1] ?? e.target, coord),
      ) ?? null
    );
  }

  /** Reinforce form row for an awaiting host — shared by notification → tile and sheet Party orders. */
  function reinforceSheetActionFor(host: Expedition): SheetAction | null {
    const joinTile = host.path[host.path.length - 1] ?? host.target;
    const route = findBestExpeditionRoute(
      tweaks,
      world.seed,
      barracksList,
      towers,
      outposts,
      territory,
      scoutedTiles,
      gridSize,
      joinTile,
    );
    if (!route) return null;
    const partySize = militiaToSend + junkyardKnightToSend + crossBowSniperToSend;
    const provisionsCost = { food: reinforceProvisionsCost(tweaks, partySize, route.cost) };
    const option: ExpeditionOption = {
      distanceTiles: route.path.length - 1,
      pathCost: route.cost,
      provisionsCost,
      affordable: affordable(provisionsCost),
      etaMs: reinforceTravelDurationMs(tweaks, route.cost, troopSpeedMultiplier(tweaks, research)),
    };
    return {
      key: "arrival-send-help",
      icon: <Swords size={18} />,
      title: "Reinforce",
      detail: costDetail(provisionsCost, undefined, "½ cost/time — "),
      disabled: !option.affordable,
      formContent: dispatchFormContent(
        option,
        <span>Path known & cleared — half provisions and travel time.</span>,
        "Send reinforcements",
        () => {
          void (async () => {
            const result = await onReinforceExpedition(
              host.id,
              militiaToSend,
              junkyardKnightToSend,
              crossBowSniperToSend,
            );
            applyActionResult(result);
          })();
        },
      ),
    };
  }

  /**
   * Arrival decision options on the destination tile sheet — same choices as the
   * notification tray, for players who look at the map/tile first (#73).
   */
  function arrivalOrdersCategoryFor(coord: Axial): SheetAction | null {
    const host = awaitingExpeditionAt(coord);
    if (!host) return null;
    const remaining = Math.max(0, (host.decisionDeadlineAt ?? now) - now);
    const partySize =
      host.militiaCommitted + host.junkyardKnightCommitted + host.crossBowSniperCommitted;
    const reinforce = reinforceSheetActionFor(host);
    const subActions: SheetAction[] = [
      {
        key: "arrival-redeploy",
        icon: <Navigation size={18} />,
        title: "Redeploy",
        detail: "Pick a new destination — current party marches on",
        onClick: () => {
          setRedeployExpeditionId(host.id);
          setActionError(null);
          setSelected(null);
        },
      },
    ];
    if (reinforce) subActions.push(reinforce);
    subActions.push(
      {
        key: "arrival-garrison",
        icon: <Shield size={18} />,
        title: "Garrison",
        detail: `Station ${partySize} unit${partySize === 1 ? "" : "s"} here`,
        onClick: () => {
          void onGarrisonExpedition(host.id).then((result) => {
            applyActionResult(result);
            if (result.ok) setSelected(null);
          });
        },
      },
      {
        key: "arrival-recall",
        icon: <Undo2 size={18} />,
        title: "Recall",
        detail: "March home now",
        onClick: () => {
          void onRecallExpedition(host.id).then((result) => {
            applyActionResult(result);
            if (result.ok) setSelected(null);
          });
        },
      },
    );
    return {
      key: "arrival-orders",
      icon: <Footprints size={18} />,
      title: "Party orders",
      detail: `Auto-recall ${formatDuration(remaining)}`,
      subActions,
    };
  }

  /**
   * The full sheet action tree for the selected tile: structural actions
   * (above) plus the universal, structure-independent actions available on
   * any owned tile — Collect, Garrison (a form), and Demolish. Folding them
   * in here as its own layer keeps structuralActionsFor's tile-type
   * branching untouched.
   */
  function sheetActionsFor(countdownRows: NotificationCountdownRow[]): SheetAction[] {
    if (!selected) return [];
    const actions = structuralActionsFor();

    const arrivalOrders = arrivalOrdersCategoryFor(selected);
    if (arrivalOrders) {
      actions.unshift(arrivalOrders);
    }

    const inProgressRows = countdownRows.filter(
      (row) => row.coord != null && axialEquals(row.coord, selected),
    );
    if (inProgressRows.length > 0) {
      actions.unshift({
        key: "in-progress",
        icon: <Hammer size={18} />,
        title: "In progress",
        subActions: inProgressRows.map((row) => ({
          key: `busy-${row.key}`,
          icon: row.icon,
          title: row.label,
          detail: `${formatDuration(row.remainingMs)} remaining`,
        })),
      });
    }

    // Unlike Collect/Garrison/Demolish below, Info isn't owned-tile-only — a
    // tombstone can sit on unowned ground, so this is pushed before the
    // isOwned gate rather than after it.
    const info = infoSheetContent();
    if (info) {
      actions.push({ key: "info", icon: <Info size={18} />, title: "Info", infoContent: info });
    }

    // Scrap stashes may sit on scouted (unowned) hexes — Send Scrapper still applies.
    if (selectedScrapStash) {
      const hasIdleScrapper = scrapYards.some((y) => {
        if (!y.scrapperReady || !isStructureActive(y)) return false;
        const trip = y.scrapper;
        return !trip || trip.phase === "idle";
      });
      actions.push({
        key: "send-scrapper",
        icon: <HardHat size={18} />,
        title: "Send Scrapper",
        detail: hasIdleScrapper
          ? "Nearest ready idle yard"
          : "No idle Scrapper ready",
        disabled: !hasIdleScrapper,
        onClick: handleSendScrapperFromStash,
      });
    }

    if (!isOwned(selected)) return actions;

    if (selectedTile && !selectedTile.damaged && selectedTile.stockpile > 0) {
      actions.push({
        key: "collect",
        icon: <PackageCheck size={18} />,
        title: "Collect",
        detail: `${Math.floor(selectedTile.stockpile)} stockpiled`,
        onClick: handleCollect,
      });
    }
    if (selectedDock && !selectedDock.buildStartedAt && selectedDock.stockpile > 0) {
      actions.push({
        key: "collect-dock",
        icon: <PackageCheck size={18} />,
        title: "Collect",
        detail: `${Math.floor(selectedDock.stockpile)} stockpiled`,
        onClick: handleCollectDock,
      });
    }
    if (selectedScrapYard && !selectedScrapYard.damaged && selectedScrapYard.stockpile > 0) {
      actions.push({
        key: "collect-scrap-yard",
        icon: <PackageCheck size={18} />,
        title: "Collect",
        detail: `${Math.floor(selectedScrapYard.stockpile)} steel stockpiled`,
        onClick: handleCollectScrapYard,
      });
    }

    // Non-base: leaf under Actions usually; promote to a preferDefault Garrison
    // tab when a horde is in strike range so the player lands on the form.
    if (!selectedIsBase) {
      const threatened = selectedThreatenedByHorde();
      if (threatened) {
        const garrisonCat = garrisonCategoryAction(true);
        if (garrisonCat) actions.push(garrisonCat);
      } else {
        const garrison = garrisonSheetAction();
        if (garrison) actions.push(garrison);
      }
    }

    const canDemolishHere = !selectedIsBase && (!!selectedStructure || !!selectedDock);
    const demolishBlocked =
      (!!selectedTile && hasAnyStructureTask(selectedTile)) ||
      (!!selectedTower && hasAnyStructureTask(selectedTower)) ||
      (!!selectedPowerStation && hasAnyStructureTask(selectedPowerStation)) ||
      (!!selectedScrapYard && hasAnyStructureTask(selectedScrapYard)) ||
      (!!selectedWall && hasAnyStructureTask(selectedWall)) ||
      (!!selectedBarracks && hasAnyStructureTask(selectedBarracks)) ||
      (!!selectedDock && countDockTasks(selectedDock) > 0);
    if (canDemolishHere) {
      actions.push({
        key: "demolish",
        icon: <Trash2 size={18} />,
        title: "Demolish",
        disabled: demolishBlocked,
        onClick: handleDemolish,
      });
    }

    return actions;
  }
  const countdownRows = activeCountdownRows();
  const sheetActions = sheetActionsFor(countdownRows);
  const structureProgressMap = structureProgressByKey(countdownRows);
  // Suppressed on the currently-selected tile — the action sheet (and Info
  // filter, where applicable) already covers the same ground, and the two
  // floating panels would otherwise visually collide.
  const hoverInfoContent =
    hoveredCoord && !(selected && axialEquals(hoveredCoord, selected)) ? hoverInfoFor(hoveredCoord) : null;
  /** Only one lab — at most one assault; elevate it out of the notification tray. */
  const activeLabAssault = labAssaults[0] ?? null;

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <div style={{ position: "absolute", inset: 0 }}>
        <HexCanvas
          ref={hexCanvasRef}
          seed={world.seed}
          gridSize={gridSize}
          tweaks={tweaks}
          base={territory.base}
          baseLevel={base.level}
          baseCurrentHp={base.currentHp}
          baseMaxHp={baseReinforcementHp(tweaks, base.reinforcementLevel)}
          upgradeAvailableKeys={upgradeAvailableKeys}
          buildModeEligibleKeys={buildModeEligibleKeys}
          structureProgressByKey={structureProgressMap}
          owned={territory.owned}
          extractionTiles={extractionTiles}
          towers={towers}
          walls={walls}
          barracksList={barracksList}
          powerStations={powerStations}
          scrapYards={scrapYards}
          garrisons={garrisons}
          scoutedTiles={scoutedTiles}
          lab={lab}
          dens={dens}
          scrapStashes={scrapStashes}
          hexResourcePools={hexResourcePools}
          outposts={outposts}
          hordes={hordes}
          expeditions={expeditions}
          denAssaults={denAssaults}
          labAssaults={labAssaults}
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
          fogDisabled={import.meta.env.DEV && mapRevealed}
          devLabMode={import.meta.env.DEV ? devLabMode : "off"}
        />
      </div>
      {activeLabAssault && (
        <LabAssaultCeremony
          assault={activeLabAssault}
          now={now}
          onGoToTile={goToTile}
          onRecall={(id) => {
            void onRecallLabAssault(id).then(applyActionResult);
          }}
          onBannerHeight={handleLabAssaultBannerHeight}
        />
      )}
      <ResourceHud
        resources={resources}
        resourceRates={resourceRates}
        noiseValue={noise.value}
        topOffset={labAssaultBannerHeight}
        onLayoutMetrics={handleResourceHudLayout}
      />
      {actionError && (
        <div
          onClick={() => setActionError(null)}
          style={{
            position: "fixed",
            top:
              labAssaultBannerHeight > 0
                ? `calc(${labAssaultBannerHeight}px + 4.5rem)`
                : "4.5rem",
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
      <HoverTooltip ref={hoverTooltipRef} coord={hoveredCoord} content={hoverInfoContent} />
      <CollectPinOverlay ref={collectPinOverlayRef} tiles={collectableTiles} onCollect={handleQuickCollect} />
      <PowerStatusPinOverlay ref={powerStatusPinOverlayRef} pins={powerStatusPins} />
      {selected && sheetActions.length > 0 && (
        <TileActionSheet
          key={axialKey(selected)}
          title={selectedSheetTitle()}
          actions={sheetActions}
          onClose={() => setSelected(null)}
        />
      )}
      <GlobalHexCluster
        pinnedSlots={
          import.meta.env.DEV
            ? undefined
            : [
                {
                  key: "fast-forward",
                  icon: <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>{speedMultiplier > 1 ? `${speedMultiplier}x` : "▶"}</span>,
                  title: "Playtesting only — cycles speed, scaling resource/noise/horde simulation AND every build/upgrade/training timer",
                  active: speedMultiplier > 1,
                  onClick: onCycleFastForward,
                },
              ]
        }
        slots={[
          {
            key: "garrisons",
            icon: <Flag size={20} />,
            title: "Garrisons",
            active: openPanel === "garrisons",
            onClick: () => toggleOpenPanel("garrisons"),
          },
          {
            key: "intelligence",
            icon: <Binoculars size={20} />,
            title: "Intelligence",
            active: openPanel === "intelligence",
            onClick: () => toggleOpenPanel("intelligence"),
          },
          {
            key: "personnel",
            icon: <Swords size={20} />,
            title: "Personnel",
            active: openPanel === "personnel",
            onClick: () => toggleOpenPanel("personnel"),
          },
          {
            key: "research",
            icon: <FlaskConical size={20} />,
            title: "Research",
            // Also lit up while a research is in progress, not just while the panel is open — mirrors the old floating button's "something's happening" cue.
            active: openPanel === "research" || Boolean(research.pending),
            // Orange cue when a research is startable (affordable + slot free); takes precedence over green active.
            highlight: hasStartableResearch(tweaks, research, resources) ? UPGRADE_AVAILABLE_BADGE_COLOR : undefined,
            onClick: () => toggleOpenPanel("research"),
          },
          // Build mode (affordable empty-tile tint) parked — low value; leave state/logic below to re-enable.
          // {
          //   key: "build-mode",
          //   icon: <Hammer size={20} />,
          //   title: buildModeActive ? "Exit build mode" : "Build mode",
          //   active: buildModeActive,
          //   onClick: () => setBuildModeActive((v) => !v),
          // },
          {
            key: "settings",
            icon: <Settings size={20} />,
            title: "Settings",
            active: openPanel === "settings",
            onClick: () => toggleOpenPanel("settings"),
          },
          ...(import.meta.env.DEV
            ? [
                {
                  key: "dev",
                  icon: <span style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.04em" }}>DEV</span>,
                  title: "Dev tools",
                  active: openPanel === "dev" || mapRevealed || devLabMode !== "off" || speedMultiplier === 10,
                  onClick: () => toggleOpenPanel("dev"),
                },
              ]
            : []),
        ]}
      />
      <MapControls
        onZoomIn={() => hexCanvasRef.current?.zoomBy(1.1)}
        onZoomOut={() => hexCanvasRef.current?.zoomBy(1 / 1.1)}
        onRecenterOnBase={() => hexCanvasRef.current?.recenterOnBase()}
      />
      {openPanel === "garrisons" && (
        <GarrisonsPanel garrisons={garrisons} garrisonRecalls={garrisonRecalls} now={now} onClose={() => setOpenPanel(null)} />
      )}
      {openPanel === "intelligence" && (
        <IntelligencePanel
          tweaks={tweaks}
          lab={lab}
          base={territory.base}
          onClose={() => setOpenPanel(null)}
        />
      )}
      {openPanel === "personnel" && (
        <PersonnelPanel
          tweaks={tweaks}
          units={units}
          garrisons={garrisons}
          barracksList={barracksList}
          scoutSkiffs={scoutSkiffs}
          wanderingScouts={wanderingScouts}
          commitments={{
            garrisons,
            expeditions,
            denAssaults,
            garrisonRecalls,
            labAssaults,
          }}
          onClose={() => setOpenPanel(null)}
        />
      )}
      {openPanel === "settings" && (
        <SettingsPanel
          player={player}
          seed={world.seed}
          onSaveToFile={onSaveToFile}
          onLoadFromFile={onLoadFromFile}
          onReplayCurrent={onReplayCurrent}
          onStartNewSeed={onStartNewSeed}
          onNewPlayer={onNewPlayer}
          onClose={() => setOpenPanel(null)}
        />
      )}
      {import.meta.env.DEV && openPanel === "dev" && (
        <DevToolsPanel
          fogDisabled={mapRevealed}
          speed10x={speedMultiplier === 10}
          labMode={devLabMode}
          onToggleFog={handleDevToggleFog}
          onToggleSpeed10x={handleDevToggleSpeed10x}
          onCycleLabMode={handleDevCycleLabMode}
          onRerollSeed={handleDevRerollSeed}
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
      <div
        style={{
          position: "fixed",
          right: "1rem",
          top: (() => {
            const belowHud =
              resourceHudLayout.scale < 1 && resourceHudLayout.height > 0
                ? resourceHudLayout.height + 0.35 * 16
                : 0;
            if (labAssaultBannerHeight > 0) {
              return `${labAssaultBannerHeight + belowHud + 0.45 * 16}px`;
            }
            return belowHud > 0
              ? `calc(max(0.65rem, env(safe-area-inset-top, 0px)) + ${belowHud}px)`
              : "max(0.65rem, env(safe-area-inset-top, 0px))";
          })(),
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.35rem",
          /* Width is per-row (compact 320px vs wider arrival decisions) — don't clip children here. */
          maxWidth: "min(96vw, 720px)",
          zIndex: 40,
        }}
      >
        <ToastStack toasts={toasts} onDismiss={onDismissToast} onGoToTile={goToTile} />
        <NotificationTray
          expeditions={expeditions}
          denAssaults={denAssaults}
          garrisonRecalls={garrisonRecalls}
          siegedDens={dens
            .filter((d) => d.siege)
            .map((d) => ({
              coord: d.coord,
              holdRemainingMs: remainingMs(d.siege!.startedAt, tweaks.dens.siege.hold_duration_minutes * 60_000, now),
            }))}
          countdowns={countdownRows}
          now={now}
          onGoToTile={goToTile}
          onRecallExpedition={(id) => {
            void onRecallExpedition(id).then(applyActionResult);
          }}
          onGarrisonExpedition={(id) => {
            void onGarrisonExpedition(id).then(applyActionResult);
          }}
          onBeginRedeploy={(id) => {
            setRedeployExpeditionId(id);
            setActionError(null);
            setSelected(null);
          }}
          onBeginReinforce={(id) => {
            setRedeployExpeditionId(null);
            const host = expeditions.find((e) => e.id === id);
            if (host) {
              const tile = host.path[host.path.length - 1] ?? host.target;
              goToTile(tile);
            }
          }}
          onRecallDenAssault={(id) => {
            void onRecallDenAssault(id).then(applyActionResult);
          }}
        />
      </div>
    </div>
  );
}
