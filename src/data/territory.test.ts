import { describe, expect, it } from "vitest";
import { axialDistance, isWithinMapBounds } from "../engine/hexCoords";
import { terrainAt } from "../engine/terrain";
import { createStartingTerritory } from "./territory";

describe("createStartingTerritory", () => {
  it("owns exactly 19 tiles (base + first two full rings), per DESIGN.md §6", () => {
    const territory = createStartingTerritory(1, 128);
    expect(territory.owned).toHaveLength(19);
  });

  it("every owned tile is within 2 rings of the base and inside map bounds", () => {
    const gridSize = 128;
    const territory = createStartingTerritory(1, gridSize);
    for (const coord of territory.owned) {
      expect(axialDistance(coord, territory.base)).toBeLessThanOrEqual(2);
      expect(isWithinMapBounds(coord, gridSize)).toBe(true);
    }
  });

  it("never places the base on water, across many seeds", () => {
    const gridSize = 128;
    for (let seed = 0; seed < 50; seed++) {
      const territory = createStartingTerritory(seed, gridSize);
      expect(terrainAt(seed, territory.base)).not.toBe("water");
    }
  });
});
