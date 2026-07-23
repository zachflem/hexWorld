import { get, set } from "../persistence/db";

export const RECENT_SEEDS_DB_KEY = "recentSeeds";

const MAX_RECENT_SEEDS = 5;

/** Most recently played seeds first, deduplicated, capped at 5. */
export async function getRecentSeeds(): Promise<number[]> {
  const stored = await get<number[]>(RECENT_SEEDS_DB_KEY);
  return stored ?? [];
}

export async function recordRecentSeed(seed: number): Promise<void> {
  const current = await getRecentSeeds();
  const next = [seed, ...current.filter((s) => s !== seed)].slice(0, MAX_RECENT_SEEDS);
  await set(RECENT_SEEDS_DB_KEY, next);
}
