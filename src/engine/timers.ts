/** True once `durationMs` has elapsed since `startedAt`, relative to `now`. */
export function isTimerComplete(startedAt: number, durationMs: number, now: number): boolean {
  return now - startedAt >= durationMs;
}

/** Time remaining until `startedAt + durationMs`, clamped to 0 rather than going negative. */
export function remainingMs(startedAt: number, durationMs: number, now: number): number {
  return Math.max(0, durationMs - (now - startedAt));
}

/**
 * Fraction of a timer elapsed (0 = just started, 1 = complete), derived from
 * remaining time so callers that already computed `remainingMs` don't need
 * `startedAt` again. Clamped to [0, 1].
 */
export function progressFromRemaining(remainingMsValue: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  return Math.max(0, Math.min(1, 1 - remainingMsValue / durationMs));
}
