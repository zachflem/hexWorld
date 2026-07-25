import { del, get, set } from "../persistence/db";
import { PLAYER_DB_KEY } from "./player";
import { WORLD_DB_KEY } from "./world";
import { TERRITORY_DB_KEY } from "./territory";
import { BASE_DB_KEY } from "./base";
import { RESOURCES_DB_KEY } from "./resources";
import { CLOCK_DB_KEY } from "./clock";
import { EXTRACTION_TILES_DB_KEY } from "./extractionTiles";
import { TOWERS_DB_KEY } from "./towers";
import { WALLS_DB_KEY } from "./walls";
import { BARRACKS_DB_KEY } from "./barracks";
import { POWER_STATIONS_DB_KEY } from "./powerStations";
import { UNITS_DB_KEY } from "./units";
import { GARRISONS_DB_KEY } from "./garrisons";
import { SCOUTED_TILES_DB_KEY } from "./scoutedTiles";
import { STORAGE_LEVELS_DB_KEY } from "./storageLevels";
import { STORAGE_UPGRADES_DB_KEY } from "./storageUpgrades";
import { NOISE_DB_KEY } from "./noise";
import { DENS_DB_KEY } from "./dens";
import { SCRAP_STASHES_DB_KEY } from "./scrapStashes";
import { SCRAP_YARDS_DB_KEY } from "./scrapYards";
import { HORDES_DB_KEY } from "./hordes";
import { EXPEDITIONS_DB_KEY } from "./expeditions";
import { GAME_STATUS_DB_KEY } from "./gameStatus";
import { DOCKS_DB_KEY } from "./docks";
import { SCOUT_SKIFFS_DB_KEY } from "./scoutSkiffs";
import { WANDERING_SCOUTS_DB_KEY } from "./wanderingScouts";
import { DEN_ASSAULTS_DB_KEY } from "./denAssaults";
import { OUTPOSTS_DB_KEY } from "./outposts";
import { GARRISON_RECALLS_DB_KEY } from "./garrisonRecalls";
import { LAB_DB_KEY } from "./lab";
import { LAB_ASSAULTS_DB_KEY } from "./labAssaults";
import { RESEARCH_DB_KEY } from "./research";
import { TOMBSTONES_DB_KEY } from "./tombstones";
import { PROFILE_SLUG_DB_KEY } from "./profile";
import { DEFAULT_PROFILE_SLUG } from "./profileRegistry";

export const SAVE_FILE_FORMAT = "hexworld-save" as const;
/** v2: power stations replace stockpile power (Milestone 25 / #70). v1 imports still accepted + migrated on load. */
export const SAVE_FILE_VERSION = 2 as const;
export const SAVE_FILE_VERSIONS_ACCEPTED = new Set([1, 2]);

const GAME_DB_KEYS = [
  PLAYER_DB_KEY,
  WORLD_DB_KEY,
  TERRITORY_DB_KEY,
  BASE_DB_KEY,
  RESOURCES_DB_KEY,
  CLOCK_DB_KEY,
  EXTRACTION_TILES_DB_KEY,
  TOWERS_DB_KEY,
  WALLS_DB_KEY,
  BARRACKS_DB_KEY,
  POWER_STATIONS_DB_KEY,
  UNITS_DB_KEY,
  GARRISONS_DB_KEY,
  SCOUTED_TILES_DB_KEY,
  STORAGE_LEVELS_DB_KEY,
  STORAGE_UPGRADES_DB_KEY,
  NOISE_DB_KEY,
  DENS_DB_KEY,
  SCRAP_STASHES_DB_KEY,
  SCRAP_YARDS_DB_KEY,
  HORDES_DB_KEY,
  EXPEDITIONS_DB_KEY,
  GAME_STATUS_DB_KEY,
  DOCKS_DB_KEY,
  SCOUT_SKIFFS_DB_KEY,
  WANDERING_SCOUTS_DB_KEY,
  DEN_ASSAULTS_DB_KEY,
  OUTPOSTS_DB_KEY,
  GARRISON_RECALLS_DB_KEY,
  LAB_DB_KEY,
  LAB_ASSAULTS_DB_KEY,
  RESEARCH_DB_KEY,
  TOMBSTONES_DB_KEY,
  PROFILE_SLUG_DB_KEY,
] as const;

export type GameDbKey = (typeof GAME_DB_KEYS)[number];

/** Plain JSON envelope for download / upload. Human-editable; untrusted by design. */
export type SaveFileV1 = {
  format: typeof SAVE_FILE_FORMAT;
  version: typeof SAVE_FILE_VERSION;
  exportedAt: number;
  profileSlug: string;
  /** IndexedDB key → value (same keys as the live session store). */
  keys: Partial<Record<GameDbKey, unknown>>;
};

/**
 * In-memory game shape used to build an export. `barracksList` maps to the
 * IndexedDB `barracks` key — the only field name that differs.
 */
export type PersistableGameSnapshot = {
  player: unknown;
  world: unknown;
  territory: unknown;
  base: unknown;
  resources: unknown;
  clock: unknown;
  extractionTiles: unknown;
  towers: unknown;
  walls: unknown;
  barracksList: unknown;
  powerStations: unknown;
  units: unknown;
  garrisons: unknown;
  scoutedTiles: unknown;
  storageLevels: unknown;
  storageUpgrades: unknown;
  noise: unknown;
  dens: unknown;
  scrapStashes: unknown;
  scrapYards: unknown;
  hordes: unknown;
  expeditions: unknown;
  gameStatus: unknown;
  docks: unknown;
  scoutSkiffs: unknown;
  wanderingScouts: unknown;
  denAssaults: unknown;
  outposts: unknown;
  garrisonRecalls: unknown;
  lab: unknown;
  labAssaults: unknown;
  research: unknown;
  tombstones: unknown;
};

export type ParseSaveResult = { ok: true; save: SaveFileV1 } | { ok: false; reason: string };

/** Loose bag of stored values — enough for App's `buildGameState` + completeness check. */
export type StoredGameKeys = {
  profileSlug: string | undefined;
  player: unknown;
  world: unknown;
  territory: unknown;
  base: unknown;
  resources: unknown;
  clock: unknown;
  extractionTiles: unknown;
  towers: unknown;
  walls: unknown;
  barracksList: unknown;
  powerStations: unknown;
  units: unknown;
  garrisons: unknown;
  scoutedTiles: unknown;
  storageLevels: unknown;
  storageUpgrades: unknown;
  noise: unknown;
  dens: unknown;
  scrapStashes: unknown;
  scrapYards: unknown;
  hordes: unknown;
  expeditions: unknown;
  gameStatus: unknown;
  docks: unknown;
  scoutSkiffs: unknown;
  wanderingScouts: unknown;
  denAssaults: unknown;
  outposts: unknown;
  garrisonRecalls: unknown;
  lab: unknown;
  labAssaults: unknown;
  research: unknown;
  tombstones: unknown;
};

export async function clearGameSave(): Promise<void> {
  await Promise.all(GAME_DB_KEYS.map((key) => del(key)));
}

export function hasCompleteSave(partial: {
  player: unknown;
  world: unknown;
  territory: unknown;
  resources: unknown;
  clock: unknown;
  storageLevels: unknown;
}): boolean {
  const { player, world, territory, resources, clock, storageLevels } = partial;
  return Boolean(player && world && territory && resources && clock && storageLevels);
}

export function snapshotToKeys(game: PersistableGameSnapshot, profileSlug: string): SaveFileV1["keys"] {
  return {
    [PLAYER_DB_KEY]: game.player,
    [WORLD_DB_KEY]: game.world,
    [TERRITORY_DB_KEY]: game.territory,
    [BASE_DB_KEY]: game.base,
    [RESOURCES_DB_KEY]: game.resources,
    [CLOCK_DB_KEY]: game.clock,
    [EXTRACTION_TILES_DB_KEY]: game.extractionTiles,
    [TOWERS_DB_KEY]: game.towers,
    [WALLS_DB_KEY]: game.walls,
    [BARRACKS_DB_KEY]: game.barracksList,
    [POWER_STATIONS_DB_KEY]: game.powerStations,
    [UNITS_DB_KEY]: game.units,
    [GARRISONS_DB_KEY]: game.garrisons,
    [SCOUTED_TILES_DB_KEY]: game.scoutedTiles,
    [STORAGE_LEVELS_DB_KEY]: game.storageLevels,
    [STORAGE_UPGRADES_DB_KEY]: game.storageUpgrades,
    [NOISE_DB_KEY]: game.noise,
    [DENS_DB_KEY]: game.dens,
    [SCRAP_STASHES_DB_KEY]: game.scrapStashes,
    [SCRAP_YARDS_DB_KEY]: game.scrapYards,
    [HORDES_DB_KEY]: game.hordes,
    [EXPEDITIONS_DB_KEY]: game.expeditions,
    [GAME_STATUS_DB_KEY]: game.gameStatus,
    [DOCKS_DB_KEY]: game.docks,
    [SCOUT_SKIFFS_DB_KEY]: game.scoutSkiffs,
    [WANDERING_SCOUTS_DB_KEY]: game.wanderingScouts,
    [DEN_ASSAULTS_DB_KEY]: game.denAssaults,
    [OUTPOSTS_DB_KEY]: game.outposts,
    [GARRISON_RECALLS_DB_KEY]: game.garrisonRecalls,
    [LAB_DB_KEY]: game.lab,
    [LAB_ASSAULTS_DB_KEY]: game.labAssaults,
    [RESEARCH_DB_KEY]: game.research,
    [TOMBSTONES_DB_KEY]: game.tombstones,
    [PROFILE_SLUG_DB_KEY]: profileSlug,
  };
}

export function buildSaveFile(
  game: PersistableGameSnapshot,
  profileSlug: string,
  exportedAt: number = Date.now(),
): SaveFileV1 {
  return {
    format: SAVE_FILE_FORMAT,
    version: SAVE_FILE_VERSION,
    exportedAt,
    profileSlug,
    keys: snapshotToKeys(game, profileSlug),
  };
}

export function keysToStoredGame(keys: SaveFileV1["keys"], profileSlugFallback?: string): StoredGameKeys {
  const slugFromKeys = keys[PROFILE_SLUG_DB_KEY];
  const profileSlug =
    typeof slugFromKeys === "string" && slugFromKeys.trim()
      ? slugFromKeys
      : profileSlugFallback && profileSlugFallback.trim()
        ? profileSlugFallback
        : undefined;

  return {
    profileSlug,
    player: keys[PLAYER_DB_KEY],
    world: keys[WORLD_DB_KEY],
    territory: keys[TERRITORY_DB_KEY],
    base: keys[BASE_DB_KEY],
    resources: keys[RESOURCES_DB_KEY],
    clock: keys[CLOCK_DB_KEY],
    extractionTiles: keys[EXTRACTION_TILES_DB_KEY],
    towers: keys[TOWERS_DB_KEY],
    walls: keys[WALLS_DB_KEY],
    barracksList: keys[BARRACKS_DB_KEY],
    powerStations: keys[POWER_STATIONS_DB_KEY],
    units: keys[UNITS_DB_KEY],
    garrisons: keys[GARRISONS_DB_KEY],
    scoutedTiles: keys[SCOUTED_TILES_DB_KEY],
    storageLevels: keys[STORAGE_LEVELS_DB_KEY],
    storageUpgrades: keys[STORAGE_UPGRADES_DB_KEY],
    noise: keys[NOISE_DB_KEY],
    dens: keys[DENS_DB_KEY],
    scrapStashes: keys[SCRAP_STASHES_DB_KEY],
    scrapYards: keys[SCRAP_YARDS_DB_KEY],
    hordes: keys[HORDES_DB_KEY],
    expeditions: keys[EXPEDITIONS_DB_KEY],
    gameStatus: keys[GAME_STATUS_DB_KEY],
    docks: keys[DOCKS_DB_KEY],
    scoutSkiffs: keys[SCOUT_SKIFFS_DB_KEY],
    wanderingScouts: keys[WANDERING_SCOUTS_DB_KEY],
    denAssaults: keys[DEN_ASSAULTS_DB_KEY],
    outposts: keys[OUTPOSTS_DB_KEY],
    garrisonRecalls: keys[GARRISON_RECALLS_DB_KEY],
    lab: keys[LAB_DB_KEY],
    labAssaults: keys[LAB_ASSAULTS_DB_KEY],
    research: keys[RESEARCH_DB_KEY],
    tombstones: keys[TOMBSTONES_DB_KEY],
  };
}

/**
 * Defensive parse only — no anti-tamper. Hand-edited saves are allowed as long
 * as the envelope and required session keys are present.
 */
export function parseSaveFile(raw: unknown): ParseSaveResult {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, reason: "Save file must be a JSON object." };
  }

  const obj = raw as Record<string, unknown>;

  if (obj.format !== SAVE_FILE_FORMAT) {
    return { ok: false, reason: `Unrecognized save format (expected "${SAVE_FILE_FORMAT}").` };
  }

  if (typeof obj.version !== "number" || !SAVE_FILE_VERSIONS_ACCEPTED.has(obj.version)) {
    return {
      ok: false,
      reason: `Unsupported save version (got ${String(obj.version)}, need ${SAVE_FILE_VERSION}).`,
    };
  }

  if (typeof obj.exportedAt !== "number" || !Number.isFinite(obj.exportedAt)) {
    return { ok: false, reason: "Save file is missing a valid exportedAt timestamp." };
  }

  if (typeof obj.profileSlug !== "string" || !obj.profileSlug.trim()) {
    return { ok: false, reason: "Save file is missing a profileSlug." };
  }

  if (obj.keys == null || typeof obj.keys !== "object" || Array.isArray(obj.keys)) {
    return { ok: false, reason: "Save file is missing a keys object." };
  }

  const keys = obj.keys as Partial<Record<GameDbKey, unknown>>;
  const stored = keysToStoredGame(keys, obj.profileSlug);
  if (
    !hasCompleteSave({
      player: stored.player,
      world: stored.world,
      territory: stored.territory,
      resources: stored.resources,
      clock: stored.clock,
      storageLevels: stored.storageLevels,
    })
  ) {
    return {
      ok: false,
      reason: "Save file is incomplete (needs player, world, territory, resources, clock, storageLevels).",
    };
  }

  return {
    ok: true,
    save: {
      format: SAVE_FILE_FORMAT,
      version: SAVE_FILE_VERSION,
      exportedAt: obj.exportedAt,
      profileSlug: obj.profileSlug.trim(),
      keys,
    },
  };
}

/** Wipe IndexedDB game keys, then write every known key present in the save. */
export async function writeSaveFileToDb(save: SaveFileV1): Promise<void> {
  await clearGameSave();
  const profileSlug = save.profileSlug.trim() || DEFAULT_PROFILE_SLUG;
  const writes: Promise<void>[] = [set(PROFILE_SLUG_DB_KEY, profileSlug)];

  for (const key of GAME_DB_KEYS) {
    if (key === PROFILE_SLUG_DB_KEY) continue;
    if (key in save.keys && save.keys[key] !== undefined) {
      writes.push(set(key, save.keys[key]));
    }
  }

  await Promise.all(writes);
}

export async function readGameKeysFromDb(): Promise<StoredGameKeys> {
  const entries = await Promise.all(GAME_DB_KEYS.map(async (key) => [key, await get(key)] as const));
  const keys: SaveFileV1["keys"] = {};
  for (const [key, value] of entries) {
    if (value !== undefined) keys[key] = value;
  }
  return keysToStoredGame(keys);
}

export function suggestSaveFilename(save: SaveFileV1): string {
  const player = save.keys[PLAYER_DB_KEY] as { name?: unknown } | undefined;
  const world = save.keys[WORLD_DB_KEY] as { seed?: unknown } | undefined;
  const rawName = typeof player?.name === "string" && player.name.trim() ? player.name.trim() : "save";
  const safeName = rawName.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 32);
  const seed = typeof world?.seed === "number" && Number.isFinite(world.seed) ? String(world.seed) : "unknown";
  const stamp = new Date(save.exportedAt).toISOString().slice(0, 10);
  return `hexworld-${safeName}-${seed}-${stamp}.json`;
}

export function downloadSaveFile(save: SaveFileV1, filename?: string): void {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename ?? suggestSaveFilename(save);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Opens a file picker for `.json` saves. Resolves `null` if the user cancels. */
export function pickSaveFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    let settled = false;

    const finish = (file: File | null) => {
      if (settled) return;
      settled = true;
      resolve(file);
    };

    input.addEventListener("change", () => {
      finish(input.files?.[0] ?? null);
    });
    input.addEventListener("cancel", () => {
      finish(null);
    });

    input.click();
  });
}

export async function readJsonFromFile(file: File): Promise<unknown> {
  const text = await file.text();
  return JSON.parse(text) as unknown;
}
