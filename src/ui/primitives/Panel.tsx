import type { CSSProperties, ReactNode } from "react";

/**
 * The dark semi-transparent rounded container used by every floating panel
 * in the game (tile popup, notification tray, overview panels, etc.) —
 * previously copy-pasted inline per component (e.g. TilePopup.tsx), now a
 * single shared surface treatment.
 */
export function Panel({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        background: "rgba(20, 20, 22, 0.92)",
        color: "white",
        borderRadius: 8,
        padding: "0.75rem 1rem",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
