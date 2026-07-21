/**
 * Loss/win conditions — DESIGN.md §13: loss is "the base tile's reinforcement
 * HP is depleted by a horde"; win is securing the hidden lab (App.tsx sets
 * `won` once engine/lab.ts:resolveLabAssault succeeds — clearing dens is
 * never required). Once either is true, the tick loop (App.tsx) stops
 * simulating and the UI shows GameOverScreen or WinScreen instead of
 * GameScreen. The two are mutually exclusive in practice (the tick loop
 * freezes the moment either fires), but both fields exist independently
 * rather than a single tri-state enum so a pre-M15 save missing `won`/`wonAt`
 * still spreads over the initialGameStatus() defaults cleanly.
 */
export interface GameStatusRecord {
  lost: boolean;
  lostAt: number | null;
  won: boolean;
  wonAt: number | null;
}

export const GAME_STATUS_DB_KEY = "gameStatus";

export function initialGameStatus(): GameStatusRecord {
  return { lost: false, lostAt: null, won: false, wonAt: null };
}
