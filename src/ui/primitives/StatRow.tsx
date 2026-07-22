import type { ReactNode } from "react";

/**
 * icon + label + progress bar + current/max text — covers every capped-value
 * display in the game (stockpile, reinforcement HP, siege countdowns,
 * upgrade/repair countdowns), which previously rendered as bare "x/y" text.
 */
export function StatRow({
  icon,
  label,
  current,
  max,
  displayValue,
  barColor = "#5a9e4f",
  trailingContent,
}: {
  icon?: ReactNode;
  label: string;
  current: number;
  max: number;
  /** Overrides the default "current/max" text — e.g. to add a unit suffix or a countdown string instead of a fraction. */
  displayValue?: string;
  barColor?: string;
  /** Extra content rendered below the bar row, e.g. an upgrade/collect button. */
  trailingContent?: ReactNode;
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (current / max) * 100)) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem" }}>
          {icon}
          {label}
        </span>
        <span style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.75)" }}>
          {displayValue ?? `${Math.floor(current)}/${Math.floor(max)}`}
        </span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.12)", borderRadius: 999, height: 6, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: barColor, transition: "width 0.2s ease" }} />
      </div>
      {trailingContent}
    </div>
  );
}
