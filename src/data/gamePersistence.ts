import { del } from "../persistence/db";
import { PLAYER_DB_KEY } from "./player";
import { WORLD_DB_KEY } from "./world";
import { TERRITORY_DB_KEY } from "./territory";
import { BASE_DB_KEY } from "./base";
import { RESOURCES_DB_KEY } from "./resources";
import { CLOCK_DB_KEY } from "./clock";
import { EXTRACTION_TILES_DB_KEY } from "./extractionTiles";
import { PATH_TILES_DB_KEY } from "./pathTiles";
import { TOWERS_DB_KEY } from "./towers";
import { WALLS_DB_KEY } from "./walls";
import { BARRACKS_DB_KEY } from "./barracks";
import { UNITS_DB_KEY } from "./units";
import { GARRISONS_DB_KEY } from "./garrisons";
import { SCOUTED_TILES_DB_KEY } from "./scoutedTiles";
import { STORAGE_LEVELS_DB_KEY } from "./storageLevels";
import { STORAGE_UPGRADES_DB_KEY } from "./storageUpgrades";
import { NOISE_DB_KEY } from "./noise";
import { DENS_DB_KEY } from "./dens";
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

const GAME_DB_KEYS = [
  PLAYER_DB_KEY,
  WORLD_DB_KEY,
  TERRITORY_DB_KEY,
  BASE_DB_KEY,
  RESOURCES_DB_KEY,
  CLOCK_DB_KEY,
  EXTRACTION_TILES_DB_KEY,
  PATH_TILES_DB_KEY,
  TOWERS_DB_KEY,
  WALLS_DB_KEY,
  BARRACKS_DB_KEY,
  UNITS_DB_KEY,
  GARRISONS_DB_KEY,
  SCOUTED_TILES_DB_KEY,
  STORAGE_LEVELS_DB_KEY,
  STORAGE_UPGRADES_DB_KEY,
  NOISE_DB_KEY,
  DENS_DB_KEY,
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
