/**
 * Loss condition — DESIGN.md §13: "the base tile's reinforcement HP is
 * depleted by a horde." Once `lost` is true, the tick loop (App.tsx) stops
 * simulating and the UI shows GameOverScreen instead of GameScreen.
 */
export interface GameStatusRecord {
  lost: boolean;
  lostAt: number | null;
}

export const GAME_STATUS_DB_KEY = "gameStatus";

export function initialGameStatus(): GameStatusRecord {
  return { lost: false, lostAt: null };
}
