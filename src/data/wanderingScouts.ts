import type { Axial } from "../engine/hexCoords";

/**
 * A mobile land-only unit, built at a Barracks for
 * tweaks.units.wandering_scout.cost (max tweaks.units.wandering_scout.max_per_barracks
 * per barracks) — wanders randomly across connected land
 * (engine/wanderingScouts.ts:advanceWanderingScouts), scouting every tile it
 * visits (src/data/scoutedTiles.ts), the land counterpart of the water-bound
 * scout skiff (src/data/scoutSkiffs.ts).
 */
export interface WanderingScoutRecord {
  id: string;
  coord: Axial;
  homeBarracksCoord: Axial;
  /** The tile it just came from — excluded from the next random step (when another option exists) so it doesn't just oscillate between two tiles forever. */
  prevCoord: Axial | null;
  spawnedAt: number;
  /** Set while under construction; cleared (set null) once tweaks.units.wandering_scout.build_time_minutes elapses — engine/wanderingScouts.ts skips movement/scouting until then. */
  buildStartedAt: number | null;
}

export type WanderingScoutsRecord = WanderingScoutRecord[];

export const WANDERING_SCOUTS_DB_KEY = "wanderingScouts";
