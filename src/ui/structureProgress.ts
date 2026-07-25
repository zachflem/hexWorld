import { axialKey, type Axial } from "../engine/hexCoords";
import { progressFromRemaining } from "../engine/timers";

/** Timed job categories that drive map progress-ring color (#74). */
export type StructureProgressKind = "build" | "upgrade" | "repair" | "train" | "relocate";

/** Minimal countdown shape needed to place a map progress ring. */
export type StructureProgressRow = {
  coord?: Axial;
  remainingMs: number;
  durationMs: number;
  kind: StructureProgressKind;
};

export type StructureProgressEntry = {
  progress: number;
  kind: StructureProgressKind;
  /** Resolved fill color for HexCanvas — keeps render free of ui imports. */
  color: string;
};

/** Fill colors for structure progress rings — match existing map accent language. */
export const STRUCTURE_PROGRESS_FILL: Record<StructureProgressKind, string> = {
  build: "#f4d03f", // construction / under-build amber
  upgrade: "#e08e0b", // same orange as upgrade-available badges
  repair: "#2ecc71", // health / repair green
  train: "#9b59b6", // barracks / training purple
  relocate: "#2e86de", // relocation target blue
};

/**
 * Per-tile progress for HexCanvas rings.
 * When several jobs share a coord, the slowest remaining job wins so the
 * ring doesn't vanish while something else is still running (and its kind
 * colors the ring).
 */
export function structureProgressByKey(rows: StructureProgressRow[]): Map<string, StructureProgressEntry> {
  const best = new Map<string, { remainingMs: number; entry: StructureProgressEntry }>();
  for (const row of rows) {
    if (!row.coord || row.durationMs <= 0) continue;
    const key = axialKey(row.coord);
    const progress = progressFromRemaining(row.remainingMs, row.durationMs);
    if (progress >= 1) continue;
    const prev = best.get(key);
    if (!prev || row.remainingMs > prev.remainingMs) {
      best.set(key, {
        remainingMs: row.remainingMs,
        entry: { progress, kind: row.kind, color: STRUCTURE_PROGRESS_FILL[row.kind] },
      });
    }
  }
  const out = new Map<string, StructureProgressEntry>();
  for (const [key, value] of best) {
    out.set(key, value.entry);
  }
  return out;
}
