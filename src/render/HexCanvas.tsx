import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  axialEquals,
  axialKey,
  axialNeighbors,
  axialSpiral,
  axialToPixel,
  hexCorners,
  isWithinMapBounds,
  pixelToAxial,
  type Axial,
} from "../engine/hexCoords";
import { computeFogTiers, fogTierFor, type FogTier } from "../engine/fog";
import { labSearchZoneTileKeys } from "../engine/lab";
import type { LabRecord } from "../data/lab";
import { terrainAt, type TerrainType } from "../engine/terrain";
import { towerRange } from "../engine/towers";
import { sniperDamagePerSecond, towerDamagePerSecond, towersInRange } from "../engine/hordes";
import { garrisonAt, garrisonWallRangeBonus } from "../engine/garrisons";
import { maxWallDurability } from "../engine/walls";
import { outpostReinforcementHp } from "../engine/outposts";
import { powerStationAoeRadius } from "../engine/power";
import type { ExtractionTile } from "../data/extractionTiles";
import type { PowerStation } from "../data/powerStations";
import type { ResourceType } from "../data/resources";
import type { Tower } from "../data/towers";
import type { Wall, WallTier } from "../data/walls";
import type { Barracks } from "../data/barracks";
import type { GarrisonsRecord } from "../data/garrisons";
import type { DenRecord } from "../data/dens";
import type { ScrapStashRecord, ScrapStashesRecord } from "../data/scrapStashes";
import { isActiveScrapStash } from "../data/scrapStashes";
import type { OutpostRecord } from "../data/outposts";
import type { HordeRecord } from "../data/hordes";
import type { Expedition, ExpeditionsRecord } from "../data/expeditions";
import { expeditionMarkerIndex, expeditionPathIndexAt } from "../engine/expeditions";
import type { DenAssaultRecord, DenAssaultsRecord } from "../data/denAssaults";
import type { TombstoneRecord, TombstonesRecord } from "../data/tombstones";
import type { DockRecord, DocksRecord } from "../data/docks";
import type { ScoutSkiffRecord, ScoutSkiffsRecord } from "../data/scoutSkiffs";
import type { WanderingScoutRecord, WanderingScoutsRecord } from "../data/wanderingScouts";
import type { Tweaks } from "../data/tweaksSchema";
import {
  drawHexTileOverlay,
  drawHexTileTexture,
  drawImageAtWidth,
  getResourceTexture,
  getScrapTexture,
  getStructureIconTexture,
  getStructureIconTextureCandidates,
  getTerrainTexture,
  getUnitIconTexture,
  onTextureLoad,
} from "./tileTextures";
import { drawPlacedResourceIcon, drawPlacedScrapIcon, drawPlacedStructureIcon } from "./structurePlacement";
import {
  dockSpriteCandidates,
  extractionTierCandidates,
  powerStationSpriteCandidates,
  powerStationVariantStem,
  structureLevelCandidates,
  structureLevelName,
} from "./structureSprites";
import { extractionTierLevel } from "../engine/tiers";

/** Exported so DOM overlays (e.g. HoverTooltip) can compute the same on-screen hex circumradius (BASE_HEX_SIZE * zoom) the canvas itself draws with. */
export const BASE_HEX_SIZE = 24;

/** Pan offset that places `coord` at the center of a view with the given pixel dimensions. */
export function centerPanOnCoord(coord: Axial, viewWidth: number, viewHeight: number): { x: number; y: number } {
  const pixel = axialToPixel(coord, BASE_HEX_SIZE);
  return { x: viewWidth / 2 - pixel.x, y: viewHeight / 2 - pixel.y };
}

/** @deprecated Use centerPanOnCoord — kept for call sites that predate the rename. */
export function centerPanOnBase(base: Axial, viewWidth: number, viewHeight: number): { x: number; y: number } {
  return centerPanOnCoord(base, viewWidth, viewHeight);
}
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
/**
 * Finger jitter on Android touchscreens routinely exceeds ~6–10px during a
 * deliberate tap; below this threshold the gesture is still a tile click,
 * above it becomes a pan. iOS/macOS rarely hit the old 6px value, which is
 * why short taps worked there while Android needed a long-press (finger
 * planted still enough to stay under threshold).
 */
const CLICK_DRAG_THRESHOLD_PX = 18;

const TERRAIN_COLORS: Record<TerrainType, string> = {
  // Under-texture fill shows through soft AA at hex seams — keep this darker
  // than the water art so gaps read as deep water, not a bright blue grid.
  water: "#1a3548",
  shore: "#d9c98a",
  grassland: "#5a9e4f",
  forest: "#2f5a34",
  mountain: "#8a8a8a",
};

const FOG_OVERLAY: Record<FogTier, string | null> = {
  owned: null,
  heavy: "rgba(0, 0, 0, 0.7)",
  light: "rgba(0, 0, 0, 0.9)",
  scouted: "rgba(40, 70, 110, 0.35)",
  hidden: "#0a0a0c",
};

/**
 * Final-clue lab search cluster (DESIGN.md §13) — tweakable first-pass values.
 * Scouted tiles in the zone get a player-color wash; unscouted fog is eased
 * by LAB_SEARCH_ZONE_FOG_REDUCTION so the cluster reads without revealing the tile.
 */
const LAB_SEARCH_ZONE_SCOUTED_ALPHA = 0.1;
const LAB_SEARCH_ZONE_FOG_REDUCTION = 0.1;
const LAB_SEARCH_ZONE_FOG: Record<"heavy" | "light" | "hidden", string> = {
  heavy: `rgba(0, 0, 0, ${0.7 - LAB_SEARCH_ZONE_FOG_REDUCTION})`,
  light: `rgba(0, 0, 0, ${0.9 - LAB_SEARCH_ZONE_FOG_REDUCTION})`,
  hidden: `rgba(10, 10, 12, ${1 - LAB_SEARCH_ZONE_FOG_REDUCTION})`,
};

/**
 * Pointy-top corner index (hexCorners starts at top, clockwise) for the edge
 * facing each axialNeighbors direction (E, NE, NW, W, SW, SE). The outer edge
 * runs from that corner to the next clockwise.
 */
const OUTER_EDGE_CORNER_START = [1, 0, 5, 4, 3, 2] as const;

/**
 * Dev-server-only map perimeter — strokes hex edges that face out of bounds so
 * spawn position is visible at a glance through fog. Gated by import.meta.env.DEV
 * (Vite strips the call site in production builds).
 */
function drawDevMapEdgeOutline(
  ctx: CanvasRenderingContext2D,
  gridSize: number,
  pan: { x: number; y: number },
  zoom: number,
  size: number,
  viewWidth: number,
  viewHeight: number,
): void {
  ctx.save();
  ctx.strokeStyle = "rgba(220, 218, 210, 0.5)";
  ctx.lineWidth = Math.max(1.5, size * 0.07);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();

  const cullPad = size * 3;
  const strokeOuterEdges = (coord: Axial) => {
    const worldPixel = axialToPixel(coord, BASE_HEX_SIZE);
    const screenCenter = { x: worldPixel.x * zoom + pan.x, y: worldPixel.y * zoom + pan.y };
    if (
      screenCenter.x < -cullPad ||
      screenCenter.x > viewWidth + cullPad ||
      screenCenter.y < -cullPad ||
      screenCenter.y > viewHeight + cullPad
    ) {
      return;
    }

    const corners = hexCorners(screenCenter, size);
    const neighbors = axialNeighbors(coord);
    for (let d = 0; d < 6; d++) {
      if (isWithinMapBounds(neighbors[d], gridSize)) continue;
      const a = OUTER_EDGE_CORNER_START[d];
      const b = (a + 1) % 6;
      ctx.moveTo(corners[a].x, corners[a].y);
      ctx.lineTo(corners[b].x, corners[b].y);
    }
  };

  for (let r = 0; r < gridSize; r++) {
    const rowHalf = Math.floor(r / 2);
    if (r === 0 || r === gridSize - 1) {
      for (let col = 0; col < gridSize; col++) {
        strokeOuterEdges({ q: col - rowHalf, r });
      }
    } else {
      strokeOuterEdges({ q: 0 - rowHalf, r });
      strokeOuterEdges({ q: gridSize - 1 - rowHalf, r });
    }
  }

  ctx.stroke();
  ctx.restore();
}

const RESOURCE_MARKER_COLORS: Record<ResourceType, string> = {
  food: "#ffd76a",
  wood: "#8a5a2b",
  stone: "#c9c9c9",
  steel: "#7fa8c9",
};

const POWER_STATION_COLOR = "#f2f2f2";
const POWER_AOE_TINT_SELECTED = "rgba(255, 220, 80, 0.18)";

/** getStructureIconTexture names for each wall tier's sprite (tiles/structures/wall-{small,medium,large}.png) — falls back to WALL_TIER_COLORS's flat dot until/unless a given sprite is missing. Exported so UI can reuse the same sprite for wall build/upgrade actions. */
export const WALL_TIER_ICON_NAMES: Record<WallTier, string> = {
  wood: "wall-small",
  rock: "wall-medium",
  steel: "wall-large",
};

const WALL_TIER_COLORS: Record<WallTier, string> = {
  wood: "#6b4423",
  rock: "#707070",
  steel: "#c8d0d8",
};

const TOWER_COLOR = "#c0392b";
const TOWER_RANGE_TINT_SELECTED = "rgba(192, 57, 43, 0.6)";
/** Ring drawn around any tower currently within range of a live horde — makes it visible towers are actually fighting, not just standing there. */
/** Ring around a known, non-depleted scrap stash (ScrapperEconomy Q9). */
const SCRAP_STASH_RING_COLOR = "rgba(140, 150, 160, 0.95)";

const TOWER_ACTIVE_RING_COLOR = "#ffd23f";
const BARRACKS_COLOR = "#8e44ad";
const DOCK_COLOR = "#8a6d3b";
const DEN_COLOR = "#4a1a1a";
/** Fallback for a converted outpost when tiles/structures/outpost.png hasn't loaded yet — reuses the base's ⌂ glyph (it IS a base, functionally) but a distinct color so it reads as base-like without being mistaken for the player's actual main base. */
const OUTPOST_COLOR = "#3a6b8a";
/** Ring drawn around a den currently under siege (hold period) — same technique as TOWER_ACTIVE_RING_COLOR. */
const SIEGE_RING_COLOR = "#ff6b35";
/** Track for in-progress build/upgrade/repair rings on structure tiles (#74). Fill color comes from StructureProgressKind. */
const STRUCTURE_PROGRESS_TRACK = "rgba(255, 255, 255, 0.22)";
/** Deep danger red (playtesting feedback: green read as "safe," not a threat) — distinct from TOWER_COLOR's red so friend/foe stay visually distinguishable. */
const HORDE_COLOR = "#b71c1c";
const GARRISON_COLOR = "#2e7d32";
const GARRISON_RANGE_TINT_SELECTED = "rgba(46, 125, 50, 0.55)";
/** Build-mode toggle (hammer slot, global hex cluster) — a distinct teal not used for any other hex fill (red = tower/combat range, green = garrison range, orange/blue = expedition/relocation target badges), so "buildable right now" reads as its own thing. */
const BUILD_MODE_TINT = "rgba(38, 198, 218, 0.35)";
const EXPEDITION_TARGET_COLOR = "#e08e0b";
const RELOCATION_TARGET_COLOR = "#2e86de";
/** Reuses the existing expedition-target orange for a different purpose: a level badge (drawLevelBadge) colored this way means that structure's next upgrade is unlocked and affordable right now. Deliberately the same constant, not just the same value, so the two meanings stay visibly linked if this color is ever revisited. */
export const UPGRADE_AVAILABLE_BADGE_COLOR = EXPEDITION_TARGET_COLOR;

/** Picks readable icon/text ink against an arbitrary player-chosen background color. */
function contrastingInk(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1a1a1a" : "#ffffff";
}

/** `#rrggbb` → `rgba(...)` for fog/knowledge tints. Falls back if the color is malformed. */
function colorWithAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(40, 70, 110, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Imperative handle exposed via ref, since pan/zoom are internal state here — lets a parent (e.g. a "recenter" button in the header) drive the view without lifting that state up. */
export interface HexCanvasHandle {
  recenterOnBase: () => void;
  /** Pan the view so `coord` sits at the center of the canvas. */
  centerOnCoord: (coord: Axial) => void;
  /** Zoom toward the canvas centre by `factor` (>1 in, <1 out), clamped to MIN/MAX_ZOOM. */
  zoomBy: (factor: number) => void;
  /** Current on-screen pixel position of a tile's center, or null before the initial center-on-base pan has been computed. Recomputed fresh on every call against the latest pan/zoom — safe to call every frame (e.g. to keep a DOM overlay glued to a selected tile). */
  getTileScreenPosition: (coord: Axial) => { x: number; y: number } | null;
}

export const HexCanvas = forwardRef<
  HexCanvasHandle,
  {
    seed: number;
    gridSize: number;
    tweaks: Tweaks;
    base: Axial;
    owned: Axial[];
    extractionTiles: ExtractionTile[];
    towers: Tower[];
    walls: Wall[];
    barracksList: Barracks[];
    powerStations: PowerStation[];
    garrisons: GarrisonsRecord;
    scoutedTiles: Axial[];
    /** Hidden lab + clue progress — drives the final-clue search-zone highlight. */
    lab: LabRecord;
    dens: DenRecord[];
    scrapStashes: ScrapStashesRecord;
    outposts: OutpostRecord[];
    hordes: HordeRecord[];
    expeditions: ExpeditionsRecord;
    denAssaults: DenAssaultsRecord;
    tombstones: TombstonesRecord;
    /** The virtual clock (data/clock.ts:ClockRecord.virtualNow) — used to interpolate each in-flight expedition's current position along its route, same units as Expedition.departedAt/arriveAt. */
    now: number;
    docks: DocksRecord;
    scoutSkiffs: ScoutSkiffsRecord;
    wanderingScouts: WanderingScoutsRecord;
    /** Destination of an in-flight base relocation countdown (data/base.ts:BaseRelocationInProgress), or null if none is running. */
    relocationDestination: Axial | null;
    /** Base doesn't carry its own level the way Tower/Barracks records do (the coord IS the base's identity here) — passed separately so its level badge can be drawn like every other leveled structure. */
    baseLevel: number;
    /** Same reasoning as baseLevel — needed to draw the base's HP bar (see drawHealthBar) the same way outposts/walls already can from their own records. */
    baseCurrentHp: number;
    baseMaxHp: number;
    /**
     * Coord keys (axialKey) of every upgradeable structure — currently base,
     * Tower, Barracks — whose next upgrade is both unlocked AND affordable
     * right now (GameScreen.tsx computes this from the same *UpgradeOptionFor
     * helpers TilePopup's buttons use, so this can never disagree with
     * whether the upgrade button is actually clickable). Colors that
     * structure's level badge orange instead of the default black.
     *
     * Dens intentionally never appear here — a den's level is fixed
     * permanently at world-gen (DESIGN.md §13 / ROADMAP.md Milestone 14),
     * there's no player upgrade to flag. If a structure type becomes
     * player-upgradeable in the future (or a den ever stops being
     * fixed-level), add its coords here upstream and reference
     * `upgradeAvailableKeys.has(coordKey)` at its `drawLevelBadge` call site
     * below, same as base/tower/barracks already do.
     */
    upgradeAvailableKeys: Set<string>;
    /** Coord keys (axialKey) of owned, empty, buildable-land tiles where at least one structure type is currently affordable — tinted teal while build-mode (the hammer slot in the global hex cluster) is active. Empty set when build-mode is off. */
    buildModeEligibleKeys: Set<string>;
    /**
     * Per-tile build/upgrade/repair progress (0 = just started, approaching 1)
     * for circular rings drawn on busy structures. Absent keys are idle.
     * Rebuilt each tick from GameScreen countdown rows so the draw effect
     * refreshes as the virtual clock advances (unlike `now`, which is only
     * used for expedition interpolation today).
     */
    /** Per-tile progress ring data (progress 0..1 + fill color). Absent = idle. */
    structureProgressByKey: Map<string, { progress: number; color: string }>;
    selected: Axial | null;
    playerColor: string;
    onTileClick?: (coord: Axial) => void;
    /**
     * Fired on genuine mouse hover (pointerType "mouse", no buttons held) as
     * the cursor crosses tile boundaries — null once the cursor leaves the
     * canvas. Deliberately mouse-only: touch pointermove events fire while
     * dragging/panning, which isn't "hovering" a tile, and there's no touch
     * equivalent of hover anyway. Not fired while panning/pinching with a
     * mouse either (a held-button drag isn't a hover, same reasoning).
     */
    onTileHover?: (coord: Axial | null) => void;
    /** Fired after every redraw with the viewport currently on screen — lets a parent keep a DOM overlay (e.g. a per-tile action ring) glued to a tile through pan/zoom. Read via a ref internally, not a draw-effect dependency, so an unstable callback identity from the parent doesn't itself trigger extra redraws. */
    onViewportChange?: (viewport: { pan: { x: number; y: number }; zoom: number }) => void;
    /**
     * Dev-server-only: skip fog-of-war culling and overlays so the whole map
     * is visible. Gated by the caller with import.meta.env.DEV — production
     * builds should always pass false/omit.
     */
    fogDisabled?: boolean;
    /**
     * Dev-server-only lab preview (Dev tools cycle):
     * - `hint` — paint the final-clue search cluster even before clues are in
     * - `reveal` — highlight the exact lab tile
     */
    devLabMode?: "off" | "hint" | "reveal";
  }
>(function HexCanvas(
  {
    seed,
    gridSize,
    tweaks,
    base,
    owned,
    extractionTiles,
    towers,
    walls,
    barracksList,
    powerStations,
    garrisons,
    scoutedTiles,
    lab,
    dens,
    scrapStashes,
    outposts,
    hordes,
    expeditions,
    denAssaults,
    tombstones,
    now,
    docks,
    scoutSkiffs,
    wanderingScouts,
    relocationDestination,
    baseLevel,
    baseCurrentHp,
    baseMaxHp,
    upgradeAvailableKeys,
    buildModeEligibleKeys,
    structureProgressByKey,
    selected,
    playerColor,
    onTileClick,
    onTileHover,
    onViewportChange,
    fogDisabled = false,
    devLabMode = "off",
  },
  ref,
) {
  const tilesByKey = useMemo(() => {
    const map = new Map<string, ExtractionTile>();
    for (const tile of extractionTiles) map.set(axialKey(tile.coord), tile);
    return map;
  }, [extractionTiles]);
  const towersByKey = useMemo(() => {
    const map = new Map<string, Tower>();
    for (const tower of towers) map.set(axialKey(tower.coord), tower);
    return map;
  }, [towers]);
  const wallsByKey = useMemo(() => {
    const map = new Map<string, Wall>();
    for (const wall of walls) map.set(axialKey(wall.coord), wall);
    return map;
  }, [walls]);
  const barracksByKey = useMemo(() => {
    const map = new Map<string, Barracks>();
    for (const b of barracksList) map.set(axialKey(b.coord), b);
    return map;
  }, [barracksList]);
  const powerStationsByKey = useMemo(() => {
    const map = new Map<string, PowerStation>();
    for (const station of powerStations) map.set(axialKey(station.coord), station);
    return map;
  }, [powerStations]);
  const garrisonsByKey = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of garrisons) map.set(axialKey(g.coord), g.militiaCount + g.junkyardKnightCount + g.crossBowSniperCount);
    return map;
  }, [garrisons]);
  const densByKey = useMemo(() => {
    const map = new Map<string, DenRecord>();
    for (const den of dens) map.set(axialKey(den.coord), den);
    return map;
  }, [dens]);
  const scrapStashesByKey = useMemo(() => {
    const map = new Map<string, ScrapStashRecord>();
    for (const stash of scrapStashes) map.set(axialKey(stash.coord), stash);
    return map;
  }, [scrapStashes]);
  const outpostsByKey = useMemo(() => {
    const map = new Map<string, OutpostRecord>();
    for (const outpost of outposts) map.set(axialKey(outpost.coord), outpost);
    return map;
  }, [outposts]);
  const hordesByKey = useMemo(() => {
    const map = new Map<string, HordeRecord>();
    for (const horde of hordes) map.set(axialKey(horde.path[horde.pathIndex]), horde);
    return map;
  }, [hordes]);
  const docksByKey = useMemo(() => {
    const map = new Map<string, DockRecord>();
    for (const dock of docks) map.set(axialKey(dock.coord), dock);
    return map;
  }, [docks]);
  const scoutSkiffsByKey = useMemo(() => {
    const map = new Map<string, ScoutSkiffRecord>();
    for (const skiff of scoutSkiffs) map.set(axialKey(skiff.coord), skiff);
    return map;
  }, [scoutSkiffs]);
  const wanderingScoutsByKey = useMemo(() => {
    const map = new Map<string, WanderingScoutRecord>();
    for (const scout of wanderingScouts) map.set(axialKey(scout.coord), scout);
    return map;
  }, [wanderingScouts]);
  const tombstonesByKey = useMemo(() => {
    const map = new Map<string, TombstoneRecord>();
    for (const tombstone of tombstones) map.set(axialKey(tombstone.coord), tombstone);
    return map;
  }, [tombstones]);
  // Destination of any in-flight expedition (App.tsx runTick resolves these
  // on arrival) — just the target coord, so the map shows where a party is
  // headed even though its actual path isn't drawn.
  const expeditionTargetKeys = useMemo(() => {
    const set = new Set<string>();
    for (const expedition of expeditions) set.add(axialKey(expedition.target));
    return set;
  }, [expeditions]);
  // Live en-route position for each in-flight expedition — interpolated from
  // elapsed time against Expedition.path via expeditionPathIndexAt
  // (engine/expeditions.ts), the SAME formula App.tsx's tick loop uses to
  // decide how far a party has really progressed (stepCorridorWalk's
  // targetIndex) — so the visual marker and the logical resolvedIndex can
  // never diverge, the same way a horde's position is read straight off
  // path[pathIndex] (hordesByKey above). Recomputed every tick as `now`
  // ticks forward.
  const expeditionsByKey = useMemo(() => {
    const map = new Map<string, Expedition>();
    for (const expedition of expeditions) {
      const index = expeditionMarkerIndex(expedition, now);
      map.set(axialKey(expedition.path[index]), expedition);
    }
    return map;
  }, [expeditions, now]);
  // Destination of an in-flight den assault (data/denAssaults.ts) — same
  // "where is this headed" corner badge as expeditionTargetKeys above.
  const denAssaultTargetKeys = useMemo(() => {
    const set = new Set<string>();
    for (const assault of denAssaults) set.add(axialKey(assault.target));
    return set;
  }, [denAssaults]);
  // Live en-route position for each in-flight den assault — identical
  // interpolation to expeditionsByKey above (DenAssaultRecord deliberately
  // mirrors Expedition's departedAt/arriveAt/path shape, data/denAssaults.ts),
  // so the marker reads as the same kind of thing on the map.
  const denAssaultsByKey = useMemo(() => {
    const map = new Map<string, DenAssaultRecord>();
    for (const assault of denAssaults) {
      const index = expeditionPathIndexAt(assault.departedAt, assault.arriveAt, now, assault.path.length);
      map.set(axialKey(assault.path[index]), assault);
    }
    return map;
  }, [denAssaults, now]);
  const fogByKey = useMemo(() => computeFogTiers(owned, scoutedTiles), [owned, scoutedTiles]);
  const labSearchZoneKeys = useMemo(
    () => labSearchZoneTileKeys(seed, lab, tweaks, gridSize, { force: devLabMode === "hint" }),
    [seed, lab, tweaks, gridSize, devLabMode],
  );
  const devHighlightLab = devLabMode === "reveal";
  // Only the selected tower's range is shaded (towerRange scales with level,
  // engine/towers.ts) — shading every tower's range at once buried the whole
  // map under a red tint, so coverage is only shown on demand.
  const selectedTowerRangeKeys = useMemo(() => {
    const selectedTower = selected && towersByKey.get(axialKey(selected));
    if (!selectedTower) return null;
    const set = new Set<string>();
    const range = towerRange(tweaks, selectedTower.level, terrainAt(seed, selectedTower.coord));
    for (const coord of axialSpiral(selectedTower.coord, range)) {
      set.add(axialKey(coord));
    }
    return set;
  }, [selected, towersByKey, tweaks, seed]);
  const selectedPowerAoeKeys = useMemo(() => {
    const selectedStation = selected && powerStationsByKey.get(axialKey(selected));
    if (!selectedStation) return null;
    const set = new Set<string>();
    for (const coord of axialSpiral(selectedStation.coord, powerStationAoeRadius(tweaks, selectedStation.level))) {
      set.add(axialKey(coord));
    }
    return set;
  }, [selected, powerStationsByKey, tweaks]);
  // Same on-demand-only shading as selectedTowerRangeKeys, for the selected
  // tile's garrison. Radius depends on what's actually stationed there: a
  // garrison with cross-bow snipers reaches units.cross_bow_sniper.range_tiles
  // (their ranged per-tick damage, engine/hordes.ts:sniperDamagePerSecond);
  // a militia/junkyard-knight-only garrison only ever fights adjacent hordes
  // (engine/garrisons.ts:isHordeReachableFromGarrison's base distance<=1),
  // so its indicator is just 1 tile — either way, +tweaks.walls.garrison_range_bonus_tiles
  // if the garrison is stationed on a non-damaged wall.
  const selectedGarrisonRangeKeys = useMemo(() => {
    const selectedGarrison = selected && garrisonAt(garrisons, selected);
    if (!selectedGarrison) return null;
    const wallBonus = garrisonWallRangeBonus(tweaks, walls, selectedGarrison.coord);
    const radius = (selectedGarrison.crossBowSniperCount > 0 ? tweaks.units.cross_bow_sniper.range_tiles : 1) + wallBonus;
    const set = new Set<string>();
    for (const coord of axialSpiral(selectedGarrison.coord, radius)) {
      set.add(axialKey(coord));
    }
    return set;
  }, [selected, garrisons, tweaks, walls]);
  // Every tower currently within range of at least one live horde — highlighted
  // on the map so it's visible that towers are actually fighting, not just
  // standing there (previously the only feedback was the horde's size number
  // slowly ticking down, easy to miss).
  const activeTowerKeys = useMemo(() => {
    const set = new Set<string>();
    for (const horde of hordes) {
      for (const tower of towersInRange(tweaks, towers, horde.path[horde.pathIndex], seed)) {
        set.add(axialKey(tower.coord));
      }
    }
    return set;
  }, [hordes, towers, tweaks, seed]);
  // Per-horde incoming dps (towers + garrisoned cross-bow snipers in range)
  // and whether it's currently slowed — same combat math advanceHordes uses
  // (engine/hordes.ts), just read-only here for display.
  const hordeCombatByKey = useMemo(() => {
    const map = new Map<string, { dps: number; slowed: boolean }>();
    for (const horde of hordes) {
      const coord = horde.path[horde.pathIndex];
      const inRangeTowers = towersInRange(tweaks, towers, coord, seed);
      const dps =
        towerDamagePerSecond(tweaks, inRangeTowers, horde.size, garrisons) + sniperDamagePerSecond(tweaks, garrisons, walls, coord);
      map.set(axialKey(coord), { dps, slowed: inRangeTowers.length > 0 });
    }
    return map;
  }, [hordes, towers, garrisons, walls, tweaks, seed]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number } | null>(null);
  // Keep latest zoom/pan in refs so imperative zoomBy (hold-to-repeat) doesn't
  // stack steps on a stale closure between React commits.
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  // Mobile pinch-to-zoom — every currently-touching pointer's latest screen
  // position, keyed by pointerId (pointer events unify mouse/touch/pen, so
  // this is populated by touch as well as e.g. a stylus). Once a second
  // pointer joins, drag-panning (dragRef above) hands off to pinch scaling.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchRef = useRef<{
    initialDistance: number;
    initialZoom: number;
    initialMidpoint: { x: number; y: number };
    initialPan: { x: number; y: number };
  } | null>(null);
  // Sticky for the whole gesture (not reset until every pointer lifts) so a
  // pinch that happens to end on a single remaining finger doesn't get
  // mistaken for a tap-to-select-tile in handlePointerUp's last branch.
  const multiTouchRef = useRef(false);
  /** False once the view has been centered on the base at the container's real layout size — avoids a stale pan from the canvas's default 300×150 backing store before ResizeObserver runs (ROADMAP #15). */
  const pendingInitialCenterRef = useRef(true);

  // Tile textures load async and are cached forever once loaded — this counter
  // just forces the draw effect below to rerun the first time each one resolves.
  const [textureVersion, setTextureVersion] = useState(0);
  useEffect(() => onTextureLoad(() => setTextureVersion((v) => v + 1)), []);

  // Read via a ref (not a draw-effect dependency) so a new function identity
  // from the parent on every render doesn't itself force a redraw.
  const onViewportChangeRef = useRef(onViewportChange);
  useEffect(() => {
    onViewportChangeRef.current = onViewportChange;
  }, [onViewportChange]);

  // Same ref-not-dependency reasoning as onViewportChangeRef — read from
  // handlePointerMove, which isn't itself a React-dependency-tracked callback.
  const onTileHoverRef = useRef(onTileHover);
  useEffect(() => {
    onTileHoverRef.current = onTileHover;
  }, [onTileHover]);
  // Last axialKey reported to onTileHover — de-dupes so crossing pixels
  // within the same hex doesn't re-fire the callback (and the parent's
  // resulting state update) on every mousemove frame.
  const hoveredKeyRef = useRef<string | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      recenterOnBase() {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        setZoom(1);
        zoomRef.current = 1;
        setPan(centerPanOnCoord(base, canvas.width, canvas.height));
        pendingInitialCenterRef.current = false;
      },
      centerOnCoord(coord: Axial) {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        if (canvas.width === 0 || canvas.height === 0) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
        }
        setPan(centerPanOnCoord(coord, canvas.width, canvas.height));
        pendingInitialCenterRef.current = false;
      },
      zoomBy(factor: number) {
        const canvas = canvasRef.current;
        const currentPan = panRef.current;
        const currentZoom = zoomRef.current;
        if (!canvas || currentPan === null) return;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const worldX = (centerX - currentPan.x) / currentZoom;
        const worldY = (centerY - currentPan.y) / currentZoom;
        const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, currentZoom * factor));
        const nextPan = { x: centerX - worldX * nextZoom, y: centerY - worldY * nextZoom };
        zoomRef.current = nextZoom;
        panRef.current = nextPan;
        setPan(nextPan);
        setZoom(nextZoom);
      },
      getTileScreenPosition(coord: Axial) {
        const currentPan = panRef.current;
        const currentZoom = zoomRef.current;
        if (currentPan === null) return null;
        const canvas = canvasRef.current;
        if (!canvas) return null;
        // pan/zoom operate in the canvas's own backing-buffer coordinate
        // space (0,0 = the canvas element's own top-left corner) — but this
        // is meant for viewport-fixed DOM overlays (HoverTooltip), so it
        // needs the canvas's own on-page offset added, or an overlay renders
        // shifted by however far the canvas sits from the viewport origin
        // (e.g. up and left, since the header above it pushes it down).
        const rect = canvas.getBoundingClientRect();
        const worldPixel = axialToPixel(coord, BASE_HEX_SIZE);
        return {
          x: worldPixel.x * currentZoom + currentPan.x + rect.left,
          y: worldPixel.y * currentZoom + currentPan.y + rect.top,
        };
      },
    }),
    [base],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    function resize() {
      if (!canvas || !container) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      if (
        pendingInitialCenterRef.current &&
        container.clientWidth > 0 &&
        container.clientHeight > 0
      ) {
        setPan(centerPanOnBase(base, canvas.width, canvas.height));
        pendingInitialCenterRef.current = false;
        return;
      }
      draw();
    }

    function draw() {
      if (!canvas || pan === null) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#0a0a0c";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const size = BASE_HEX_SIZE * zoom;

      const context = ctx;
      const strokeSelection = (corners: { x: number; y: number }[]) => {
        context.beginPath();
        corners.forEach((corner, i) => {
          if (i === 0) context.moveTo(corner.x, corner.y);
          else context.lineTo(corner.x, corner.y);
        });
        context.closePath();
        // A soft, translucent outer glow plus a crisp inner line, both the
        // player's own color — one hue, not the old black-shadow/white-line pair.
        context.strokeStyle = playerColor;
        context.globalAlpha = 0.35;
        context.lineWidth = Math.max(4, size * 0.22);
        context.stroke();
        context.globalAlpha = 1;
        context.lineWidth = Math.max(2, size * 0.1);
        context.stroke();
      };

      // Level badge for a structure (base/den/tower/barracks/extraction) —
      // bottom-centre so taller building sprites don't cover it. Opposite the
      // garrison count badge (top-right). Black by default; pass badgeColor
      // to flag an available+affordable upgrade (UPGRADE_AVAILABLE_BADGE_COLOR).
      const drawLevelBadge = (screenCenter: { x: number; y: number }, level: number, badgeColor: string = "#000000") => {
        const badgeX = screenCenter.x;
        const badgeY = screenCenter.y + size * 0.6;
        context.save();
        context.globalAlpha = 0.85;
        context.beginPath();
        context.arc(badgeX, badgeY, size * 0.250, 0, Math.PI * 2);
        context.fillStyle = badgeColor;
        context.fill();
        context.strokeStyle = "rgba(255, 255, 255, 0.6)";
        context.stroke();
        context.fillStyle = "#ffffff";
        context.font = `${Math.max(6, size * 0.285)}px sans-serif`;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillText(String(level), badgeX, badgeY);
        context.restore();
      };

      // Circular fill for a structure-tied timer (build/upgrade/repair/…).
      // Same radius band as the siege/active-tower rings so it frames the
      // icon without fighting the bottom-centre level badge.
      const drawProgressRing = (
        screenCenter: { x: number; y: number },
        entry: { progress: number; color: string },
      ) => {
        const fraction = Math.max(0, Math.min(1, entry.progress));
        const radius = size * 0.58;
        const lineWidth = Math.max(2, size * 0.12);
        context.save();
        context.lineWidth = lineWidth;
        context.lineCap = "round";
        context.beginPath();
        context.arc(screenCenter.x, screenCenter.y, radius, 0, Math.PI * 2);
        context.strokeStyle = STRUCTURE_PROGRESS_TRACK;
        context.stroke();
        if (fraction > 0) {
          context.beginPath();
          context.arc(
            screenCenter.x,
            screenCenter.y,
            radius,
            -Math.PI / 2,
            -Math.PI / 2 + fraction * Math.PI * 2,
          );
          context.strokeStyle = entry.color;
          context.stroke();
        }
        context.restore();
      };

      // HP/durability edge bar (base, outpost, wall) — "at a glance" on the
      // map itself rather than requiring a click, red/orange/green banding
      // matching how players already read health bars in most games
      // (<30% / 30-60% / 60%+). Default bottom-right; base uses top-centre so
      // the tall base sprite doesn't cover it.
      const drawHealthBar = (
        screenCenter: { x: number; y: number },
        current: number,
        max: number,
        placement: "bottom-right" | "top-center" = "bottom-right",
      ) => {
        if (max <= 0) return;
        if (current >= max) return;
        const fraction = Math.max(0, Math.min(1, current / max));
        const barWidth = size * 0.75;
        const barHeight = Math.max(3, size * 0.16);
        const barX =
          placement === "top-center"
            ? screenCenter.x - barWidth / 2
            : screenCenter.x + size * 0.55 - barWidth / 2;
        const barY =
          placement === "top-center"
            ? screenCenter.y - size * 0.99 - barHeight / 2
            : screenCenter.y + size * 0.55 - barHeight / 2;
        const fillColor = fraction < 0.3 ? "#e74c3c" : fraction < 0.6 ? "#f39c12" : "#2ecc71";
        context.fillStyle = "rgba(0, 0, 0, 0.6)";
        context.fillRect(barX, barY, barWidth, barHeight);
        context.fillStyle = fillColor;
        context.fillRect(barX, barY, barWidth * fraction, barHeight);
        context.strokeStyle = "rgba(255, 255, 255, 0.6)";
        context.lineWidth = 1;
        context.strokeRect(barX, barY, barWidth, barHeight);
      };

      // World-space visible rectangle, then converted to a row range and,
      // per row, a column range — avoids scanning the whole 128x128 grid.
      const worldLeft = (0 - pan.x) / zoom;
      const worldRight = (canvas.width - pan.x) / zoom;
      const worldTop = (0 - pan.y) / zoom;
      const worldBottom = (canvas.height - pan.y) / zoom;

      const sqrt3 = Math.sqrt(3);
      const rMin = Math.floor(worldTop / (BASE_HEX_SIZE * 1.5)) - 1;
      const rMax = Math.ceil(worldBottom / (BASE_HEX_SIZE * 1.5)) + 1;

      // Pass 1: terrain layer only (flat color, texture, path-tile fill) for
      // every visible tile. This tile art is drawn un-clipped (a tile's
      // texture can bleed upward into the tile above it — a mountain peak
      // rising into its neighbor), so the whole terrain layer is finished
      // before pass 2 applies fog: fog tint is re-painted per-tile on top of
      // this complete layer, so it always wins regardless of what bled into
      // it from a tile below.
      for (let r = Math.max(0, rMin); r <= Math.min(gridSize - 1, rMax); r++) {
        const qMin = Math.floor(worldLeft / (BASE_HEX_SIZE * sqrt3) - r / 2) - 1;
        const qMax = Math.ceil(worldRight / (BASE_HEX_SIZE * sqrt3) - r / 2) + 1;

        for (let q = qMin; q <= qMax; q++) {
          const coord: Axial = { q, r };
          if (!isWithinMapBounds(coord, gridSize)) continue;
          const inLabSearchZone = labSearchZoneKeys?.has(axialKey(coord)) ?? false;
          // Hidden tiles normally skip terrain; draw them inside the final-clue
          // search zone so a reduced fog overlay can show a faint peek.
          if (!fogDisabled && fogTierFor(coord, fogByKey) === "hidden" && !inLabSearchZone) continue;

          const worldPixel = axialToPixel(coord, BASE_HEX_SIZE);
          const screenCenter = { x: worldPixel.x * zoom + pan.x, y: worldPixel.y * zoom + pan.y };
          const corners = hexCorners(screenCenter, size);

          ctx.beginPath();
          corners.forEach((corner, i) => {
            if (i === 0) ctx.moveTo(corner.x, corner.y);
            else ctx.lineTo(corner.x, corner.y);
          });
          ctx.closePath();

          // Drawn before the fill/texture below so it sits underneath — each
          // tile's own opaque fill (and its neighbor's, on the far side of
          // the shared edge) fully covers this line once both are painted,
          // so it only ever shows through the flat-color fallback, not a
          // loaded texture.
          ctx.strokeStyle = "rgba(0, 0, 0, 0.25)";
          ctx.lineWidth = 1;
          ctx.stroke();

          const terrain = terrainAt(seed, coord);
          ctx.fillStyle = TERRAIN_COLORS[terrain];
          ctx.fill();
          const terrainImg = getTerrainTexture(terrain);
          if (terrainImg) {
            drawHexTileTexture(ctx, terrainImg, screenCenter.x, screenCenter.y, size * sqrt3, size * 2);
            drawHexTileOverlay(ctx, terrainImg, screenCenter.x, screenCenter.y - size, size * sqrt3, size * 2);
          }

        }
      }

      // Pass 2: fog/tints → selection ring → structures → markers.
      // Drawn after the whole terrain layer so fog tint and the
      // hidden-tile fill always paint over any texture bleed from pass 1;
      // selection is intentionally under structure sprites.
      for (let r = Math.max(0, rMin); r <= Math.min(gridSize - 1, rMax); r++) {
        const qMin = Math.floor(worldLeft / (BASE_HEX_SIZE * sqrt3) - r / 2) - 1;
        const qMax = Math.ceil(worldRight / (BASE_HEX_SIZE * sqrt3) - r / 2) + 1;

        for (let q = qMin; q <= qMax; q++) {
          const coord: Axial = { q, r };
          if (!isWithinMapBounds(coord, gridSize)) continue;

          const tier = fogDisabled ? "owned" : fogTierFor(coord, fogByKey);
          const isSelected = selected !== null && axialEquals(coord, selected);
          const isDevLabHighlight = devHighlightLab && axialEquals(coord, lab.coord);

          const worldPixel = axialToPixel(coord, BASE_HEX_SIZE);
          const screenCenter = { x: worldPixel.x * zoom + pan.x, y: worldPixel.y * zoom + pan.y };
          const corners = hexCorners(screenCenter, size);

          ctx.beginPath();
          corners.forEach((corner, i) => {
            if (i === 0) ctx.moveTo(corner.x, corner.y);
            else ctx.lineTo(corner.x, corner.y);
          });
          ctx.closePath();

          const coordKey = axialKey(coord);
          const inLabSearchZone = labSearchZoneKeys?.has(coordKey) ?? false;

          if (tier === "hidden") {
            ctx.fillStyle = inLabSearchZone ? LAB_SEARCH_ZONE_FOG.hidden : (FOG_OVERLAY.hidden as string);
            ctx.fill();
            if (isSelected || isDevLabHighlight) strokeSelection(corners);
            continue;
          }

          if (tier === "scouted") {
            // Final-clue cluster: light player-color wash instead of the usual
            // blue knowledge tint so the search area reads clearly.
            ctx.fillStyle = inLabSearchZone
              ? colorWithAlpha(playerColor, LAB_SEARCH_ZONE_SCOUTED_ALPHA)
              : (FOG_OVERLAY.scouted as string);
            ctx.fill();
          } else if (inLabSearchZone && (tier === "heavy" || tier === "light")) {
            ctx.fillStyle = LAB_SEARCH_ZONE_FOG[tier];
            ctx.fill();
          } else {
            const overlay = FOG_OVERLAY[tier];
            if (overlay) {
              ctx.fillStyle = overlay;
              ctx.fill();
            }
          }

          if (selectedTowerRangeKeys?.has(coordKey)) {
            ctx.fillStyle = TOWER_RANGE_TINT_SELECTED;
            ctx.fill();
          }
          if (selectedPowerAoeKeys?.has(coordKey)) {
            ctx.fillStyle = POWER_AOE_TINT_SELECTED;
            ctx.fill();
          }
          if (selectedGarrisonRangeKeys?.has(coordKey)) {
            ctx.fillStyle = GARRISON_RANGE_TINT_SELECTED;
            ctx.fill();
          }
          if (buildModeEligibleKeys.has(coordKey)) {
            ctx.fillStyle = BUILD_MODE_TINT;
            ctx.fill();
          }
          if (isDevLabHighlight) {
            ctx.fillStyle = colorWithAlpha(playerColor, 0.35);
            ctx.fill();
          }

          // Selection ring after terrain/path (pass 1) and fog/tints, but
          // before structure sprites so the stroke sits under buildings
          // instead of clipping their lower edge.
          if (isSelected || isDevLabHighlight) strokeSelection(corners);

          // Known scrap stashes (owned/scouted fog) — resource-pin art + grey ring (Q9/Q70).
          const scrapStash = scrapStashesByKey.get(coordKey);
          if (scrapStash && isActiveScrapStash(scrapStash) && (tier === "owned" || tier === "scouted")) {
            ctx.beginPath();
            ctx.arc(screenCenter.x, screenCenter.y, size * 0.52, 0, Math.PI * 2);
            ctx.strokeStyle = SCRAP_STASH_RING_COLOR;
            ctx.lineWidth = Math.max(2, size * 0.1);
            ctx.stroke();
            const scrapImg = getScrapTexture(scrapStash.artVariant);
            if (scrapImg) {
              drawPlacedScrapIcon(ctx, scrapImg, screenCenter.x, screenCenter.y, size);
            } else {
              ctx.beginPath();
              ctx.arc(screenCenter.x, screenCenter.y, size * 0.28, 0, Math.PI * 2);
              ctx.fillStyle = RESOURCE_MARKER_COLORS.steel;
              ctx.fill();
              ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
              ctx.stroke();
            }
          }

          if (axialEquals(coord, base)) {
            const baseIcon = getStructureIconTextureCandidates(structureLevelCandidates("base", baseLevel));
            if (baseIcon) {
              drawPlacedStructureIcon(
                ctx,
                baseIcon,
                screenCenter.x,
                screenCenter.y,
                size,
                "base",
                structureLevelName("base", baseLevel),
              );
            } else {
              ctx.beginPath();
              ctx.arc(screenCenter.x, screenCenter.y, size * 0.55, 0, Math.PI * 2);
              ctx.fillStyle = playerColor;
              ctx.fill();
              ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
              ctx.lineWidth = 2;
              ctx.stroke();
              ctx.fillStyle = contrastingInk(playerColor);
              ctx.font = `${Math.max(10, size * 0.7)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("⌂", screenCenter.x, screenCenter.y);
            }
            drawLevelBadge(
              screenCenter,
              baseLevel,
              upgradeAvailableKeys.has(coordKey) ? UPGRADE_AVAILABLE_BADGE_COLOR : undefined,
            );
            drawHealthBar(screenCenter, baseCurrentHp, baseMaxHp, "top-center");
            const baseProgress = structureProgressByKey.get(coordKey);
            if (baseProgress != null && baseProgress.progress < 1) {
              drawProgressRing(screenCenter, baseProgress);
            }
          } else {
            const tower = towersByKey.get(axialKey(coord));
            const wall = wallsByKey.get(axialKey(coord));
            const barracks = barracksByKey.get(axialKey(coord));
            const powerStation = powerStationsByKey.get(axialKey(coord));
            const tile = tilesByKey.get(axialKey(coord));
            const den = densByKey.get(axialKey(coord));
            const outpost = outpostsByKey.get(axialKey(coord));
            const dock = docksByKey.get(axialKey(coord));

            if (outpost) {
              const outpostIcon = getStructureIconTexture("outpost");
              if (outpostIcon) {
                drawPlacedStructureIcon(ctx, outpostIcon, screenCenter.x, screenCenter.y, size, "outpost");
              } else {
                ctx.beginPath();
                ctx.arc(screenCenter.x, screenCenter.y, size * 0.55, 0, Math.PI * 2);
                ctx.fillStyle = OUTPOST_COLOR;
                ctx.fill();
                ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = "#ffffff";
                ctx.font = `${Math.max(10, size * 0.7)}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("⌂", screenCenter.x, screenCenter.y);
              }
              drawHealthBar(screenCenter, outpost.currentHp, outpostReinforcementHp(tweaks, outpost.reinforcementLevel));
            } else if (den) {
              if (den.siege) {
                ctx.beginPath();
                ctx.arc(screenCenter.x, screenCenter.y, size * 0.52, 0, Math.PI * 2);
                ctx.strokeStyle = SIEGE_RING_COLOR;
                ctx.lineWidth = Math.max(2, size * 0.12);
                ctx.stroke();
              }
              const denIcon = getStructureIconTexture("den");
              if (denIcon) {
                drawPlacedStructureIcon(ctx, denIcon, screenCenter.x, screenCenter.y, size, "den");
              } else {
                ctx.beginPath();
                ctx.arc(screenCenter.x, screenCenter.y, size * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = DEN_COLOR;
                ctx.fill();
                ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
                ctx.stroke();
              }
              // No badgeColor override here: a den's level is fixed at world-gen
              // (see the upgradeAvailableKeys doc comment above) — never
              // upgradeable, so it never gets the orange treatment.
              drawLevelBadge(screenCenter, den.level);
            } else if (tower) {
              if (activeTowerKeys.has(coordKey)) {
                ctx.beginPath();
                ctx.arc(screenCenter.x, screenCenter.y, size * 0.52, 0, Math.PI * 2);
                ctx.strokeStyle = TOWER_ACTIVE_RING_COLOR;
                ctx.lineWidth = Math.max(2, size * 0.12);
                ctx.stroke();
              }
              const towerIcon = tower.buildStartedAt
                ? getStructureIconTexture("construction")
                : getStructureIconTextureCandidates(structureLevelCandidates("tower", tower.level));
              if (towerIcon) {
                drawPlacedStructureIcon(
                  ctx,
                  towerIcon,
                  screenCenter.x,
                  screenCenter.y,
                  size,
                  tower.buildStartedAt ? "construction" : "tower",
                  tower.buildStartedAt ? null : structureLevelName("tower", tower.level),
                );
              } else {
                ctx.beginPath();
                ctx.arc(screenCenter.x, screenCenter.y, size * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = TOWER_COLOR;
                ctx.fill();
                ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
                ctx.stroke();
              }
              drawLevelBadge(screenCenter, tower.level, upgradeAvailableKeys.has(coordKey) ? UPGRADE_AVAILABLE_BADGE_COLOR : undefined);
            } else if (powerStation) {
              const stationIcon = powerStation.buildStartedAt
                ? getStructureIconTexture("construction")
                : getStructureIconTextureCandidates(powerStationSpriteCandidates(powerStation.level));
              if (stationIcon) {
                drawPlacedStructureIcon(
                  ctx,
                  stationIcon,
                  screenCenter.x,
                  screenCenter.y,
                  size,
                  powerStation.buildStartedAt ? "construction" : "powerStation",
                  powerStation.buildStartedAt ? null : powerStationVariantStem(powerStation.level),
                );
              } else {
                ctx.beginPath();
                ctx.arc(screenCenter.x, screenCenter.y, size * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = POWER_STATION_COLOR;
                ctx.fill();
                ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
                ctx.stroke();
              }
              drawLevelBadge(
                screenCenter,
                powerStation.level,
                upgradeAvailableKeys.has(coordKey) ? UPGRADE_AVAILABLE_BADGE_COLOR : undefined,
              );
            } else if (barracks) {
              const barracksIcon = barracks.buildStartedAt
                ? getStructureIconTexture("construction")
                : getStructureIconTextureCandidates(structureLevelCandidates("barracks", barracks.level));
              if (barracksIcon) {
                drawPlacedStructureIcon(
                  ctx,
                  barracksIcon,
                  screenCenter.x,
                  screenCenter.y,
                  size,
                  barracks.buildStartedAt ? "construction" : "barracks",
                  barracks.buildStartedAt ? null : structureLevelName("barracks", barracks.level),
                );
              } else {
                ctx.beginPath();
                ctx.arc(screenCenter.x, screenCenter.y, size * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = BARRACKS_COLOR;
                ctx.fill();
                ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
                ctx.stroke();
              }
              drawLevelBadge(
                screenCenter,
                barracks.level,
                upgradeAvailableKeys.has(coordKey) ? UPGRADE_AVAILABLE_BADGE_COLOR : undefined,
              );
            } else if (wall) {
              const wallIcon = wall.buildStartedAt
                ? getStructureIconTexture("construction")
                : getStructureIconTexture(WALL_TIER_ICON_NAMES[wall.tier]);
              if (wallIcon) {
                drawPlacedStructureIcon(
                  ctx,
                  wallIcon,
                  screenCenter.x,
                  screenCenter.y,
                  size,
                  wall.buildStartedAt ? "construction" : "wall",
                  wall.buildStartedAt ? null : WALL_TIER_ICON_NAMES[wall.tier],
                );
              } else {
                ctx.beginPath();
                ctx.arc(screenCenter.x, screenCenter.y, size * 0.45, 0, Math.PI * 2);
                ctx.fillStyle = WALL_TIER_COLORS[wall.tier];
                ctx.fill();
                ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
                ctx.stroke();
              }
              drawHealthBar(screenCenter, wall.durability, maxWallDurability(tweaks, wall.tier));
            } else if (tile) {
              if (tile.buildStartedAt) {
                const constructionIcon = getStructureIconTexture("construction");
                if (constructionIcon) {
                  drawPlacedStructureIcon(ctx, constructionIcon, screenCenter.x, screenCenter.y, size, "construction");
                } else {
                  ctx.beginPath();
                  ctx.arc(screenCenter.x, screenCenter.y, size * 0.35, 0, Math.PI * 2);
                  ctx.fillStyle = RESOURCE_MARKER_COLORS[tile.resource];
                  ctx.fill();
                  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
                  ctx.stroke();
                }
              } else {
                const extractionIcon = getStructureIconTextureCandidates(
                  extractionTierCandidates(tile.resource, tile.tier),
                );
                if (extractionIcon) {
                  drawPlacedStructureIcon(
                    ctx,
                    extractionIcon,
                    screenCenter.x,
                    screenCenter.y,
                    size,
                    "extraction",
                    `${tile.resource}-${tile.tier}`,
                  );
                } else {
                  const resourceImg = getResourceTexture(tile.resource);
                  if (resourceImg) {
                    drawPlacedResourceIcon(ctx, resourceImg, screenCenter.x, screenCenter.y, size, tile.resource);
                  } else {
                    ctx.beginPath();
                    ctx.arc(screenCenter.x, screenCenter.y, size * 0.35, 0, Math.PI * 2);
                    ctx.fillStyle = RESOURCE_MARKER_COLORS[tile.resource];
                    ctx.fill();
                    ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
                    ctx.stroke();
                  }
                }
              }
              if (!tile.buildStartedAt && !tile.damaged) {
                drawLevelBadge(
                  screenCenter,
                  extractionTierLevel(tile.tier),
                  upgradeAvailableKeys.has(coordKey) ? UPGRADE_AVAILABLE_BADGE_COLOR : undefined,
                );
              }
            } else if (dock) {
              const level = dock.level ?? (dock.fishingBoat ? 3 : 1);
              const dockStem = level >= 3 || dock.fishingBoat ? "dock-boat" : `dock-${level}`;
              const dockIcon = getStructureIconTextureCandidates(dockSpriteCandidates(level));
              if (dockIcon) {
                drawPlacedStructureIcon(ctx, dockIcon, screenCenter.x, screenCenter.y, size, "dock", dockStem);
              } else {
                ctx.beginPath();
                ctx.arc(screenCenter.x, screenCenter.y, size * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = DOCK_COLOR;
                ctx.fill();
                ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
                ctx.stroke();
              }
              // Emoji boat marker only when there is no dedicated dock-boat sprite yet.
              if ((level >= 3 || dock.fishingBoat) && !getStructureIconTexture("dock-boat")) {
                ctx.font = `${Math.max(9, size * 0.5)}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText("⛵", screenCenter.x, screenCenter.y);
              }
            }

            const structureProgress = structureProgressByKey.get(coordKey);
            if (structureProgress != null && structureProgress.progress < 1) {
              drawProgressRing(screenCenter, structureProgress);
            }

            // A horde-captured structure of any kind goes non-functional
            // until reclaimed and repaired (markCapturedStructuresDamaged,
            // engine/hordes.ts) — overlaid on top of its marker so "this
            // isn't working right now" reads at a glance, not just from the
            // tile popup's text. Docks are immune to horde capture, so
            // they're deliberately excluded here.
            if (tower?.damaged || wall?.damaged || barracks?.damaged || tile?.damaged || powerStation?.damaged) {
              ctx.font = `${Math.max(10, size * 0.55)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("💀", screenCenter.x, screenCenter.y);
            }
          }

          // A scout skiff wanders freely over water — drawn as a small top-
          // layer icon (like the horde marker) rather than competing with the
          // per-tile structure marker above, since it's a transient mobile
          // unit, not something standing on this specific tile permanently.
          const scoutSkiff = scoutSkiffsByKey.get(coordKey);
          // Hide while training — tray shows the build timer; drawing the unit
          // on the dock made unfinished skiffs look idle/stuck.
          if (scoutSkiff && scoutSkiff.buildStartedAt == null) {
            const skiffIcon = getUnitIconTexture("skiff");
            if (skiffIcon) {
              drawImageAtWidth(ctx, skiffIcon, screenCenter.x, screenCenter.y, size);
            } else {
              ctx.font = `${Math.max(10, size * 0.55)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("🛶", screenCenter.x, screenCenter.y);
            }
          }

          // Land counterpart of the scout skiff above — same top-layer,
          // transient-marker treatment.
          const wanderingScout = wanderingScoutsByKey.get(coordKey);
          if (wanderingScout && wanderingScout.buildStartedAt == null) {
            const wanderingScoutImg = getUnitIconTexture("wandering-scout");
            if (wanderingScoutImg) {
              drawImageAtWidth(ctx, wanderingScoutImg, screenCenter.x, screenCenter.y, size);
            } else {
              ctx.font = `${Math.max(10, size * 0.55)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("🚶", screenCenter.x, screenCenter.y);
            }
          }

          // Live en-route marker for an in-flight expedition (expeditionsByKey,
          // interpolated from elapsed time) — same top-layer, transient-marker
          // treatment as the scout skiff/wandering scout above. The
          // destination-tile corner badge (further below) still answers
          // "where is this headed"; this answers "how far along is it."
          const expedition = expeditionsByKey.get(coordKey);
          if (expedition) {
            const expeditionIcon = getUnitIconTexture("expedition");
            if (expeditionIcon) {
              drawImageAtWidth(ctx, expeditionIcon, screenCenter.x, screenCenter.y, size * 2.0);
            } else {
              ctx.font = `${Math.max(10, size * 0.55)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("🎒", screenCenter.x, screenCenter.y);
            }
          }

          // Live en-route marker for an in-flight den assault — same
          // treatment (and same "expedition" icon) as the expedition marker
          // above, since a den assault is dispatched/resolved exactly like
          // one (data/denAssaults.ts).
          const denAssault = denAssaultsByKey.get(coordKey);
          if (denAssault) {
            const expeditionIcon = getUnitIconTexture("expedition");
            if (expeditionIcon) {
              drawImageAtWidth(ctx, expeditionIcon, screenCenter.x, screenCenter.y, size * 2.0);
            } else {
              ctx.font = `${Math.max(10, size * 0.55)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("🎒", screenCenter.x, screenCenter.y);
            }
          }

          // A tombstone marks where a party died mid-route (data/tombstones.ts)
          // — purely informational (click-to-inspect via TilePopup), same
          // top-layer transient-marker treatment as the scout skiff/wandering
          // scout/expedition markers above. Expires on its own (App.tsx's
          // tick loop), so this only ever draws while it's still fresh.
          const tombstone = tombstonesByKey.get(coordKey);
          if (tombstone) {
            const tombstoneIcon = getUnitIconTexture("tombstone");
            if (tombstoneIcon) {
              drawImageAtWidth(ctx, tombstoneIcon, screenCenter.x, screenCenter.y, size * 1.2);
            } else {
              ctx.font = `${Math.max(10, size * 0.55)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.fillText("🪦", screenCenter.x, screenCenter.y);
            }
          }

          // Dev Show-lab toggle — label on top of the tint/ring so the tile
          // is unmistakable even on busy terrain.
          if (isDevLabHighlight) {
            ctx.font = `bold ${Math.max(11, size * 0.5)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = Math.max(3, size * 0.12);
            ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
            ctx.strokeText("LAB", screenCenter.x, screenCenter.y);
            ctx.fillStyle = "#ffffff";
            ctx.fillText("LAB", screenCenter.x, screenCenter.y);
          }

          // Drawn on top of everything else, including the base icon — a
          // horde parked on a tile (even the base, which it can never
          // actually capture pre-Milestone 12) must always stay visible;
          // it's the single most important thing on that tile right now.
          const horde = hordesByKey.get(axialKey(coord));
          if (horde) {
            const hordeIcon = getUnitIconTexture("horde");
            if (hordeIcon) {
              drawImageAtWidth(ctx, hordeIcon, screenCenter.x, screenCenter.y, size * 1.6);
            } else {
              ctx.beginPath();
              ctx.moveTo(screenCenter.x, screenCenter.y - size * 0.45);
              ctx.lineTo(screenCenter.x + size * 0.45, screenCenter.y + size * 0.35);
              ctx.lineTo(screenCenter.x - size * 0.45, screenCenter.y + size * 0.35);
              ctx.closePath();
              ctx.fillStyle = HORDE_COLOR;
              ctx.fill();
              ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
              ctx.stroke();
            }
            ctx.fillStyle = hordeIcon ? "#ffffff" : "#1a1a1a";
            ctx.font = `${Math.max(9, size * 0.45)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            const hordeSizeY = hordeIcon ? screenCenter.y - size * 0.55 : screenCenter.y + size * 0.08;
            ctx.fillText(String(Math.round(horde.size)), screenCenter.x, hordeSizeY);

            // Surfaces what's actually happening to this horde right now —
            // previously the only feedback was its size number slowly
            // ticking down, easy to miss against a busy map.
            const combat = hordeCombatByKey.get(coordKey);
            if (combat && (combat.dps > 0 || combat.slowed)) {
              const label = combat.dps > 0 ? `-${combat.dps.toFixed(1)}/s${combat.slowed ? " 🐌" : ""}` : "🐌";
              ctx.fillStyle = "#ffffff";
              ctx.font = `${Math.max(8, size * 0.32)}px sans-serif`;
              ctx.textAlign = "center";
              ctx.textBaseline = "middle";
              ctx.strokeStyle = "rgba(0, 0, 0, 0.75)";
              ctx.lineWidth = Math.max(2, size * 0.08);
              // Pushed further up than the un-iconed default so it clears the
              // horde size number's new top-center position above.
              const combatY = hordeIcon ? screenCenter.y - size * 0.85 : screenCenter.y - size * 0.62;
              ctx.strokeText(label, screenCenter.x, combatY);
              ctx.fillText(label, screenCenter.x, combatY);
            }
          }

          // A garrison stacks additively with whatever else is on the tile
          // (engine/hordes.ts:hordeTileDefense), so it gets a small corner
          // badge instead of the center marker — it never has to compete
          // with a tower/wall/den/horde icon for the same spot.
          const garrisonCount = garrisonsByKey.get(coordKey);
          if (garrisonCount) {
            const badgeX = screenCenter.x + size * 0.55;
            const badgeY = screenCenter.y - size * 0.55;
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, size * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = GARRISON_COLOR;
            ctx.fill();
            ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
            ctx.stroke();
            ctx.fillStyle = "#ffffff";
            ctx.font = `${Math.max(8, size * 0.38)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(String(garrisonCount), badgeX, badgeY);
          }

          // Mirrors the garrison badge on the opposite corner — a party is
          // en route here, resolved on arrival by App.tsx's runTick. A den
          // is never itself a valid expedition target (GameScreen.tsx gates
          // expeditions to unowned non-den tiles), so this and the den
          // assault badge just below never both fire on the same tile.
          if (expeditionTargetKeys.has(coordKey)) {
            const badgeX = screenCenter.x - size * 0.55;
            const badgeY = screenCenter.y - size * 0.55;
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, size * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = EXPEDITION_TARGET_COLOR;
            ctx.fill();
            ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
            ctx.stroke();
            ctx.font = `${Math.max(10, size * 0.4)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("⛺", badgeX, badgeY);
          }

          // Same corner badge, for a den currently being assaulted (party
          // still in transit — not yet the siege ring drawn on the den's own
          // marker above, which only starts once the assault has arrived
          // and won).
          if (denAssaultTargetKeys.has(coordKey)) {
            const badgeX = screenCenter.x - size * 0.55;
            const badgeY = screenCenter.y - size * 0.55;
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, size * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = EXPEDITION_TARGET_COLOR;
            ctx.fill();
            ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
            ctx.stroke();
            ctx.font = `${Math.max(10, size * 0.4)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("⛺", badgeX, badgeY);
          }

          // Bottom-right corner — the other three are taken by the garrison
          // badge (top-right) and expedition badge (top-left), with the
          // horde triangle and 💀 overlay both centered on the tile.
          // (Power-station grid status uses a DOM collect-style pin instead.)
          if (relocationDestination && axialEquals(coord, relocationDestination)) {
            const badgeX = screenCenter.x + size * 0.55;
            const badgeY = screenCenter.y + size * 0.55;
            ctx.beginPath();
            ctx.arc(badgeX, badgeY, size * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = RELOCATION_TARGET_COLOR;
            ctx.fill();
            ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
            ctx.stroke();
            ctx.font = `${Math.max(10, size * 0.4)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText("🚩", badgeX, badgeY);
          }
        }
      }

      // After fog so the perimeter stays visible on hidden tiles (spawn debug).
      if (import.meta.env.DEV) {
        drawDevMapEdgeOutline(ctx, gridSize, pan, zoom, size, canvas.width, canvas.height);
      }
    }

    draw();
    if (pan !== null) onViewportChangeRef.current?.({ pan, zoom });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    return () => resizeObserver.disconnect();
  }, [
    seed,
    gridSize,
    tweaks,
    base,
    zoom,
    pan,
    tilesByKey,
    towersByKey,
    wallsByKey,
    barracksByKey,
    powerStationsByKey,
    garrisonsByKey,
    densByKey,
    scrapStashesByKey,
    hordesByKey,
    docksByKey,
    scoutSkiffsByKey,
    wanderingScoutsByKey,
    selectedTowerRangeKeys,
    selectedPowerAoeKeys,
    selectedGarrisonRangeKeys,
    activeTowerKeys,
    hordeCombatByKey,
    expeditionTargetKeys,
    expeditionsByKey,
    denAssaultTargetKeys,
    denAssaultsByKey,
    relocationDestination,
    baseLevel,
    baseCurrentHp,
    baseMaxHp,
    upgradeAvailableKeys,
    buildModeEligibleKeys,
    structureProgressByKey,
    fogByKey,
    labSearchZoneKeys,
    fogDisabled,
    devLabMode,
    lab,
    selected,
    playerColor,
    textureVersion,
  ]);

  function handleWheel(event: React.WheelEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas || pan === null) return;

    const rect = canvas.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;

    const worldX = (cursorX - pan.x) / zoom;
    const worldY = (cursorY - pan.y) / zoom;

    const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));

    setPan({ x: cursorX - worldX * nextZoom, y: cursorY - worldY * nextZoom });
    setZoom(nextZoom);
  }

  function pinchDistance(points: { x: number; y: number }[]): number {
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  function pinchMidpoint(points: { x: number; y: number }[]): { x: number; y: number } {
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    if (pan === null) return;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointersRef.current.size >= 2) {
      multiTouchRef.current = true;
      dragRef.current = null;
      const points = [...pointersRef.current.values()];
      pinchRef.current = {
        initialDistance: pinchDistance(points),
        initialZoom: zoom,
        initialMidpoint: pinchMidpoint(points),
        initialPan: pan,
      };
    } else {
      pinchRef.current = null;
      dragRef.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
    }
  }

  function handleHoverMove(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas || pan === null) return;
    const rect = canvas.getBoundingClientRect();
    const worldX = (event.clientX - rect.left - pan.x) / zoom;
    const worldY = (event.clientY - rect.top - pan.y) / zoom;
    const coord = pixelToAxial({ x: worldX, y: worldY }, BASE_HEX_SIZE);
    const key = axialKey(coord);
    if (key === hoveredKeyRef.current) return;
    hoveredKeyRef.current = key;
    onTileHoverRef.current?.(coord);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    // A genuine hover — mouse, no button held, and not mid-pinch/drag from
    // an earlier pointerdown — never advances past this branch: touch
    // pointermove only ever fires while a finger is down (there's no touch
    // hover), so this is unambiguously desktop mouse movement.
    if (event.pointerType === "mouse" && event.buttons === 0 && !dragRef.current && !pinchRef.current) {
      handleHoverMove(event);
      return;
    }

    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    const pinch = pinchRef.current;
    if (pinch && pointersRef.current.size >= 2) {
      const points = [...pointersRef.current.values()];
      const distance = pinchDistance(points);
      if (distance <= 0 || pinch.initialDistance <= 0) return;

      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinch.initialZoom * (distance / pinch.initialDistance)));
      const worldX = (pinch.initialMidpoint.x - pinch.initialPan.x) / pinch.initialZoom;
      const worldY = (pinch.initialMidpoint.y - pinch.initialPan.y) / pinch.initialZoom;
      const midpoint = pinchMidpoint(points);
      setPan({ x: midpoint.x - worldX * nextZoom, y: midpoint.y - worldY * nextZoom });
      setZoom(nextZoom);
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    // Defer pan until past the tap threshold so Android finger-jitter during
    // a short tap doesn't nudge the map (and so the eventual pointerup still
    // counts as a click rather than a drag).
    if (Math.hypot(dx, dy) <= CLICK_DRAG_THRESHOLD_PX) return;
    setPan({
      x: drag.panX + dx,
      y: drag.panY + dy,
    });
  }

  function endPointerGesture(event: React.PointerEvent<HTMLCanvasElement>, allowTap: boolean) {
    // Leaving the canvas (mouse) or releasing/cancelling (touch) both end
    // whatever hover was in effect.
    if (hoveredKeyRef.current !== null) {
      hoveredKeyRef.current = null;
      onTileHoverRef.current?.(null);
    }
    if (pan === null) return;
    pointersRef.current.delete(event.pointerId);

    if (pointersRef.current.size >= 2) {
      // Still pinching with whichever pointers remain — re-anchor from here
      // so the next move doesn't jump using a now-stale initial reading.
      const points = [...pointersRef.current.values()];
      pinchRef.current = {
        initialDistance: pinchDistance(points),
        initialZoom: zoom,
        initialMidpoint: pinchMidpoint(points),
        initialPan: pan,
      };
      return;
    }

    pinchRef.current = null;

    if (pointersRef.current.size === 1) {
      // Dropped from a pinch back down to one finger — resume as a fresh
      // pan from here instead of jumping back to the pre-pinch drag origin.
      const [remaining] = pointersRef.current.values();
      dragRef.current = { startX: remaining.x, startY: remaining.y, panX: pan.x, panY: pan.y };
      return;
    }

    // Every pointer is up — this is the only point a tap resolves into a
    // tile click, and only if this whole gesture never went multi-touch
    // (a pinch that happens to end back on one finger shouldn't select a tile).
    const drag = dragRef.current;
    dragRef.current = null;
    const wasMultiTouch = multiTouchRef.current;
    multiTouchRef.current = false;
    if (!allowTap || !drag || wasMultiTouch) return;

    const movedDistance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (movedDistance > CLICK_DRAG_THRESHOLD_PX) return;

    const canvas = canvasRef.current;
    if (!canvas || !onTileClick) return;
    const rect = canvas.getBoundingClientRect();
    const screenX = event.clientX - rect.left;
    const screenY = event.clientY - rect.top;
    const worldX = (screenX - pan.x) / zoom;
    const worldY = (screenY - pan.y) / zoom;
    onTileClick(pixelToAxial({ x: worldX, y: worldY }, BASE_HEX_SIZE));
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    // pointerup and pointercancel can both resolve a tap on Android — Chrome
    // sometimes cancels a short touch instead of delivering pointerup, and
    // treating that as a tap (when under the drag threshold) is what makes
    // the tile sheet open. pointerleave only cleans up (no tap).
    endPointerGesture(event, true);
  }

  function handlePointerLeave(event: React.PointerEvent<HTMLCanvasElement>) {
    endPointerGesture(event, false);
  }

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", touchAction: "none" }}>
      <canvas
        ref={canvasRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerUp}
        onContextMenu={(event) => event.preventDefault()}
        style={{ display: "block", cursor: "grab", touchAction: "none" }}
      />
    </div>
  );
});
