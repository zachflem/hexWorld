import { describe, expect, it } from "vitest";
import { structureProgressByKey } from "./structureProgress";

describe("structureProgressByKey", () => {
  it("maps a single job to elapsed progress, kind, and fill color on its coord", () => {
    const map = structureProgressByKey([
      { coord: { q: 1, r: 2 }, remainingMs: 2500, durationMs: 10_000, kind: "build" },
    ]);
    expect(map.get("1,2")?.progress).toBeCloseTo(0.75);
    expect(map.get("1,2")?.kind).toBe("build");
    expect(map.get("1,2")?.color).toBe("#f4d03f");
  });

  it("skips rows without a coord (e.g. research) and completed timers", () => {
    const map = structureProgressByKey([
      { remainingMs: 1000, durationMs: 5000, kind: "upgrade" },
      { coord: { q: 0, r: 0 }, remainingMs: 0, durationMs: 5000, kind: "repair" },
    ]);
    expect(map.size).toBe(0);
  });

  it("keeps the slowest remaining job (and its kind) when several share a tile", () => {
    const map = structureProgressByKey([
      { coord: { q: 3, r: 4 }, remainingMs: 1000, durationMs: 10_000, kind: "repair" },
      { coord: { q: 3, r: 4 }, remainingMs: 8000, durationMs: 10_000, kind: "upgrade" },
    ]);
    expect(map.get("3,4")?.progress).toBeCloseTo(0.2);
    expect(map.get("3,4")?.kind).toBe("upgrade");
  });
});
