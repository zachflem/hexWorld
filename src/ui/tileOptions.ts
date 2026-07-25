import type { ExtractionTier } from "../data/extractionTiles";
import type { PathTier } from "../data/pathTiles";
import type { WallTier } from "../data/walls";
import type { ResourceType } from "../data/resources";

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
  durationMinutes: number;
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

/** Same shape as SkiffBuildOption — flat resource cost at a barracks. */
export interface WanderingScoutOption {
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
  /** Territory expedition preview — party attack power at current stepper counts. */
  attackPower?: number;
  /** Strongest path horde that outguns the party, if any. */
  wipeRisk?: { hordeSize: number; tile: { q: number; r: number } } | null;
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

/** Same shape as ExpeditionOption plus the lab's static guardian defense — see GameScreen.tsx:labAssaultOptionFor. */
export interface LabAssaultOption extends ExpeditionOption {
  guardianDefense: number;
}

/** Non-null only while a party is in transit toward the lab — see GameScreen.tsx:labAssaultInProgress. */
export interface LabAssaultInProgress {
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
