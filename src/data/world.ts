export interface WorldRecord {
  seed: number;
  /** Chosen at onboarding (UX #10) unless profile locked; omitted on legacy saves → 128. */
  gridSize?: number;
}

export const WORLD_DB_KEY = "world";

/** Not cryptographic — just needs to vary between new games. */
export function generateSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}

export function normalizeWorldRecord(world: WorldRecord): WorldRecord {
  return { ...world, gridSize: world.gridSize ?? 128 };
}
