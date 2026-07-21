import { forwardRef } from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * Vertically-symmetric hexagon (point at top/bottom) — the shared shape for
 * every clickable hex button (global menu cluster, per-tile action ring). In
 * a `size`×`size` box, its vertices sit at (50%,0%), (100%,25%), (100%,75%),
 * (50%,100%), (0%,75%), (0%,25%) — pointy top/bottom, flat vertical left/right
 * sides. For two of these to tile edge-to-edge with no gap (a real honeycomb,
 * not just visually close), the touching-neighbor translation is exactly:
 * horizontal — (±size, 0); the two diagonals — (±0.5·size, ∓0.75·size) and
 * (±0.5·size, ±0.75·size). `GlobalHexCluster.tsx` uses these directly rather
 * than an arbitrary angle/radius, so its bloom is a true tessellation.
 */
const HEX_CLIP_PATH = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

export const HEX_BUTTON_DEFAULT_SIZE = 48;

export const HexButton = forwardRef<
  HTMLButtonElement,
  {
    icon: ReactNode;
    onClick?: () => void;
    size?: number;
    /** Highlighted state — e.g. the currently-open panel's trigger, or build-mode being active. */
    active?: boolean;
    disabled?: boolean;
    title?: string;
    style?: CSSProperties;
  }
>(function HexButton({ icon, onClick, size = HEX_BUTTON_DEFAULT_SIZE, active = false, disabled = false, title, style }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      style={{
        width: size,
        height: size,
        clipPath: HEX_CLIP_PATH,
        border: "none",
        background: active ? "#2e7d32" : "rgba(20, 20, 22, 0.92)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        pointerEvents: "auto",
        transition: "background 0.15s ease, transform 0.15s ease",
        padding: 0,
        ...style,
      }}
    >
      {icon}
    </button>
  );
});
