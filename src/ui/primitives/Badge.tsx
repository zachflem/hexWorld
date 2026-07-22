import type { CSSProperties, ReactNode } from "react";

export type BadgeTone = "terrain" | "flow" | "noise" | "neutral" | "danger" | "success";

const TONE_COLORS: Record<BadgeTone, { bg: string; fg: string }> = {
  terrain: { bg: "rgba(90, 158, 79, 0.25)", fg: "#8fd67f" },
  flow: { bg: "rgba(63, 140, 214, 0.25)", fg: "#7cb8f0" },
  noise: { bg: "rgba(224, 142, 11, 0.25)", fg: "#f2b64d" },
  neutral: { bg: "rgba(255, 255, 255, 0.12)", fg: "#e0e0e0" },
  danger: { bg: "rgba(198, 40, 40, 0.25)", fg: "#ef5350" },
  success: { bg: "rgba(46, 125, 50, 0.25)", fg: "#81c784" },
};

/** A small colored pill for tile/structure status — replaces the comma-separated inline text TilePopup.tsx used previously (terrain type, flow state, noise contribution, etc.). */
export function Badge({
  label,
  tone = "neutral",
  style,
}: {
  label: ReactNode;
  tone?: BadgeTone;
  style?: CSSProperties;
}) {
  const colors = TONE_COLORS[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: colors.bg,
        color: colors.fg,
        borderRadius: 999,
        padding: "0.15rem 0.6rem",
        fontSize: "0.75rem",
        fontWeight: 600,
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {label}
    </span>
  );
}
