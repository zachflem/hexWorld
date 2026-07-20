export interface WorldRecord {
  seed: number;
}

export const WORLD_DB_KEY = "world";

/** Not cryptographic — just needs to vary between new games. */
export function generateSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff);
}
