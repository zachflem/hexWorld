// Deterministic, seeded 2D noise for procedural terrain generation. Pure
// functions of (seed, x, y) — no internal state, so any tile can be computed
// on demand without materializing the whole 128x128 grid (needed for
// viewport culling — see render/HexCanvas.tsx).
//
// Hash is a "Squirrel3"-style integer noise (Squirrel Eiserloh, GDC 2017):
// cheap, well-distributed, no external dependency.

const BIT_NOISE1 = 0xb5297a4d;
const BIT_NOISE2 = 0x68e31da4;
const BIT_NOISE3 = 0x1b56c4e9;

function squirrel3(n: number, seed: number): number {
  let mangled = n | 0;
  mangled = Math.imul(mangled, BIT_NOISE1);
  mangled ^= mangled >>> 8;
  mangled = (mangled + seed) | 0;
  mangled = Math.imul(mangled, BIT_NOISE2);
  mangled ^= mangled >>> 8;
  mangled = Math.imul(mangled, BIT_NOISE3);
  mangled ^= mangled >>> 8;
  return (mangled >>> 0) / 4294967296;
}

function hash2D(seed: number, x: number, y: number): number {
  const n = (Math.imul(x, 198491317) ^ Math.imul(y, 6542989)) | 0;
  return squirrel3(n, seed);
}

/**
 * Deterministic pseudo-random value in [0, 1) for a given (seed, index) pair
 * — same seed and index always yield the same result. Used for world-gen
 * decisions (e.g. den placement/leveling) that need reproducible randomness
 * without a second RNG or `Math.random()`.
 */
export function seededRandom(seed: number, index: number): number {
  return squirrel3(index, seed);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function valueNoise2D(seed: number, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = smoothstep(x - x0);
  const sy = smoothstep(y - y0);

  const n00 = hash2D(seed, x0, y0);
  const n10 = hash2D(seed, x0 + 1, y0);
  const n01 = hash2D(seed, x0, y0 + 1);
  const n11 = hash2D(seed, x0 + 1, y0 + 1);

  const ix0 = lerp(n00, n10, sx);
  const ix1 = lerp(n01, n11, sx);
  return lerp(ix0, ix1, sy);
}

/** Fractal Brownian motion: layered value noise, result roughly in [0, 1]. */
export function fbm2D(seed: number, x: number, y: number, octaves = 4): number {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let max = 0;
  for (let i = 0; i < octaves; i++) {
    value += valueNoise2D(seed + i * 1013, x * frequency, y * frequency) * amplitude;
    max += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return value / max;
}
