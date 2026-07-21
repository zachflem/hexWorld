import { forwardRef } from "react";
import type { CSSProperties, ReactNode } from "react";

/** Vertically-symmetric hexagon (point at top/bottom) — the shared shape for every clickable hex button (global menu cluster, per-tile action ring). */
const HEX_CLIP_PATH = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

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
>(function HexButton({ icon, onClick, size = 48, active = false, disabled = false, title, style }, ref) {
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
