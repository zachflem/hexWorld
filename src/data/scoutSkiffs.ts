import type { Axial } from "../engine/hexCoords";

/**
 * A mobile water-only unit, built at a Dock (max tweaks.docks.scout_skiff.max_per_dock
 * per dock) — wanders randomly across its connected body of water
 * (engine/scoutSkiffs.ts:advanceScoutSkiffs), scouting every tile it visits
 * (src/data/scoutedTiles.ts), the same reveal mechanism land scouting uses.
 */
export interface ScoutSkiffRecord {
  id: string;
  coord: Axial;
  homeDockCoord: Axial;
  /** The tile it just came from — excluded from the next random step (when another option exists) so it doesn't just oscillate between two tiles forever. */
  prevCoord: Axial | null;
  spawnedAt: number;
  /** Set while under construction; cleared (set null) once tweaks.docks.scout_skiff.build_time_minutes elapses — engine/scoutSkiffs.ts skips movement/scouting until then. */
  buildStartedAt: number | null;
}

export type ScoutSkiffsRecord = ScoutSkiffRecord[];

export const SCOUT_SKIFFS_DB_KEY = "scoutSkiffs";
