import type { CSSProperties } from "react";
import type { Axial } from "../../engine/hexCoords";

export const coordLinkStyle: CSSProperties = {
  padding: 0,
  margin: 0,
  border: "none",
  background: "transparent",
  color: "inherit",
  textDecoration: "underline",
  textUnderlineOffset: "2px",
  cursor: "pointer",
  font: "inherit",
  WebkitTapHighlightColor: "transparent",
};

export function CoordLink({ coord, onGoToTile }: { coord: Axial; onGoToTile: (coord: Axial) => void }) {
  return (
    <button type="button" onClick={() => onGoToTile(coord)} style={coordLinkStyle}>
      ({coord.q}, {coord.r})
    </button>
  );
}
