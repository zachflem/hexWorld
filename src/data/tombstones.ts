import type { Axial } from "../engine/hexCoords";
import type { TombstoneCause } from "../engine/expeditions";

/**
 * A marker left where a party died mid-route — an expedition or den/lab
 * assault out-fought on a corridor tile (engine/expeditions.ts:
 * stepCorridorWalk), a horde blocking the road, or a den/lab's own final-tile
 * defense beating the survivors of a successfully-walked corridor. Purely
 * informational (click-to-inspect via TilePopup) — it doesn't affect
 * gameplay and never blocks anything built or claimed on its tile.  Expires
 * `expiresAt` (game.clock.virtualNow, same clock every other timer in this
 * game uses — scales with fast-forward), filtered out in the tick loop the
 * same way every other timed record is (App.tsx).
 */
export interface TombstoneRecord {
  id: string;
  coord: Axial;
  partyKind: "expedition" | "denAssault" | "labAssault";
  /** Where the party was ultimately headed — the expedition's target tile, or the den/lab's own coord. */
  target: Axial;
  militiaLost: number;
  junkyardKnightLost: number;
  crossBowSniperLost: number;
  attackPower: number;
  cause: TombstoneCause;
  createdAt: number;
  expiresAt: number;
}

export type TombstonesRecord = TombstoneRecord[];

export const TOMBSTONES_DB_KEY = "tombstones";
