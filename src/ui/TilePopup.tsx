import type { Axial } from "../engine/hexCoords";
import type { ExtractionTier, ExtractionTile } from "../data/extractionTiles";
import type { PathTier, PathTile } from "../data/pathTiles";
import type { Tower } from "../data/towers";
import type { Wall, WallTier } from "../data/walls";
import type { Barracks } from "../data/barracks";
import type { DockRecord } from "../data/docks";
import type { DenRecord } from "../data/dens";
import type { LabRecord } from "../data/lab";
import type { OutpostRecord } from "../data/outposts";
import type { TombstoneRecord } from "../data/tombstones";
import type { ResourceType } from "../data/resources";
import type { TerrainType } from "../engine/terrain";
import { formatCost, formatDuration } from "./format";

export interface BuildOption {
  resource: ResourceType;
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  durationMinutes: number;
}

export interface TierUpgradeOption {
  targetTier: ExtractionTier;
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  durationMinutes: number;
}

export interface StorageUpgradeOption {
  resource: ResourceType;
  level: number;
  capacity: number;
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  /** Non-null while this resource's storage upgrade is in progress — remainingMs counts down to the level bump. */
  inProgress: { targetLevel: number; remainingMs: number } | null;
}

export interface PathBuildOption {
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  durationMinutes: number;
}

export interface PathUpgradeOption {
  targetTier: PathTier;
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  durationMinutes: number;
}

export interface SimpleCostOption {
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
}

/** Same shape as WallRepairOption but not wall-specific — used by base/outpost repair, the shared 5-structure damage repair, and the initial construction of a tower/wall/barracks (also cost+duration, just not a repair), all timed. */
export interface RepairOption {
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  durationMinutes: number;
}

export interface SkiffBuildOption {
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  durationMinutes: number;
}

/** Costs regular scouts from the stockpile, on top of a resource cost — unlike every other SimpleCostOption. */
export interface WanderingScoutOption {
  scoutCost: number;
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  durationMinutes: number;
}

export interface TowerUpgradeOption {
  targetLevel: number;
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  durationMinutes: number;
}

export interface WallUpgradeOption {
  targetTier: WallTier;
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  durationMinutes: number;
}

export interface WallRepairOption {
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  durationMinutes: number;
}

export interface BarracksUpgradeOption {
  targetLevel: number;
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  durationMinutes: number;
}

export interface BaseUpgradeOption {
  targetLevel: number;
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  durationMs: number;
}

/** Timed like every other upgrade — see engine/base.ts:baseReinforcementUpgradeDurationMs. Null while an upgrade or repair is already in progress (reinforcementActionStatus/outpostReinforcementActionStatus). */
export interface ReinforcementUpgradeOption {
  targetLevel: number;
  /** Resulting total reinforcement HP after this upgrade. */
  hp: number;
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  durationMs: number;
}

/** Base/outpost reinforcement upgrade and repair share one in-progress slot — mirrors WallActionStatus. */
export type ReinforcementActionStatus =
  | { kind: "upgrade"; targetLevel: number; remainingMs: number }
  | { kind: "repair"; remainingMs: number };

/** Null when this tile isn't a valid relocation destination (base level too low, already relocating, unknown ground, water, occupied, or the base's own tile) — engine/base.ts:canRelocateBase/baseRelocationCost. */
export interface RelocationOption {
  distanceTiles: number;
  cost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  durationMs: number;
}

/** Null when there's no known route (no barracks, or the tile isn't reachable through owned-or-scouted ground) — engine/expeditions.ts:findBestExpeditionRoute. */
export interface ExpeditionOption {
  /** Tiles crossed, path.length - 1 (excludes the origin barracks tile itself). */
  distanceTiles: number;
  /** Accumulated terrain cost of the route (engine/pathfinding.ts) — what provisions/ETA actually scale off, not distanceTiles. */
  pathCost: number;
  provisionsCost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  etaMs: number;
}

/** Same shape as ExpeditionOption (a den assault is dispatched/resolved exactly like an expedition) plus the den's own defense value, shown so the assault isn't blind. */
export interface DenAssaultOption extends ExpeditionOption {
  denDefense: number;
}

/** Non-null only while a den is under siege (engine/dens.ts:resolveHoldPeriod) — the hold-period countdown and next last-stand wave's size, so the player knows how much time/defense they need. */
export interface DenSiegeStatus {
  holdRemainingMs: number;
  nextWaveInMs: number;
  nextWaveSize: number;
  /** garrison + in-range towers + neighboring walls (engine/dens.ts:holdDefenseAt) — a garrison alone is enough if this already clears nextWaveSize; towers/walls are additive options, not a requirement. */
  currentDefense: number;
}

/** Non-null only while a party is in transit toward this den (dispatched, not yet arrived) — see GameScreen.tsx:denAssaultInProgressFor. */
export interface DenAssaultInProgress {
  etaMs: number;
}

/** Same shape as ExpeditionOption plus the lab's static guardian defense — see GameScreen.tsx:labAssaultOptionFor. */
export interface LabAssaultOption extends ExpeditionOption {
  guardianDefense: number;
}

/** Non-null only while a party is in transit toward the lab — see GameScreen.tsx:labAssaultInProgress. */
export interface LabAssaultInProgress {
  etaMs: number;
}

/** Non-null only while a garrison recalled from this tile hasn't finished marching home yet — see GameScreen.tsx:recallInProgressFor. */
export interface RecallInProgress {
  militia: number;
  junkyardKnight: number;
  crossBowSniper: number;
  etaMs: number;
}

/** { targetTier|targetLevel, remainingMs } — mirrors baseUpgradeInProgress's shape for consistency across all 5 structure types. */
export interface UpgradeInProgress<TTarget> {
  target: TTarget;
  remainingMs: number;
}

export type WallActionStatus =
  | { kind: "upgrade"; targetTier: WallTier; remainingMs: number }
  | { kind: "repair"; remainingMs: number };

/** Recomputed by the caller whenever the requested quantity changes, so `totalCost`/`affordable` always match the current input value. */
export interface TrainOption {
  totalCost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  maxQuantity: number;
  /** Noise spike a rush-train of the current quantity would add — scales with quantity, unlike every other one-time action noise cost. */
  rushNoise: number;
}

export interface TrainQueueStatus {
  remaining: number;
  msUntilNextMs: number;
}

/** Same shape as TrainOption minus rushNoise — junkyard knight/cross-bow sniper have no rush-train variant (calm queue only). */
export interface SimpleTrainOption {
  totalCost: Partial<Record<ResourceType, number>>;
  affordable: boolean;
  maxQuantity: number;
}

export { formatDuration };

export function TilePopup({
  coord,
  owned,
  isBase,
  terrain,
  isScouted,
  existingTile,
  noiseFloorContribution,
  stockpileCap,
  connected,
  buildOptions,
  tierUpgrade,
  tierUpgradeInProgress,
  storageUpgrades,
  pathTile,
  pathBuildOption,
  pathUpgradeOption,
  pathUpgradeInProgress,
  tower,
  towerStats,
  towerBuildOption,
  towerUpgradeOption,
  towerUpgradeInProgress,
  wall,
  wallMaxDurability,
  wallBuildOption,
  wallUpgradeOption,
  wallRepairOption,
  wallActionStatus,
  barracks,
  barracksBuildOption,
  barracksUpgradeOption,
  barracksUpgradeInProgress,
  dock,
  dockYieldPerSecond,
  dockBuildOption,
  fishingBoatOption,
  fishingBoatInProgress,
  scoutSkiffOption,
  scoutSkiffInProgress,
  scoutSkiffCount,
  wanderingScoutOption,
  wanderingScoutInProgress,
  wanderingScoutCount,
  scoutStockpile,
  scoutCapacity,
  militiaCount,
  militiaCapacity,
  junkyardKnightCount,
  junkyardKnightCapacity,
  crossBowSniperCount,
  crossBowSniperCapacity,
  scoutTrainOption,
  militiaTrainOption,
  junkyardKnightTrainOption,
  crossBowSniperTrainOption,
  scoutQueueStatus,
  militiaQueueStatus,
  junkyardKnightQueueStatus,
  crossBowSniperQueueStatus,
  scoutsToTrain,
  militiaToTrain,
  junkyardKnightToTrain,
  crossBowSniperToTrain,
  scoutTileOption,
  canDemolish,
  repairOption,
  repairBlockedByHorde,
  repairInProgress,
  constructionInProgress,
  baseLevel,
  baseUpgradeOption,
  baseUpgradeInProgress,
  baseCurrentHp,
  baseMaxHp,
  reinforcementUpgradeOption,
  baseRepairOption,
  baseRepairBlockedByHorde,
  reinforcementActionStatus,
  relocationOption,
  canRelocateBase,
  baseRelocationInProgress,
  expeditionOption,
  den,
  denAssaultOption,
  denSiegeStatus,
  denAssaultInProgress,
  lab,
  labAssaultOption,
  labAssaultInProgress,
  outpost,
  outpostMaxHp,
  outpostReinforcementUpgradeOption,
  outpostRepairOption,
  outpostRepairBlockedByHorde,
  outpostReinforcementActionStatus,
  tombstone,
  tombstoneExpiresInMs,
  militiaToSend,
  junkyardKnightToSend,
  crossBowSniperToSend,
  availableMilitiaForExpeditionCount,
  availableJunkyardKnightForExpeditionCount,
  availableCrossBowSniperForExpeditionCount,
  garrisonMilitiaCount,
  recallInProgress,
  availableMilitiaCount,
  militiaToGarrison,
  garrisonJunkyardKnightCount,
  availableJunkyardKnightCount,
  junkyardKnightToGarrison,
  garrisonCrossBowSniperCount,
  availableCrossBowSniperCount,
  crossBowSniperToGarrison,
  garrisonBlockedByHorde,
  buildError,
  onBuild,
  onUpgradeTier,
  onUpgradeStorage,
  onCollect,
  onBuildPath,
  onUpgradePath,
  onBuildTower,
  onUpgradeTower,
  onBuildWall,
  onUpgradeWall,
  onRepairWall,
  onRepair,
  onDemolish,
  onBuildBarracks,
  onUpgradeBarracks,
  onBuildDock,
  onBuildFishingBoat,
  onBuildScoutSkiff,
  onCollectDock,
  onBuildWanderingScout,
  onTrainScouts,
  onTrainMilitia,
  onTrainJunkyardKnight,
  onTrainCrossBowSniper,
  onMaxScouts,
  onMaxMilitia,
  onMaxJunkyardKnight,
  onMaxCrossBowSniper,
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
  onMaxGarrison,
  onGarrisonJunkyardKnight,
  onMaxGarrisonJunkyardKnight,
  onGarrisonCrossBowSniper,
  onMaxGarrisonCrossBowSniper,
  onRecallMilitia,
  onChangeMilitiaToSend,
  onChangeJunkyardKnightToSend,
  onChangeCrossBowSniperToSend,
  onChangeScoutsToTrain,
  onChangeMilitiaToTrain,
  onChangeJunkyardKnightToTrain,
  onChangeCrossBowSniperToTrain,
  onChangeMilitiaToGarrison,
  onChangeJunkyardKnightToGarrison,
  onChangeCrossBowSniperToGarrison,
  onClose,
}: {
  coord: Axial;
  owned: boolean;
  isBase: boolean;
  terrain: TerrainType | null;
  isScouted: boolean;
  existingTile: ExtractionTile | null;
  noiseFloorContribution: number | null;
  stockpileCap: number;
  connected: boolean;
  buildOptions: BuildOption[] | null;
  tierUpgrade: TierUpgradeOption | null;
  tierUpgradeInProgress: UpgradeInProgress<ExtractionTier> | null;
  storageUpgrades: StorageUpgradeOption[] | null;
  pathTile: PathTile | null;
  pathBuildOption: PathBuildOption | null;
  pathUpgradeOption: PathUpgradeOption | null;
  pathUpgradeInProgress: UpgradeInProgress<PathTier> | null;
  tower: Tower | null;
  towerStats: { range: number; damage: number } | null;
  towerBuildOption: RepairOption | null;
  towerUpgradeOption: TowerUpgradeOption | null;
  towerUpgradeInProgress: UpgradeInProgress<number> | null;
  wall: Wall | null;
  wallMaxDurability: number | null;
  wallBuildOption: RepairOption | null;
  wallUpgradeOption: WallUpgradeOption | null;
  wallRepairOption: WallRepairOption | null;
  wallActionStatus: WallActionStatus | null;
  barracks: Barracks | null;
  barracksBuildOption: RepairOption | null;
  barracksUpgradeOption: BarracksUpgradeOption | null;
  barracksUpgradeInProgress: UpgradeInProgress<number> | null;
  /** Non-null while the selected structure (whichever of the 5 kinds is on this tile) hasn't finished its initial construction timer yet. */
  constructionInProgress: { remainingMs: number } | null;
  dock: DockRecord | null;
  /** Current food/sec rate for `dock` — null when there's no dock here. */
  dockYieldPerSecond: number | null;
  dockBuildOption: SimpleCostOption | null;
  /** Null once already built or under construction. */
  fishingBoatOption: SimpleCostOption | null;
  fishingBoatInProgress: { remainingMs: number } | null;
  /** Null once this dock already has as many skiffs (built or under construction) as allowed. */
  scoutSkiffOption: SkiffBuildOption | null;
  scoutSkiffInProgress: { remainingMs: number } | null;
  /** Scout skiffs currently based at this dock and no longer under construction. */
  scoutSkiffCount: number;
  /** Null once this barracks already has as many wandering scouts (built or under construction) as allowed. */
  wanderingScoutOption: WanderingScoutOption | null;
  wanderingScoutInProgress: { remainingMs: number } | null;
  /** Wandering scouts currently based at this barracks and no longer under construction. */
  wanderingScoutCount: number;
  scoutStockpile: number;
  scoutCapacity: number;
  militiaCount: number;
  militiaCapacity: number;
  /** Barracks L2 unlock — 0 capacity until a barracks meets units.junkyard_knight.min_barracks_level (engine/barracks.ts). */
  junkyardKnightCount: number;
  junkyardKnightCapacity: number;
  /** Barracks L3 unlock — 0 capacity until a barracks meets units.cross_bow_sniper.min_barracks_level (engine/barracks.ts). */
  crossBowSniperCount: number;
  crossBowSniperCapacity: number;
  scoutTrainOption: TrainOption | null;
  militiaTrainOption: TrainOption | null;
  /** No rush-train variant for either new unit type (calm queue only). */
  junkyardKnightTrainOption: SimpleTrainOption | null;
  crossBowSniperTrainOption: SimpleTrainOption | null;
  scoutQueueStatus: TrainQueueStatus | null;
  militiaQueueStatus: TrainQueueStatus | null;
  junkyardKnightQueueStatus: TrainQueueStatus | null;
  crossBowSniperQueueStatus: TrainQueueStatus | null;
  scoutsToTrain: number;
  militiaToTrain: number;
  junkyardKnightToTrain: number;
  crossBowSniperToTrain: number;
  scoutTileOption: boolean;
  canDemolish: boolean;
  /** Non-null when the tile's structure was captured by a horde and (if owned) is now repairable — DESIGN.md §12. Null while repairInProgress is set. */
  repairOption: RepairOption | null;
  /** True while a horde is still physically standing on this tile — repair is blocked until it's cleared. */
  repairBlockedByHorde: boolean;
  /** Non-null while this structure's damage repair timer is running. */
  repairInProgress: { remainingMs: number } | null;
  baseLevel: number;
  baseUpgradeOption: BaseUpgradeOption | null;
  baseUpgradeInProgress: { targetLevel: number; remainingMs: number } | null;
  /** Base HP left, out of baseMaxHp — a horde that beats currentHp+garrison in a fight destroys it but still costs HP; a horde that beats it instead ends the game, DESIGN.md §13. */
  baseCurrentHp: number;
  /** Max HP for the current reinforcement level — engine/base.ts:baseReinforcementHp. */
  baseMaxHp: number;
  /** Null once reinforcement is capped by base level (maxReinforcementLevel, engine/base.ts) or while reinforcementActionStatus is set. */
  reinforcementUpgradeOption: ReinforcementUpgradeOption | null;
  /** Null when currentHp is already at max — nothing to repair — or while reinforcementActionStatus is set. */
  baseRepairOption: RepairOption | null;
  /** True while a horde is still adjacent to (or on) the base tile — repair is blocked until it's cleared, same reasoning as repairBlockedByHorde. */
  baseRepairBlockedByHorde: boolean;
  /** Non-null while a reinforcement upgrade or repair is running on the base. */
  reinforcementActionStatus: ReinforcementActionStatus | null;
  /** Null when this tile isn't a valid relocation destination — see RelocationOption's doc comment for every reason. */
  relocationOption: RelocationOption | null;
  /** True once base.level meets tweaks.base_relocation.min_base_level — shown as a hint on the base tile itself, since the action lives on the destination tile's popup. */
  canRelocateBase: boolean;
  /** Non-null while a relocation countdown is running — shown on the base tile's own popup. */
  baseRelocationInProgress: { destination: Axial; remainingMs: number } | null;
  expeditionOption: ExpeditionOption | null;
  /** The hostile den at this tile, if any — null once cleared/converted to an outpost. */
  den: DenRecord | null;
  /** Null when there's no known route to the den yet (unscouted, or no barracks) — non-null both before and during a siege, since it also backs the "Send Reinforcements" form. */
  denAssaultOption: DenAssaultOption | null;
  /** Non-null only while this den is under siege. */
  denSiegeStatus: DenSiegeStatus | null;
  /** Non-null only while a party is currently in transit toward this den (dispatched, not yet arrived — not the same as denSiegeStatus, which only starts once the assault has already arrived and won). */
  denAssaultInProgress: DenAssaultInProgress | null;
  /** The hidden lab, if this tile IS the lab's coord and it's been scouted — null everywhere else (including an unscouted lab tile, which looks like ordinary ground, DESIGN.md §13). */
  lab: LabRecord | null;
  /** Null when there's no known route to the lab yet (unscouted, or no barracks) — non-null once secured too (shown as "already secured" instead of a form). */
  labAssaultOption: LabAssaultOption | null;
  /** Non-null only while a party is currently in transit toward the lab. */
  labAssaultInProgress: LabAssaultInProgress | null;
  /** A converted, player-held outpost at this tile, if any — null everywhere else, including a still-hostile den. */
  outpost: OutpostRecord | null;
  /** Max HP for outpost's current reinforcementLevel — engine/outposts.ts:outpostReinforcementHp. Null when `outpost` is null. */
  outpostMaxHp: number | null;
  /** Null once capped by base level (maxOutpostReinforcementLevel, engine/outposts.ts) or while outpostReinforcementActionStatus is set. */
  outpostReinforcementUpgradeOption: ReinforcementUpgradeOption | null;
  /** Null when currentHp is already at max, or while outpostReinforcementActionStatus is set. */
  outpostRepairOption: RepairOption | null;
  /** True while a horde is still adjacent to (or on) the outpost tile — same reasoning as baseRepairBlockedByHorde. */
  outpostRepairBlockedByHorde: boolean;
  /** Non-null while a reinforcement upgrade or repair is running on this outpost. */
  outpostReinforcementActionStatus: ReinforcementActionStatus | null;
  /** A marker left where an expedition/den-assault/lab-assault party died mid-route, if this tile is one — null everywhere else. Purely informational, click-to-inspect. */
  tombstone: TombstoneRecord | null;
  /** Time left before `tombstone` fades — null when `tombstone` is null. */
  tombstoneExpiresInMs: number | null;
  militiaToSend: number;
  junkyardKnightToSend: number;
  crossBowSniperToSend: number;
  /** Militia not committed to a garrison or pending expedition, so eligible to send. */
  availableMilitiaForExpeditionCount: number;
  availableJunkyardKnightForExpeditionCount: number;
  availableCrossBowSniperForExpeditionCount: number;
  /** Militia currently stationed on this tile — 0 if no garrison here. */
  garrisonMilitiaCount: number;
  /** Non-null only while a garrison recalled from this tile is still marching home. */
  recallInProgress: RecallInProgress | null;
  /** Militia not stationed anywhere, so eligible to garrison here (or attack a tile, or den-assault). */
  availableMilitiaCount: number;
  militiaToGarrison: number;
  /** Junkyard knights currently stationed on this tile — 0 if none. */
  garrisonJunkyardKnightCount: number;
  availableJunkyardKnightCount: number;
  junkyardKnightToGarrison: number;
  /** Cross-bow snipers currently stationed on this tile — 0 if none. Their ranged damage (engine/hordes.ts) applies regardless of which tile they're garrisoned on, not just this one. */
  garrisonCrossBowSniperCount: number;
  availableCrossBowSniperCount: number;
  crossBowSniperToGarrison: number;
  /** True while a horde is still physically standing on this tile — garrisoning is blocked until it's cleared (same reasoning as repairBlockedByHorde). */
  garrisonBlockedByHorde: boolean;
  buildError: string | null;
  onBuild: (resource: ResourceType) => void;
  onUpgradeTier: () => void;
  onUpgradeStorage: (resource: ResourceType) => void;
  onCollect: () => void;
  onBuildPath: () => void;
  onUpgradePath: () => void;
  onBuildTower: () => void;
  onUpgradeTower: () => void;
  onBuildWall: () => void;
  onUpgradeWall: () => void;
  onRepairWall: () => void;
  onRepair: () => void;
  onDemolish: () => void;
  onBuildBarracks: () => void;
  onUpgradeBarracks: () => void;
  onBuildDock: () => void;
  onBuildFishingBoat: () => void;
  onBuildScoutSkiff: () => void;
  onCollectDock: () => void;
  onBuildWanderingScout: () => void;
  onTrainScouts: () => void;
  onTrainMilitia: () => void;
  onTrainJunkyardKnight: () => void;
  onTrainCrossBowSniper: () => void;
  onMaxScouts: () => void;
  onMaxMilitia: () => void;
  onMaxJunkyardKnight: () => void;
  onMaxCrossBowSniper: () => void;
  onRushTrainScouts: () => void;
  onRushTrainMilitia: () => void;
  onScoutTile: () => void;
  onUpgradeBase: () => void;
  onUpgradeReinforcement: () => void;
  onRepairBase: () => void;
  onUpgradeOutpostReinforcement: () => void;
  onRepairOutpost: () => void;
  onRelocateBase: () => void;
  onDispatchExpedition: () => void;
  onAssaultDen: () => void;
  onSecureLab: () => void;
  onGarrisonMilitia: () => void;
  onMaxGarrison: () => void;
  onGarrisonJunkyardKnight: () => void;
  onMaxGarrisonJunkyardKnight: () => void;
  onGarrisonCrossBowSniper: () => void;
  onMaxGarrisonCrossBowSniper: () => void;
  onRecallMilitia: () => void;
  onChangeMilitiaToSend: (n: number) => void;
  onChangeJunkyardKnightToSend: (n: number) => void;
  onChangeCrossBowSniperToSend: (n: number) => void;
  onChangeScoutsToTrain: (n: number) => void;
  onChangeMilitiaToTrain: (n: number) => void;
  onChangeJunkyardKnightToTrain: (n: number) => void;
  onChangeCrossBowSniperToTrain: (n: number) => void;
  onChangeMilitiaToGarrison: (n: number) => void;
  onChangeJunkyardKnightToGarrison: (n: number) => void;
  onChangeCrossBowSniperToGarrison: (n: number) => void;
  onClose: () => void;
}) {
  // Shared by the initial "Assault Den" form and the "Send Reinforcements"
  // form shown once under siege — same route/cost/ETA display and the same
  // militia/junkyard-knight/cross-bow-sniper count inputs either way, since
  // both dispatch through the exact same handleAssaultDen action (App.tsx
  // decides at arrival whether it's a fight or a reinforcement).
  function renderDenPartyForm(option: DenAssaultOption, buttonLabel: string) {
    return (
      <>
        <p>
          Defense: {option.denDefense.toFixed(0)} — Route: {option.distanceTiles} tile
          {option.distanceTiles === 1 ? "" : "s"} (cost {option.pathCost.toFixed(1)}) —{" "}
          {formatCost(option.provisionsCost)} — ETA {formatDuration(option.etaMs)}
        </p>
        {availableMilitiaForExpeditionCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="number"
              min={0}
              max={availableMilitiaForExpeditionCount}
              value={militiaToSend}
              onChange={(e) => onChangeMilitiaToSend(Number(e.target.value))}
              style={{ width: 60 }}
              aria-label="Militia to send"
            />
            <span>militia (of {availableMilitiaForExpeditionCount} available)</span>
          </div>
        )}
        {availableJunkyardKnightForExpeditionCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
            <input
              type="number"
              min={0}
              max={availableJunkyardKnightForExpeditionCount}
              value={junkyardKnightToSend}
              onChange={(e) => onChangeJunkyardKnightToSend(Number(e.target.value))}
              style={{ width: 60 }}
              aria-label="Junkyard knights to send"
            />
            <span>junkyard knights (of {availableJunkyardKnightForExpeditionCount} available)</span>
          </div>
        )}
        {availableCrossBowSniperForExpeditionCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
            <input
              type="number"
              min={0}
              max={availableCrossBowSniperForExpeditionCount}
              value={crossBowSniperToSend}
              onChange={(e) => onChangeCrossBowSniperToSend(Number(e.target.value))}
              style={{ width: 60 }}
              aria-label="Cross-bow snipers to send"
            />
            <span>cross-bow snipers (of {availableCrossBowSniperForExpeditionCount} available)</span>
          </div>
        )}
        <button
          type="button"
          disabled={!option.affordable || militiaToSend + junkyardKnightToSend + crossBowSniperToSend <= 0}
          onClick={onAssaultDen}
          style={{ marginTop: "0.25rem" }}
        >
          {buttonLabel}
        </button>
      </>
    );
  }

  /** Mirrors renderDenPartyForm exactly, dispatching through onSecureLab instead of onAssaultDen — there's no "reinforcements" variant since the lab has no siege/hold period, just the one all-or-nothing fight. */
  function renderLabPartyForm(option: LabAssaultOption) {
    return (
      <>
        <p>
          Guardian defense: {option.guardianDefense.toFixed(0)} — Route: {option.distanceTiles} tile
          {option.distanceTiles === 1 ? "" : "s"} (cost {option.pathCost.toFixed(1)}) —{" "}
          {formatCost(option.provisionsCost)} — ETA {formatDuration(option.etaMs)}
        </p>
        {availableMilitiaForExpeditionCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="number"
              min={0}
              max={availableMilitiaForExpeditionCount}
              value={militiaToSend}
              onChange={(e) => onChangeMilitiaToSend(Number(e.target.value))}
              style={{ width: 60 }}
              aria-label="Militia to send"
            />
            <span>militia (of {availableMilitiaForExpeditionCount} available)</span>
          </div>
        )}
        {availableJunkyardKnightForExpeditionCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
            <input
              type="number"
              min={0}
              max={availableJunkyardKnightForExpeditionCount}
              value={junkyardKnightToSend}
              onChange={(e) => onChangeJunkyardKnightToSend(Number(e.target.value))}
              style={{ width: 60 }}
              aria-label="Junkyard knights to send"
            />
            <span>junkyard knights (of {availableJunkyardKnightForExpeditionCount} available)</span>
          </div>
        )}
        {availableCrossBowSniperForExpeditionCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
            <input
              type="number"
              min={0}
              max={availableCrossBowSniperForExpeditionCount}
              value={crossBowSniperToSend}
              onChange={(e) => onChangeCrossBowSniperToSend(Number(e.target.value))}
              style={{ width: 60 }}
              aria-label="Cross-bow snipers to send"
            />
            <span>cross-bow snipers (of {availableCrossBowSniperForExpeditionCount} available)</span>
          </div>
        )}
        <button
          type="button"
          disabled={!option.affordable || militiaToSend + junkyardKnightToSend + crossBowSniperToSend <= 0}
          onClick={onSecureLab}
          style={{ marginTop: "0.25rem" }}
        >
          Secure Lab
        </button>
      </>
    );
  }

  return (
    <div
      style={{
        position: "fixed",
        left: "1rem",
        bottom: "1rem",
        minWidth: 240,
        background: "rgba(20, 20, 22, 0.92)",
        color: "white",
        borderRadius: 8,
        padding: "0.75rem 1rem",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <strong>
          Tile ({coord.q}, {coord.r})
        </strong>
        <button type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>

      {!owned && (
        <p>
          {isScouted ? `Scouted — terrain: ${terrain}` : "Unclaimed. Details unknown."}
          {!isScouted && scoutTileOption && (
            <>
              {" — "}
              <button type="button" onClick={onScoutTile}>
                Scout (uses 1 scout unit)
              </button>
            </>
          )}
        </p>
      )}

      {!owned && repairOption && (
        <p>A structure here was overrun by a horde — retake this tile to begin repairs.</p>
      )}

      {!owned && isScouted && !den && !lab && (
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            <strong>Send Expedition</strong>
          </p>
          {expeditionOption ? (
            <>
              <p>
                Route: {expeditionOption.distanceTiles} tile{expeditionOption.distanceTiles === 1 ? "" : "s"} (cost{" "}
                {expeditionOption.pathCost.toFixed(1)}) — {formatCost(expeditionOption.provisionsCost)} — ETA{" "}
                {formatDuration(expeditionOption.etaMs)}
              </p>
              {availableMilitiaForExpeditionCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="number"
                    min={0}
                    max={availableMilitiaForExpeditionCount}
                    value={militiaToSend}
                    onChange={(e) => onChangeMilitiaToSend(Number(e.target.value))}
                    style={{ width: 60 }}
                    aria-label="Militia to send"
                  />
                  <span>militia (of {availableMilitiaForExpeditionCount} available)</span>
                </div>
              )}
              {availableJunkyardKnightForExpeditionCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <input
                    type="number"
                    min={0}
                    max={availableJunkyardKnightForExpeditionCount}
                    value={junkyardKnightToSend}
                    onChange={(e) => onChangeJunkyardKnightToSend(Number(e.target.value))}
                    style={{ width: 60 }}
                    aria-label="Junkyard knights to send"
                  />
                  <span>junkyard knights (of {availableJunkyardKnightForExpeditionCount} available)</span>
                </div>
              )}
              {availableCrossBowSniperForExpeditionCount > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <input
                    type="number"
                    min={0}
                    max={availableCrossBowSniperForExpeditionCount}
                    value={crossBowSniperToSend}
                    onChange={(e) => onChangeCrossBowSniperToSend(Number(e.target.value))}
                    style={{ width: 60 }}
                    aria-label="Cross-bow snipers to send"
                  />
                  <span>cross-bow snipers (of {availableCrossBowSniperForExpeditionCount} available)</span>
                </div>
              )}
              <button
                type="button"
                disabled={
                  !expeditionOption.affordable ||
                  militiaToSend + junkyardKnightToSend + crossBowSniperToSend <= 0
                }
                onClick={onDispatchExpedition}
                style={{ marginTop: "0.25rem" }}
              >
                Dispatch Expedition
              </button>
            </>
          ) : (
            <p>No known route — scout a path there, and make sure you have a barracks.</p>
          )}
        </div>
      )}

      {den && !den.siege && denAssaultInProgress && (
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            <strong>Zombie Den (level {den.level})</strong> — a party is en route, arriving in{" "}
            {formatDuration(denAssaultInProgress.etaMs)}.
          </p>
        </div>
      )}

      {den && !den.siege && !denAssaultInProgress && (
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            <strong>Zombie Den (level {den.level})</strong>
          </p>
          {denAssaultOption ? (
            renderDenPartyForm(denAssaultOption, "Assault Den")
          ) : (
            <p>No known route — scout the den, and make sure you have a barracks.</p>
          )}
        </div>
      )}

      {den && den.siege && denSiegeStatus && (
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            <strong>Zombie Den (level {den.level})</strong> — under siege, holding (
            {formatDuration(denSiegeStatus.holdRemainingMs)} remaining).
          </p>
          <p>
            Next last-stand wave in {formatDuration(denSiegeStatus.nextWaveInMs)} — size{" "}
            {denSiegeStatus.nextWaveSize.toFixed(0)} vs. your current defense of{" "}
            {denSiegeStatus.currentDefense.toFixed(0)}
            {denSiegeStatus.currentDefense >= denSiegeStatus.nextWaveSize ? " — holding" : " — not enough yet"}.
            Garrison the core, or add towers/walls on the surrounding ring — either counts toward this total, a
            strong enough garrison alone is enough on its own.
          </p>
          {denAssaultInProgress ? (
            <p>Reinforcements en route, arriving in {formatDuration(denAssaultInProgress.etaMs)}.</p>
          ) : (
            denAssaultOption && renderDenPartyForm(denAssaultOption, "Send Reinforcements")
          )}
        </div>
      )}

      {lab && lab.secured && (
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            <strong>Hidden Lab</strong> — secured. You win.
          </p>
        </div>
      )}

      {lab && !lab.secured && labAssaultInProgress && (
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            <strong>Hidden Lab</strong> — a party is en route, arriving in {formatDuration(labAssaultInProgress.etaMs)}.
          </p>
        </div>
      )}

      {lab && !lab.secured && !labAssaultInProgress && (
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            <strong>Hidden Lab</strong> — guarded by a static defender far tougher than anything else encountered.
          </p>
          {labAssaultOption ? (
            renderLabPartyForm(labAssaultOption)
          ) : (
            <p>No known route — make sure you have a barracks.</p>
          )}
        </div>
      )}

      {outpost && outpostMaxHp !== null && (
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            <strong>Outpost</strong> — a remote base, cleared from a level {outpost.originalDenLevel} den. Its
            connected tiles auto-flow resources straight into your main stockpile, same as the base's own.
          </p>
          <p>
            Reinforcement: {Math.floor(outpost.currentHp)}/{Math.floor(outpostMaxHp)} HP — a horde that overruns this
            doesn't end the game, but reverts it to a hostile den that has to be re-sieged.
            {outpostReinforcementActionStatus ? (
              outpostReinforcementActionStatus.kind === "upgrade" ? (
                <>
                  {" — upgrading to L"}
                  {outpostReinforcementActionStatus.targetLevel} (
                  {formatDuration(outpostReinforcementActionStatus.remainingMs)} remaining)
                </>
              ) : (
                <> — repairing ({formatDuration(outpostReinforcementActionStatus.remainingMs)} remaining)</>
              )
            ) : (
              <>
                {outpostReinforcementUpgradeOption && (
                  <>
                    {" — "}
                    <button
                      type="button"
                      disabled={!outpostReinforcementUpgradeOption.affordable}
                      onClick={onUpgradeOutpostReinforcement}
                    >
                      Upgrade to {Math.floor(outpostReinforcementUpgradeOption.hp)} HP (
                      {formatCost(outpostReinforcementUpgradeOption.cost)},{" "}
                      {formatDuration(outpostReinforcementUpgradeOption.durationMs)})
                    </button>
                  </>
                )}
                {outpostRepairOption && (
                  <>
                    {" — "}
                    <button
                      type="button"
                      disabled={!outpostRepairOption.affordable || outpostRepairBlockedByHorde}
                      onClick={onRepairOutpost}
                    >
                      {outpostRepairBlockedByHorde
                        ? "Horde nearby"
                        : `Repair (${formatCost(outpostRepairOption.cost)}, ${outpostRepairOption.durationMinutes}m)`}
                    </button>
                  </>
                )}
              </>
            )}
          </p>
        </div>
      )}

      {tombstone && tombstoneExpiresInMs !== null && (
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            <strong>A party was lost here</strong>
            {" — "}
            {tombstone.cause.kind === "horde_blocked"
              ? `overrun by a horde (size ${Math.round(tombstone.cause.hordeSize)}) blocking the road.`
              : `out-fought — attack power ${tombstone.cause.attackPower.toFixed(1)} vs. defense ${tombstone.cause.defense.toFixed(1)}.`}
          </p>
          <p>
            Lost: {tombstone.militiaLost} militia, {tombstone.junkyardKnightLost} knights, {tombstone.crossBowSniperLost}{" "}
            snipers.
          </p>
          <p>Fades in {formatDuration(tombstoneExpiresInMs)}.</p>
        </div>
      )}

      {!isBase && relocationOption && (
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            Relocate base here: {formatCost(relocationOption.cost)}, {formatDuration(relocationOption.durationMs)}{" "}
            <button type="button" disabled={!relocationOption.affordable} onClick={onRelocateBase}>
              Relocate Base Here
            </button>
          </p>
        </div>
      )}

      {owned && isBase && (
        <div>
          <p>Your base. Nothing can be built here — extraction, defense, and infrastructure live out on the map.</p>
          <p>
            Base level: {baseLevel}
            {baseUpgradeInProgress ? (
              <>
                {" — upgrading to L"}
                {baseUpgradeInProgress.targetLevel} ({formatDuration(baseUpgradeInProgress.remainingMs)} remaining)
              </>
            ) : (
              baseUpgradeOption && (
                <>
                  {" — "}
                  <button type="button" disabled={!baseUpgradeOption.affordable} onClick={onUpgradeBase}>
                    Upgrade to L{baseUpgradeOption.targetLevel} ({formatCost(baseUpgradeOption.cost)},{" "}
                    {formatDuration(baseUpgradeOption.durationMs)})
                  </button>
                </>
              )
            )}
          </p>
          <p>
            Reinforcement: {Math.floor(baseCurrentHp)}/{Math.floor(baseMaxHp)} HP — a horde that beats this destroys
            it but still costs HP; a horde whose attack outright beats it takes the base and ends the game.
            {reinforcementActionStatus ? (
              reinforcementActionStatus.kind === "upgrade" ? (
                <>
                  {" — upgrading to L"}
                  {reinforcementActionStatus.targetLevel} ({formatDuration(reinforcementActionStatus.remainingMs)}{" "}
                  remaining)
                </>
              ) : (
                <> — repairing ({formatDuration(reinforcementActionStatus.remainingMs)} remaining)</>
              )
            ) : (
              <>
                {reinforcementUpgradeOption && (
                  <>
                    {" — "}
                    <button
                      type="button"
                      disabled={!reinforcementUpgradeOption.affordable}
                      onClick={onUpgradeReinforcement}
                    >
                      Upgrade to {Math.floor(reinforcementUpgradeOption.hp)} HP (
                      {formatCost(reinforcementUpgradeOption.cost)}, {formatDuration(reinforcementUpgradeOption.durationMs)})
                    </button>
                  </>
                )}
                {baseRepairOption && (
                  <>
                    {" — "}
                    <button
                      type="button"
                      disabled={!baseRepairOption.affordable || baseRepairBlockedByHorde}
                      onClick={onRepairBase}
                    >
                      {baseRepairBlockedByHorde
                        ? "Horde nearby"
                        : `Repair (${formatCost(baseRepairOption.cost)}, ${baseRepairOption.durationMinutes}m)`}
                    </button>
                  </>
                )}
              </>
            )}
          </p>
          {(canRelocateBase || baseRelocationInProgress) && (
            <p>
              {baseRelocationInProgress
                ? `Relocating to (${baseRelocationInProgress.destination.q}, ${baseRelocationInProgress.destination.r}) — ${formatDuration(baseRelocationInProgress.remainingMs)} remaining`
                : `Select any other empty, known tile and choose "Relocate Base Here" to move your base there.`}
            </p>
          )}
        </div>
      )}

      {owned && !isBase && (
        <p>
          Terrain: {terrain}
          {existingTile && (
            <>
              {" "}
              — {existingTile.resource} extraction tile ({existingTile.tier}), stockpile{" "}
              {Math.floor(existingTile.stockpile)}/{stockpileCap}
              {connected ? " — connected, auto-flowing" : " — not connected, manual collection only"}
              {noiseFloorContribution !== null && <> — noise floor: +{noiseFloorContribution.toFixed(1)}db</>}
            </>
          )}
        </p>
      )}

      {owned && !isBase && !existingTile && buildOptions && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {buildOptions.map(({ resource, cost, affordable, durationMinutes }) => (
            <button key={resource} type="button" disabled={!affordable} onClick={() => onBuild(resource)}>
              Build {resource} ({formatCost(cost)}, {durationMinutes}m)
            </button>
          ))}
        </div>
      )}

      {existingTile && existingTile.damaged ? (
        <p>
          Damaged by a horde — not usable until repaired.
          {owned &&
            (repairInProgress ? (
              <> — repairing ({formatDuration(repairInProgress.remainingMs)} remaining)</>
            ) : (
              repairOption && (
                <>
                  {" "}
                  <button type="button" disabled={!repairOption.affordable || repairBlockedByHorde} onClick={onRepair}>
                    {repairBlockedByHorde
                      ? "Horde present"
                      : `Repair (${formatCost(repairOption.cost)}, ${repairOption.durationMinutes}m)`}
                  </button>
                </>
              )
            ))}
        </p>
      ) : existingTile && constructionInProgress ? (
        <p>Under construction ({formatDuration(constructionInProgress.remainingMs)} remaining)</p>
      ) : (
        <>
          {existingTile && owned && (
            <button type="button" disabled={existingTile.stockpile <= 0} onClick={onCollect}>
              Collect ({Math.floor(existingTile.stockpile)})
            </button>
          )}

          {existingTile && (
            <p>
              {tierUpgradeInProgress ? (
                <>
                  Upgrading to {tierUpgradeInProgress.target} ({formatDuration(tierUpgradeInProgress.remainingMs)}{" "}
                  remaining)
                </>
              ) : (
                tierUpgrade && (
                  <button type="button" disabled={!tierUpgrade.affordable} onClick={onUpgradeTier}>
                    Upgrade to {tierUpgrade.targetTier} ({formatCost(tierUpgrade.cost)},{" "}
                    {tierUpgrade.durationMinutes}m)
                  </button>
                )
              )}
            </p>
          )}
        </>
      )}

      {owned && !isBase && !pathTile && pathBuildOption && (
        <button type="button" disabled={!pathBuildOption.affordable} onClick={onBuildPath}>
          Build goat track ({formatCost(pathBuildOption.cost)}, {pathBuildOption.durationMinutes}m)
        </button>
      )}

      {pathTile && (
        <p>
          Path: {pathTile.tier}
          {noiseFloorContribution !== null && <> — noise floor: +{noiseFloorContribution.toFixed(1)}db</>}
          {pathTile.damaged ? (
            <>
              {" — damaged by a horde, not usable until repaired"}
              {owned &&
                (repairInProgress ? (
                  <> — repairing ({formatDuration(repairInProgress.remainingMs)} remaining)</>
                ) : (
                  repairOption && (
                    <>
                      {" — "}
                      <button
                        type="button"
                        disabled={!repairOption.affordable || repairBlockedByHorde}
                        onClick={onRepair}
                      >
                        {repairBlockedByHorde
                          ? "Horde present"
                          : `Repair (${formatCost(repairOption.cost)}, ${repairOption.durationMinutes}m)`}
                      </button>
                    </>
                  )
                ))}
            </>
          ) : constructionInProgress ? (
            <> — under construction ({formatDuration(constructionInProgress.remainingMs)} remaining)</>
          ) : pathUpgradeInProgress ? (
            <>
              {" — upgrading to "}
              {pathUpgradeInProgress.target} ({formatDuration(pathUpgradeInProgress.remainingMs)} remaining)
            </>
          ) : (
            pathUpgradeOption && (
              <>
                {" "}
                —{" "}
                <button type="button" disabled={!pathUpgradeOption.affordable} onClick={onUpgradePath}>
                  Upgrade to {pathUpgradeOption.targetTier} ({formatCost(pathUpgradeOption.cost)},{" "}
                  {pathUpgradeOption.durationMinutes}m)
                </button>
              </>
            )
          )}
        </p>
      )}

      {owned && !isBase && !tower && towerBuildOption && (
        <button type="button" disabled={!towerBuildOption.affordable} onClick={onBuildTower}>
          Build tower ({formatCost(towerBuildOption.cost)}, {towerBuildOption.durationMinutes}m)
        </button>
      )}

      {tower && towerStats && (
        <p>
          Tower L{tower.level} — range {towerStats.range}, damage {towerStats.damage.toFixed(1)}
          {noiseFloorContribution !== null && <> — noise floor: +{noiseFloorContribution.toFixed(1)}db</>}
          {tower.damaged ? (
            <>
              {" — damaged by a horde, not defending until repaired"}
              {owned &&
                (repairInProgress ? (
                  <> — repairing ({formatDuration(repairInProgress.remainingMs)} remaining)</>
                ) : (
                  repairOption && (
                    <>
                      {" — "}
                      <button
                        type="button"
                        disabled={!repairOption.affordable || repairBlockedByHorde}
                        onClick={onRepair}
                      >
                        {repairBlockedByHorde
                          ? "Horde present"
                          : `Repair (${formatCost(repairOption.cost)}, ${repairOption.durationMinutes}m)`}
                      </button>
                    </>
                  )
                ))}
            </>
          ) : constructionInProgress ? (
            <> — under construction ({formatDuration(constructionInProgress.remainingMs)} remaining)</>
          ) : towerUpgradeInProgress ? (
            <>
              {" — upgrading to L"}
              {towerUpgradeInProgress.target} ({formatDuration(towerUpgradeInProgress.remainingMs)} remaining)
            </>
          ) : (
            towerUpgradeOption && (
              <>
                {" — "}
                <button type="button" disabled={!towerUpgradeOption.affordable} onClick={onUpgradeTower}>
                  Upgrade to L{towerUpgradeOption.targetLevel} ({formatCost(towerUpgradeOption.cost)},{" "}
                  {towerUpgradeOption.durationMinutes}m)
                </button>
              </>
            )
          )}
        </p>
      )}

      {owned && !isBase && !wall && wallBuildOption && (
        <button type="button" disabled={!wallBuildOption.affordable} onClick={onBuildWall}>
          Build wall ({formatCost(wallBuildOption.cost)}, {wallBuildOption.durationMinutes}m)
        </button>
      )}

      {wall && wallMaxDurability !== null && (
        <p>
          Wall ({wall.tier}) — durability {Math.floor(wall.durability)}/{wallMaxDurability}
          {noiseFloorContribution !== null && <> — noise floor: +{noiseFloorContribution.toFixed(1)}db</>}
          {wall.damaged ? (
            <>
              {" — overrun by a horde, not defending until repaired"}
              {owned &&
                (repairInProgress ? (
                  <> — repairing ({formatDuration(repairInProgress.remainingMs)} remaining)</>
                ) : (
                  repairOption && (
                    <>
                      {" — "}
                      <button
                        type="button"
                        disabled={!repairOption.affordable || repairBlockedByHorde}
                        onClick={onRepair}
                      >
                        {repairBlockedByHorde
                          ? "Horde present"
                          : `Repair (${formatCost(repairOption.cost)}, ${repairOption.durationMinutes}m)`}
                      </button>
                    </>
                  )
                ))}
            </>
          ) : constructionInProgress ? (
            <> — under construction ({formatDuration(constructionInProgress.remainingMs)} remaining)</>
          ) : wallActionStatus ? (
            wallActionStatus.kind === "upgrade" ? (
              <>
                {" — upgrading to "}
                {wallActionStatus.targetTier} ({formatDuration(wallActionStatus.remainingMs)} remaining)
              </>
            ) : (
              <> — repairing ({formatDuration(wallActionStatus.remainingMs)} remaining)</>
            )
          ) : (
            <>
              {wallUpgradeOption && (
                <>
                  {" — "}
                  <button type="button" disabled={!wallUpgradeOption.affordable} onClick={onUpgradeWall}>
                    Upgrade to {wallUpgradeOption.targetTier} ({formatCost(wallUpgradeOption.cost)},{" "}
                    {wallUpgradeOption.durationMinutes}m)
                  </button>
                </>
              )}
              {wallRepairOption && (
                <>
                  {" — "}
                  <button type="button" disabled={!wallRepairOption.affordable} onClick={onRepairWall}>
                    Repair ({formatCost(wallRepairOption.cost)}, {wallRepairOption.durationMinutes}m)
                  </button>
                </>
              )}
            </>
          )}
        </p>
      )}

      {owned && !isBase && !barracks && barracksBuildOption && (
        <button type="button" disabled={!barracksBuildOption.affordable} onClick={onBuildBarracks}>
          Build barracks ({formatCost(barracksBuildOption.cost)}, {barracksBuildOption.durationMinutes}m)
        </button>
      )}

      {barracks && (
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            Barracks L{barracks.level}
            {barracks.damaged ? (
              <>
                {" — damaged by a horde, not usable until repaired"}
                {owned &&
                  (repairInProgress ? (
                    <> — repairing ({formatDuration(repairInProgress.remainingMs)} remaining)</>
                  ) : (
                    repairOption && (
                      <>
                        {" — "}
                        <button
                          type="button"
                          disabled={!repairOption.affordable || repairBlockedByHorde}
                          onClick={onRepair}
                        >
                          {repairBlockedByHorde
                            ? "Horde present"
                            : `Repair (${formatCost(repairOption.cost)}, ${repairOption.durationMinutes}m)`}
                        </button>
                      </>
                    )
                  ))}
              </>
            ) : constructionInProgress ? (
              <> — under construction ({formatDuration(constructionInProgress.remainingMs)} remaining)</>
            ) : barracksUpgradeInProgress ? (
              <>
                {" — upgrading to L"}
                {barracksUpgradeInProgress.target} ({formatDuration(barracksUpgradeInProgress.remainingMs)}{" "}
                remaining)
              </>
            ) : (
              barracksUpgradeOption && (
                <>
                  {" — "}
                  <button type="button" disabled={!barracksUpgradeOption.affordable} onClick={onUpgradeBarracks}>
                    Upgrade to L{barracksUpgradeOption.targetLevel} ({formatCost(barracksUpgradeOption.cost)},{" "}
                    {barracksUpgradeOption.durationMinutes}m)
                  </button>
                </>
              )
            )}
          </p>
          <p>
            Scouts: {scoutStockpile}/{scoutCapacity} — Militia: {militiaCount}/{militiaCapacity}
            {junkyardKnightCapacity > 0 && ` — Junkyard Knights: ${junkyardKnightCount}/${junkyardKnightCapacity}`}
            {crossBowSniperCapacity > 0 && ` — Cross-Bow Snipers: ${crossBowSniperCount}/${crossBowSniperCapacity}`}
          </p>
          <p>
            {wanderingScoutCount > 0 ? (
              `Wandering scout active (${wanderingScoutCount})`
            ) : wanderingScoutInProgress ? (
              <>Building wandering scout ({formatDuration(wanderingScoutInProgress.remainingMs)} remaining)</>
            ) : (
              wanderingScoutOption && (
                <button type="button" disabled={!wanderingScoutOption.affordable} onClick={onBuildWanderingScout}>
                  Build wandering scout (uses {wanderingScoutOption.scoutCost} scouts, {formatCost(wanderingScoutOption.cost)},{" "}
                  {wanderingScoutOption.durationMinutes}m)
                </button>
              )
            )}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {scoutQueueStatus ? (
              <p>
                Training scouts — {scoutQueueStatus.remaining} remaining, next in{" "}
                {formatDuration(scoutQueueStatus.msUntilNextMs)}
              </p>
            ) : (
              scoutTrainOption && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="number"
                    min={1}
                    max={scoutTrainOption.maxQuantity}
                    value={scoutsToTrain}
                    onChange={(e) => onChangeScoutsToTrain(Number(e.target.value))}
                    style={{ width: 60 }}
                    aria-label="Scouts to train"
                  />
                  <button type="button" onClick={onMaxScouts}>
                    Max
                  </button>
                  <button type="button" disabled={!scoutTrainOption.affordable} onClick={onTrainScouts}>
                    Train {scoutsToTrain} scout{scoutsToTrain === 1 ? "" : "s"} (
                    {formatCost(scoutTrainOption.totalCost)})
                  </button>
                  <button
                    type="button"
                    disabled={!scoutTrainOption.affordable}
                    onClick={onRushTrainScouts}
                    title="Delivers instantly, no queue — but very noisy"
                  >
                    Rush (noise +{scoutTrainOption.rushNoise.toFixed(0)})
                  </button>
                </div>
              )
            )}
            {militiaQueueStatus ? (
              <p>
                Training militia — {militiaQueueStatus.remaining} remaining, next in{" "}
                {formatDuration(militiaQueueStatus.msUntilNextMs)}
              </p>
            ) : (
              militiaTrainOption && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="number"
                    min={1}
                    max={militiaTrainOption.maxQuantity}
                    value={militiaToTrain}
                    onChange={(e) => onChangeMilitiaToTrain(Number(e.target.value))}
                    style={{ width: 60 }}
                    aria-label="Militia to train"
                  />
                  <button type="button" onClick={onMaxMilitia}>
                    Max
                  </button>
                  <button type="button" disabled={!militiaTrainOption.affordable} onClick={onTrainMilitia}>
                    Train {militiaToTrain} militia ({formatCost(militiaTrainOption.totalCost)})
                  </button>
                  <button
                    type="button"
                    disabled={!militiaTrainOption.affordable}
                    onClick={onRushTrainMilitia}
                    title="Delivers instantly, no queue — but very noisy"
                  >
                    Rush (noise +{militiaTrainOption.rushNoise.toFixed(0)})
                  </button>
                </div>
              )
            )}
            {junkyardKnightQueueStatus ? (
              <p>
                Training junkyard knights — {junkyardKnightQueueStatus.remaining} remaining, next in{" "}
                {formatDuration(junkyardKnightQueueStatus.msUntilNextMs)}
              </p>
            ) : (
              junkyardKnightTrainOption && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="number"
                    min={1}
                    max={junkyardKnightTrainOption.maxQuantity}
                    value={junkyardKnightToTrain}
                    onChange={(e) => onChangeJunkyardKnightToTrain(Number(e.target.value))}
                    style={{ width: 60 }}
                    aria-label="Junkyard knights to train"
                  />
                  <button type="button" onClick={onMaxJunkyardKnight}>
                    Max
                  </button>
                  <button type="button" disabled={!junkyardKnightTrainOption.affordable} onClick={onTrainJunkyardKnight}>
                    Train {junkyardKnightToTrain} junkyard knight{junkyardKnightToTrain === 1 ? "" : "s"} (
                    {formatCost(junkyardKnightTrainOption.totalCost)})
                  </button>
                </div>
              )
            )}
            {crossBowSniperQueueStatus ? (
              <p>
                Training cross-bow snipers — {crossBowSniperQueueStatus.remaining} remaining, next in{" "}
                {formatDuration(crossBowSniperQueueStatus.msUntilNextMs)}
              </p>
            ) : (
              crossBowSniperTrainOption && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <input
                    type="number"
                    min={1}
                    max={crossBowSniperTrainOption.maxQuantity}
                    value={crossBowSniperToTrain}
                    onChange={(e) => onChangeCrossBowSniperToTrain(Number(e.target.value))}
                    style={{ width: 60 }}
                    aria-label="Cross-bow snipers to train"
                  />
                  <button type="button" onClick={onMaxCrossBowSniper}>
                    Max
                  </button>
                  <button
                    type="button"
                    disabled={!crossBowSniperTrainOption.affordable}
                    onClick={onTrainCrossBowSniper}
                  >
                    Train {crossBowSniperToTrain} cross-bow sniper{crossBowSniperToTrain === 1 ? "" : "s"} (
                    {formatCost(crossBowSniperTrainOption.totalCost)})
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {!dock && dockBuildOption && (
        <button type="button" disabled={!dockBuildOption.affordable} onClick={onBuildDock}>
          Build dock ({formatCost(dockBuildOption.cost)})
        </button>
      )}

      {dock && constructionInProgress ? (
        <p>Dock — under construction ({formatDuration(constructionInProgress.remainingMs)} remaining)</p>
      ) : (
        dock && (
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            Dock{dockYieldPerSecond !== null && <> — {dockYieldPerSecond.toFixed(2)} food/sec</>}
            {dock.fishingBoat && " (fishing boat built, +50% yield)"}
            {" — stockpile "}
            {Math.floor(dock.stockpile)}/{stockpileCap}
          </p>
          <button type="button" disabled={dock.stockpile <= 0} onClick={onCollectDock}>
            Collect ({Math.floor(dock.stockpile)})
          </button>
          <p>
            {dock.fishingBoat ? (
              "Fishing boat built"
            ) : fishingBoatInProgress ? (
              <>Building fishing boat ({formatDuration(fishingBoatInProgress.remainingMs)} remaining)</>
            ) : (
              fishingBoatOption && (
                <button type="button" disabled={!fishingBoatOption.affordable} onClick={onBuildFishingBoat}>
                  Build fishing boat ({formatCost(fishingBoatOption.cost)})
                </button>
              )
            )}
          </p>
          <p>
            {scoutSkiffCount > 0 ? (
              `Scout skiff active (${scoutSkiffCount})`
            ) : scoutSkiffInProgress ? (
              <>Building scout skiff ({formatDuration(scoutSkiffInProgress.remainingMs)} remaining)</>
            ) : (
              scoutSkiffOption && (
                <button type="button" disabled={!scoutSkiffOption.affordable} onClick={onBuildScoutSkiff}>
                  Build scout skiff ({formatCost(scoutSkiffOption.cost)}, {scoutSkiffOption.durationMinutes}m)
                </button>
              )
            )}
          </p>
        </div>
        )
      )}

      {owned && recallInProgress && (
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            Recalled: {recallInProgress.militia} militia
            {recallInProgress.junkyardKnight > 0 && `, ${recallInProgress.junkyardKnight} junkyard knights`}
            {recallInProgress.crossBowSniper > 0 && `, ${recallInProgress.crossBowSniper} cross-bow snipers`} —
            marching home, arriving in {formatDuration(recallInProgress.etaMs)}.
          </p>
        </div>
      )}

      {owned && (
        <div style={{ marginTop: "0.5rem" }}>
          <p>
            Garrison: {garrisonMilitiaCount} militia
            {garrisonJunkyardKnightCount > 0 && `, ${garrisonJunkyardKnightCount} junkyard knights`}
            {garrisonCrossBowSniperCount > 0 && `, ${garrisonCrossBowSniperCount} cross-bow snipers`}
            {(garrisonMilitiaCount > 0 || garrisonJunkyardKnightCount > 0 || garrisonCrossBowSniperCount > 0) && (
              <>
                {" — auto-attacks any horde on this tile or a neighbor — "}
                <button type="button" onClick={onRecallMilitia}>
                  Recall all
                </button>
              </>
            )}
          </p>
          {availableMilitiaCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="number"
                min={1}
                max={availableMilitiaCount}
                value={militiaToGarrison}
                onChange={(e) => onChangeMilitiaToGarrison(Number(e.target.value))}
                style={{ width: 60 }}
                aria-label="Militia to garrison"
              />
              <button type="button" onClick={onMaxGarrison} disabled={garrisonBlockedByHorde}>
                Max
              </button>
              <button type="button" onClick={onGarrisonMilitia} disabled={garrisonBlockedByHorde}>
                {garrisonBlockedByHorde ? "Horde present" : `Station militia (of ${availableMilitiaCount} available)`}
              </button>
            </div>
          )}
          {availableJunkyardKnightCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
              <input
                type="number"
                min={1}
                max={availableJunkyardKnightCount}
                value={junkyardKnightToGarrison}
                onChange={(e) => onChangeJunkyardKnightToGarrison(Number(e.target.value))}
                style={{ width: 60 }}
                aria-label="Junkyard knights to garrison"
              />
              <button type="button" onClick={onMaxGarrisonJunkyardKnight} disabled={garrisonBlockedByHorde}>
                Max
              </button>
              <button type="button" onClick={onGarrisonJunkyardKnight} disabled={garrisonBlockedByHorde}>
                {garrisonBlockedByHorde
                  ? "Horde present"
                  : `Station junkyard knights (of ${availableJunkyardKnightCount} available)`}
              </button>
            </div>
          )}
          {availableCrossBowSniperCount > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
              <input
                type="number"
                min={1}
                max={availableCrossBowSniperCount}
                value={crossBowSniperToGarrison}
                onChange={(e) => onChangeCrossBowSniperToGarrison(Number(e.target.value))}
                style={{ width: 60 }}
                aria-label="Cross-bow snipers to garrison"
              />
              <button type="button" onClick={onMaxGarrisonCrossBowSniper} disabled={garrisonBlockedByHorde}>
                Max
              </button>
              <button type="button" onClick={onGarrisonCrossBowSniper} disabled={garrisonBlockedByHorde}>
                {garrisonBlockedByHorde
                  ? "Horde present"
                  : `Station cross-bow snipers (of ${availableCrossBowSniperCount} available)`}
              </button>
            </div>
          )}
        </div>
      )}

      {canDemolish && (
        <button type="button" onClick={onDemolish}>
          Demolish
        </button>
      )}

      {storageUpgrades && (
        <div style={{ marginTop: "0.5rem" }}>
          <strong>Base — storage</strong>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginTop: "0.25rem" }}>
            {storageUpgrades.map(({ resource, level, capacity, cost, affordable, inProgress }) =>
              inProgress ? (
                <span key={resource}>
                  {resource} L{level} ({capacity} cap) — upgrading to L{inProgress.targetLevel} (
                  {formatDuration(inProgress.remainingMs)} remaining)
                </span>
              ) : (
                <button key={resource} type="button" disabled={!affordable} onClick={() => onUpgradeStorage(resource)}>
                  {resource} L{level} ({capacity} cap) → L{level + 1} ({formatCost(cost)})
                </button>
              ),
            )}
          </div>
        </div>
      )}

      {buildError && <p role="alert">{buildError}</p>}
    </div>
  );
}
