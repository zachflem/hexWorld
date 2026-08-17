import { describe, expect, it } from "vitest";
import {
  STRUCTURE_GROUND_FRACTION,
  STRUCTURE_PLACEMENT,
  STRUCTURE_VARIANT_PLACEMENT,
  structurePlacementFor,
} from "./structurePlacement";

describe("structurePlacementFor", () => {
  it("uses kind defaults when no variant is passed", () => {
    expect(structurePlacementFor("tower")).toEqual({
      scale: STRUCTURE_PLACEMENT.tower.scale,
      groundFraction: STRUCTURE_GROUND_FRACTION + STRUCTURE_PLACEMENT.tower.offset,
    });
  });

  it("uses variant stem when seeded", () => {
    expect(STRUCTURE_VARIANT_PLACEMENT["tower-2"]).toEqual(STRUCTURE_PLACEMENT.tower);
    expect(structurePlacementFor("tower", "tower-2")).toEqual({
      scale: STRUCTURE_PLACEMENT.tower.scale,
      groundFraction: STRUCTURE_GROUND_FRACTION + STRUCTURE_PLACEMENT.tower.offset,
    });
  });

  it("falls back to kind default for unknown stems", () => {
    expect(structurePlacementFor("barracks", "barracks-99")).toEqual({
      scale: STRUCTURE_PLACEMENT.barracks.scale,
      groundFraction: STRUCTURE_GROUND_FRACTION + STRUCTURE_PLACEMENT.barracks.offset,
    });
  });

  it("resolves extraction resource-tier stems", () => {
    expect(STRUCTURE_VARIANT_PLACEMENT["food-small"]).toEqual(STRUCTURE_PLACEMENT.extraction);
    expect(structurePlacementFor("extraction", "wood-mid").scale).toBe(
      STRUCTURE_VARIANT_PLACEMENT["wood-mid"].scale,
    );
  });
});
