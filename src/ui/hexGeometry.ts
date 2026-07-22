import { HEX_BUTTON_DEFAULT_SIZE } from "./primitives/HexButton";

/**
 * True touching-neighbor pixel offsets for HexButton's shape, derived from
 * its own clip-path vertices (see HexButton.tsx's doc comment for the
 * geometry derivation). All six directions — consumers pick whichever
 * subset they need: `GlobalHexCluster` only uses up/upper-left/left so its
 * bloom grows away from its bottom-right corner anchor; `TileActionRing`
 * uses the full set since a map tile has room on every side.
 */
export function hexNeighborOffsets(size: number = HEX_BUTTON_DEFAULT_SIZE): {
  right: [number, number];
  upperRight: [number, number];
  upperLeft: [number, number];
  left: [number, number];
  lowerLeft: [number, number];
  lowerRight: [number, number];
} {
  return {
    right: [size, 0],
    upperRight: [0.5 * size, -0.75 * size],
    upperLeft: [-0.5 * size, -0.75 * size],
    left: [-size, 0],
    lowerLeft: [-0.5 * size, 0.75 * size],
    lowerRight: [0.5 * size, 0.75 * size],
  };
}
