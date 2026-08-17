import { axialNeighbors, type Axial } from "./hexCoords";
import { fbm2D } from "./noise";

export type TerrainType = "water" | "shore" | "grassland" | "forest" | "mountain";

// World-gen tuning — not exposed via tweaks.jsonc (that file is scoped to
// economy/combat balance per DESIGN.md). Thresholds are elevation cut-points
// against fbm2D (roughly bell-shaped around ~0.5, NOT uniform [0,1]), so band
// widths here are not the same as tile share. Retuned 2026-07-25 for a more
// diverse playtest mix (~25% grassland / forest / mountain, ~20% water,
// ~10% shore). Candidate for admin-GUI sliders — see GitHub #29.
const FREQUENCY = 0.06;

const THRESHOLDS: { max: number; terrain: TerrainType }[] = [
  { max: 0.402, terrain: "water" },
  { max: 0.446, terrain: "shore" },
  { max: 0.532, terrain: "grassland" },
  { max: 0.624, terrain: "forest" },
  { max: Infinity, terrain: "mountain" },
];

/** Deterministic terrain type for a tile — same (seed, coord) always yields the same result. */
export function terrainAt(seed: number, coord: Axial): TerrainType {
  const elevation = fbm2D(seed, coord.q * FREQUENCY, coord.r * FREQUENCY);
  for (const { max, terrain } of THRESHOLDS) {
    if (elevation <= max) return terrain;
  }
  return "mountain";
}

/** True if a structure requiring dry land can be placed here (anything but open water). */
export function isBuildableLand(seed: number, coord: Axial): boolean {
  return terrainAt(seed, coord) !== "water";
}

/**
 * A tile where two terrain types border each other — DESIGN.md §3. Either
 * terrain's structures can be built here, at half yield (applied in
 * engine/tick.ts). The game never explains this outright; see
 * tweaks.jsonc's transition_tiles.scout_flavor_text for the only in-game hint.
 */
export function isTransitionTile(seed: number, coord: Axial): boolean {
  const own = terrainAt(seed, coord);
  return axialNeighbors(coord).some((neighbor) => terrainAt(seed, neighbor) !== own);
}
