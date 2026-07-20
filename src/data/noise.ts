import type { Tweaks } from "./tweaksSchema";

export interface NoiseRecord {
  value: number;
}

export const NOISE_DB_KEY = "noise";

/** Seeds at the ambient floor (tweaks.noise.noise_floor_minimum), not 0 — a fresh base is "practically silent," not literally silent. */
export function initialNoise(tweaks: Tweaks): NoiseRecord {
  return { value: tweaks.noise.noise_floor_minimum };
}
