import type { CSSProperties, ReactNode } from "react";

/**
 * Primary (green commit) / secondary (outlined) actions used inside BottomSheet
 * forms — same treatment as Train / Rush / Station in the tile-action sheet.
 */
export function SheetButton({
  children,
  onClick,
  disabled = false,
  variant = "primary",
  compact = false,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary";
  /** Slightly shorter padding for dense sheet forms (train / garrison). */
  compact?: boolean;
  style?: CSSProperties;
}) {
  const primary = variant === "primary";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: "100%",
        borderRadius: 10,
        padding: compact ? "0.65rem 0.85rem" : "0.85rem 1rem",
        fontSize: compact ? "0.9rem" : "0.95rem",
        color: "white",
        WebkitTapHighlightColor: "transparent",
        border: primary ? "none" : "1px solid rgba(255, 255, 255, 0.28)",
        fontWeight: primary ? 650 : 500,
        background: primary ? (disabled ? "rgba(255, 255, 255, 0.12)" : "#2e7d32") : "transparent",
        opacity: disabled ? (primary ? 0.5 : 0.45) : 1,
        cursor: disabled ? "default" : "pointer",
        ...style,
      }}
    >
      {children}
    </button>
  );
}
