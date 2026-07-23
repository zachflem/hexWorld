import { forwardRef } from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * Vertically-symmetric hexagon (point at top/bottom) — the shared shape for
 * clickable hex buttons (global menu stack, etc.). In a `size`×`size` box,
 * vertices sit at (50%,0%), (100%,25%), (100%,75%), (50%,100%), (0%,75%),
 * (0%,25%) — pointy top/bottom, flat vertical left/right sides.
 */
const HEX_CLIP_PATH = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

export const HEX_BUTTON_DEFAULT_SIZE = 48;

export const HexButton = forwardRef<
  HTMLButtonElement,
  {
    icon: ReactNode;
    onClick?: () => void;
    size?: number;
    /** Highlighted state — e.g. the currently-open panel's trigger, or build-mode being active. Ignored when `highlight` is set. */
    active?: boolean;
    /** Explicit background color override — takes precedence over `active`. Used for the "an upgrade is available/affordable somewhere under this hex" indicator, which is a specific orange (UPGRADE_AVAILABLE_BADGE_COLOR), not the generic green `active` state. */
    highlight?: string;
    disabled?: boolean;
    title?: string;
    style?: CSSProperties;
  }
>(function HexButton(
  { icon, onClick, size = HEX_BUTTON_DEFAULT_SIZE, active = false, highlight, disabled = false, title, style },
  ref,
) {
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
        background: highlight ?? (active ? "#2e7d32" : "rgba(20, 20, 22, 0.92)"),
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        pointerEvents: "auto",
        transition: "background 0.15s ease, transform 0.15s ease",
        padding: 0,
        // clip-path clips borders/box-shadow; drop-shadow follows the hex silhouette.
        filter: "drop-shadow(0 0 0.6px rgba(255, 255, 255, 0.22))",
        ...style,
      }}
    >
      {icon}
    </button>
  );
});
