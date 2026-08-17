import { HEX_BUTTON_DEFAULT_SIZE } from "./primitives/HexButton";

/**
 * True touching-neighbor pixel offsets for HexButton's shape, derived from
 * its clip-path vertices. All six directions — available if a honeycomb
 * layout is needed again.
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
