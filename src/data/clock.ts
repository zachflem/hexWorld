export interface ClockRecord {
  /** ms since epoch — resources/timers are accounted for up to this real-world time. */
  lastTickAt: number;
  /**
   * A separate clock every build/upgrade/training timer is anchored to
   * instead of Date.now() — advances each tick by elapsedSeconds*1000 (see
   * App.tsx's runTick), i.e. at the same speedMultiplier-scaled rate as
   * resources/noise/hordes, so fast-forward speeds up timers too. Starts
   * equal to lastTickAt. Missing on saves from before this field existed —
   * callers default it to lastTickAt in that case (App.tsx).
   */
  virtualNow: number;
}

export const CLOCK_DB_KEY = "clock";
