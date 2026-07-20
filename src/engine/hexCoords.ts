// Axial coordinates (q, r) are the canonical storage format (see DESIGN.md §3).
// Cube coordinates are derived on demand for algorithms (distance, rings) that
// are simpler to express with three redundant axes (x + y + z = 0).

export interface Axial {
  q: number;
  r: number;
}

interface Cube {
  x: number;
  y: number;
  z: number;
}

function axialToCube({ q, r }: Axial): Cube {
  const x = q;
  const z = r;
  const y = -x - z;
  return { x, y, z };
}

function cubeToAxial({ x, z }: Cube): Axial {
  return { q: x, r: z };
}

export function axialDistance(a: Axial, b: Axial): number {
  const ac = axialToCube(a);
  const bc = axialToCube(b);
  return Math.max(Math.abs(ac.x - bc.x), Math.abs(ac.y - bc.y), Math.abs(ac.z - bc.z));
}

export function axialKey(a: Axial): string {
  return `${a.q},${a.r}`;
}

export function axialEquals(a: Axial, b: Axial): boolean {
  return a.q === b.q && a.r === b.r;
}

// Pointy-top neighbor directions, in clockwise order starting east.
const AXIAL_DIRECTIONS: Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function axialNeighbors(a: Axial): Axial[] {
  return AXIAL_DIRECTIONS.map((d) => ({ q: a.q + d.q, r: a.r + d.r }));
}

/** The hexes forming the ring at exactly `radius` from center (radius 0 = just center). */
export function axialRing(center: Axial, radius: number): Axial[] {
  if (radius === 0) return [center];
  const results: Axial[] = [];
  let hex: Axial = {
    q: center.q + AXIAL_DIRECTIONS[4].q * radius,
    r: center.r + AXIAL_DIRECTIONS[4].r * radius,
  };
  for (let side = 0; side < 6; side++) {
    for (let step = 0; step < radius; step++) {
      results.push(hex);
      hex = { q: hex.q + AXIAL_DIRECTIONS[side].q, r: hex.r + AXIAL_DIRECTIONS[side].r };
    }
  }
  return results;
}

/** All hexes within `radius` of center, inclusive (a filled hexagonal region). */
export function axialSpiral(center: Axial, radius: number): Axial[] {
  const results: Axial[] = [center];
  for (let k = 1; k <= radius; k++) {
    results.push(...axialRing(center, k));
  }
  return results;
}

const SQRT3 = Math.sqrt(3);

/** Pointy-top axial -> pixel (hex center), for a hex of the given "size" (center to corner). */
export function axialToPixel(a: Axial, size: number): { x: number; y: number } {
  return {
    x: size * (SQRT3 * a.q + (SQRT3 / 2) * a.r),
    y: size * (1.5 * a.r),
  };
}

/** Inverse of axialToPixel — nearest axial hex to a given pixel point. */
export function pixelToAxial(point: { x: number; y: number }, size: number): Axial {
  const q = ((SQRT3 / 3) * point.x - (1 / 3) * point.y) / size;
  const r = ((2 / 3) * point.y) / size;
  return axialRound({ q, r });
}

function axialRound(a: Axial): Axial {
  const cube = axialToCube(a);
  let rx = Math.round(cube.x);
  let ry = Math.round(cube.y);
  let rz = Math.round(cube.z);

  const xDiff = Math.abs(rx - cube.x);
  const yDiff = Math.abs(ry - cube.y);
  const zDiff = Math.abs(rz - cube.z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return cubeToAxial({ x: rx, y: ry, z: rz });
}

/** The 6 pixel-space corners of a pointy-top hex centered at `center`. */
export function hexCorners(center: { x: number; y: number }, size: number): { x: number; y: number }[] {
  const corners: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 90);
    corners.push({
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    });
  }
  return corners;
}

/**
 * Maps the rectangular `gridSize` x `gridSize` world (tweaks.game.grid_size) onto
 * axial coordinates using an odd-r row offset, so the map reads as a visual
 * rectangle instead of a slanted parallelogram.
 */
export function mapCenter(gridSize: number): Axial {
  const row = Math.floor(gridSize / 2);
  const col = Math.floor(gridSize / 2);
  return { q: col - Math.floor(row / 2), r: row };
}

export function isWithinMapBounds(coord: Axial, gridSize: number): boolean {
  if (coord.r < 0 || coord.r >= gridSize) return false;
  const col = coord.q + Math.floor(coord.r / 2);
  return col >= 0 && col < gridSize;
}
