import { describe, expect, it } from "vitest";
import { axialRing, axialSpiral, type Axial } from "./hexCoords";
import {
  computeFogTiers,
  fogTierFor,
  fogTierForDistance,
  HEAVY_FOG_RADIUS,
  LIGHT_FOG_RADIUS,
  OWNED_RADIUS,
} from "./fog";

describe("fogTierForDistance", () => {
  it("matches DESIGN.md §6's stepped shading", () => {
    expect(fogTierForDistance(0)).toBe("owned");
    expect(fogTierForDistance(OWNED_RADIUS)).toBe("owned");
    expect(fogTierForDistance(HEAVY_FOG_RADIUS)).toBe("heavy");
    expect(fogTierForDistance(LIGHT_FOG_RADIUS)).toBe("light");
    expect(fogTierForDistance(LIGHT_FOG_RADIUS + 1)).toBe("hidden");
  });
});

describe("computeFogTiers / fogTierFor", () => {
  const base = { q: 0, r: 0 };
  const farAway = { q: 40, r: 0 };

  it("owned and scouted centers radiate an identical roll-off — same rule, both kinds of center", () => {
    // Sweep a ring of candidate tiles around a single center and confirm
    // an owned-only world and a scouted-only world produce the same tier
    // at every one of them.
    const ownedTiers = computeFogTiers([farAway], []);
    const scoutedTiers = computeFogTiers([], [farAway]);

    for (let radius = 1; radius <= LIGHT_FOG_RADIUS + 1; radius++) {
      for (const coord of axialRing(farAway, radius)) {
        expect(fogTierFor(coord, ownedTiers)).toBe(fogTierFor(coord, scoutedTiers));
      }
    }
  });

  it("shows every tile in the starting territory blob as 'owned'", () => {
    // The real starting shape (base + 2 full rings, 19 tiles) — every tile in
    // it is individually listed in `owned`, not just the base point.
    const startingBlob = axialSpiral(base, OWNED_RADIUS);
    const tiers = computeFogTiers(startingBlob, []);

    for (const coord of startingBlob) {
      expect(fogTierFor(coord, tiers)).toBe("owned");
    }
  });

  it("caps the halo at 'heavy' even right past the blob's edge — no free clear plateau leaking out", () => {
    // Regression guard: previously, a contiguous blob's edge tiles each
    // radiated their own full "owned" plateau, so a tile just past the edge
    // (attackable via adjacency, but never scouted) showed as fully clear —
    // leaking information "attack blind" is supposed to withhold (DESIGN.md
    // §6). It must never show "owned", only a roll-off tier or "hidden".
    const startingBlob = axialSpiral(base, OWNED_RADIUS);
    const tiers = computeFogTiers(startingBlob, []);

    const justPastEdge = axialRing(base, OWNED_RADIUS + 1)[0];
    const tier = fogTierFor(justPastEdge, tiers);
    expect(tier).not.toBe("owned");
    expect(["heavy", "light", "hidden"]).toContain(tier);
  });

  it("gives the starting 19-tile blob exactly one ring of heavy fog and one ring of light fog, not three", () => {
    // Regression guard for a bug where each of the blob's edge tiles
    // separately re-claimed a radius-OWNED_RADIUS "owned" zone (capped to
    // heavy) on top of its own heavy/light ring, stacking heavy fog out to
    // ring OWNED_RADIUS + HEAVY_FOG_RADIUS instead of just OWNED_RADIUS + 1.
    const startingBlob = axialSpiral(base, OWNED_RADIUS);
    const tiers = computeFogTiers(startingBlob, []);

    for (const coord of axialRing(base, OWNED_RADIUS + 1)) {
      expect(fogTierFor(coord, tiers)).toBe("heavy");
    }
    for (const coord of axialRing(base, OWNED_RADIUS + 2)) {
      expect(fogTierFor(coord, tiers)).toBe("light");
    }
    for (const coord of axialRing(base, OWNED_RADIUS + 3)) {
      expect(fogTierFor(coord, tiers)).toBe("hidden");
    }
  });

  it("makes a second, disjoint owned tile visible for itself, with the same capped halo as any other center", () => {
    const farOwned = { q: 20, r: 0 };
    const tiers = computeFogTiers([base, farOwned], []);
    expect(fogTierFor(farOwned, tiers)).toBe("owned");
    // Exactly one ring heavy, the next ring light, per DESIGN.md §6.
    expect(fogTierFor({ q: 20, r: 1 }, tiers)).toBe("heavy");
    expect(fogTierFor({ q: 20, r: 2 }, tiers)).toBe("light");
    expect(fogTierFor({ q: 20, r: 3 }, tiers)).toBe("hidden");
    // Untouched by either center — still hidden.
    expect(fogTierFor({ q: 10, r: 0 }, tiers)).toBe("hidden");
  });

  it("keeps a scouted tile's own cell as 'scouted', never 'owned', even near owned territory", () => {
    const scouted = { q: 1, r: 0 };
    const tiers = computeFogTiers([base], [scouted]);
    expect(fogTierFor(scouted, tiers)).toBe("scouted");
  });

  it("rolls off around a scouted tile without ever fully clearing its neighbors", () => {
    const farScouted = { q: 20, r: 0 };
    const tiers = computeFogTiers([], [farScouted]);
    expect(fogTierFor(farScouted, tiers)).toBe("scouted");
    // Immediate neighbors are capped at "heavy" — no free clear plateau just
    // from scouting (or from ownership — see the symmetry test above).
    // Exactly one ring heavy, the next ring light, then hidden.
    expect(fogTierFor({ q: 20, r: 1 }, tiers)).toBe("heavy");
    expect(fogTierFor({ q: 20, r: 2 }, tiers)).toBe("light");
    expect(fogTierFor({ q: 20, r: 3 }, tiers)).toBe("hidden");
  });

  it("shows 'scouted', never 'owned', for a scouted tile within an owned center's halo", () => {
    const scouted = { q: 2, r: 0 };
    const tiers = computeFogTiers([base], [scouted]);
    // `base`'s halo alone would rank this "light" at best (capped, never
    // "owned") — but the final scouted-cell override always wins regardless,
    // so a scouted-but-unowned tile is visually "scouted", never "owned".
    expect(fogTierFor(scouted, tiers)).toBe("scouted");
  });

  it("lets ground-truth ownership win over a scouted center's halo for the same tile", () => {
    const coord: Axial = { q: 1, r: 0 };
    const tiers = computeFogTiers([base, coord], [coord]);
    expect(fogTierFor(coord, tiers)).toBe("owned");
  });

  it("defaults to hidden for a tile untouched by any center", () => {
    const tiers = computeFogTiers([base], []);
    expect(fogTierFor({ q: 50, r: 50 }, tiers)).toBe("hidden");
  });
});
