/** True once `durationMs` has elapsed since `startedAt`, relative to `now`. */
export function isTimerComplete(startedAt: number, durationMs: number, now: number): boolean {
  return now - startedAt >= durationMs;
}

/** Time remaining until `startedAt + durationMs`, clamped to 0 rather than going negative. */
export function remainingMs(startedAt: number, durationMs: number, now: number): number {
  return Math.max(0, durationMs - (now - startedAt));
}
