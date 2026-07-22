import type { ReactNode } from "react";
import { formatDuration } from "../format";

/**
 * icon + "<label> — <remaining time>" — consolidates the near-identical
 * "upgrading to X (Ym remaining)" / "repairing (Ym remaining)" blocks
 * previously duplicated ~6 times across tower/wall/barracks/base/outpost/path
 * upgrades in TilePopup.tsx.
 */
export function InProgressRow({
  icon,
  label,
  remainingMs,
}: {
  icon?: ReactNode;
  /** e.g. "Upgrading to L4", "Repairing" */
  label: string;
  remainingMs: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.35rem",
        fontSize: "0.85rem",
        color: "rgba(255,255,255,0.85)",
      }}
    >
      {icon}
      <span>
        {label} — {formatDuration(remainingMs)} remaining
      </span>
    </div>
  );
}
