import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import type { Axial } from "../../engine/hexCoords";
import { axialKey } from "../../engine/hexCoords";
import type { ResourceType } from "../../data/resources";
import { BASE_HEX_SIZE } from "../../render/HexCanvas";
import { COLLECT_PIN_COLORS, collectPinColorState } from "../../render/stockpileState";

export interface CollectableTile {
  coord: Axial;
  resource: ResourceType;
  stockpile: number;
  stockpileCap: number;
  upgradeAvailable: boolean;
}

export interface CollectPinOverlayHandle {
  /** Imperative reposition — see HoverTooltip.tsx for why this isn't React state. */
  reposition: (getScreenPosition: (coord: Axial) => { x: number; y: number } | null, hexCircumradius: number) => void;
}

/** Pin size at zoom 1 (hexCircumradius === BASE_HEX_SIZE); scales with map zoom. */
const PIN_WIDTH = 20;
const PIN_HEIGHT = 26;
const ICON_SIZE = 12;

/**
 * Tip anchor as a fraction of hex circumradius above tile center.
 * 1 = top vertex; lower values pull the tip down into the tile so the
 * bubble overlaps the top edge instead of floating fully outside.
 */
const PIN_TIP_ABOVE_CENTER = 0.5;

function CollectPin({
  tile,
  onCollect,
}: {
  tile: CollectableTile;
  onCollect: (coord: Axial) => void;
}) {
  const colorState = collectPinColorState(tile.stockpile, tile.stockpileCap, tile.upgradeAvailable);
  const { fill, stroke } = COLLECT_PIN_COLORS[colorState];

  return (
    <button
      type="button"
      data-collect-coord={axialKey(tile.coord)}
      title={`Collect ${Math.floor(tile.stockpile)} ${tile.resource}`}
      aria-label={`Collect ${Math.floor(tile.stockpile)} ${tile.resource}`}
      onClick={(event) => {
        event.stopPropagation();
        onCollect(tile.coord);
      }}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        display: "none",
        width: PIN_WIDTH,
        height: PIN_HEIGHT,
        padding: 0,
        border: "none",
        background: "transparent",
        cursor: "pointer",
        pointerEvents: "auto",
        transformOrigin: "0 0",
        transition: "filter 0.15s ease",
        filter: "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45))",
      }}
      onPointerEnter={(event) => {
        event.currentTarget.style.filter = "drop-shadow(0 2px 6px rgba(0, 0, 0, 0.55)) brightness(1.12)";
      }}
      onPointerLeave={(event) => {
        event.currentTarget.style.filter = "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45))";
      }}
    >
      <svg
        viewBox="0 0 32 40"
        width={PIN_WIDTH}
        height={PIN_HEIGHT}
        aria-hidden
        style={{ display: "block", pointerEvents: "none" }}
      >
        <path
          d="M16 1 C9.4 1 5 6.2 5 11.5 C5 17.2 16 38 16 38 C16 38 27 17.2 27 11.5 C27 6.2 22.6 1 16 1 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth="1.2"
        />
        <circle cx="16" cy="12" r="9" fill="rgba(255, 255, 255, 0.06)" />
      </svg>
      <img
        src={`/tiles/markers/icon-${tile.resource}.png`}
        width={ICON_SIZE}
        height={ICON_SIZE}
        alt=""
        style={{
          position: "absolute",
          left: "50%",
          top: 2,
          transform: "translateX(-50%)",
          objectFit: "contain",
          pointerEvents: "none",
        }}
      />
    </button>
  );
}

/**
 * Floating map-pin buttons above extraction tiles that have stockpiled
 * resources — one-click collect without opening the tile action sheet.
 * Positioned imperatively (same convention as HoverTooltip) so pan/zoom
 * does not re-render all of GameScreen.
 */
export const CollectPinOverlay = forwardRef<
  CollectPinOverlayHandle,
  { tiles: CollectableTile[]; onCollect: (coord: Axial) => void }
>(function CollectPinOverlay({ tiles, onCollect }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastViewport = useRef<{
    getScreenPosition: (coord: Axial) => { x: number; y: number } | null;
    hexCircumradius: number;
  } | null>(null);

  function applyPositions() {
    const container = containerRef.current;
    if (!container || !lastViewport.current) return;
    const { getScreenPosition, hexCircumradius } = lastViewport.current;
    const scale = hexCircumradius / BASE_HEX_SIZE;

    for (const button of container.querySelectorAll<HTMLButtonElement>("[data-collect-coord]")) {
      const key = button.getAttribute("data-collect-coord");
      const tile = tiles.find((t) => axialKey(t.coord) === key);
      if (!tile) {
        button.style.display = "none";
        continue;
      }
      const pos = getScreenPosition(tile.coord);
      if (!pos) {
        button.style.display = "none";
        continue;
      }
      button.style.display = "block";
      // Tip on the hex's top vertex; scale with zoom so the pin stays
      // proportional to the tile. translate(-w/2, -h) then scale keeps the
      // tip fixed at (pos.x, tipY) as size changes.
      const tipY = pos.y - hexCircumradius * PIN_TIP_ABOVE_CENTER;
      button.style.transform =
        `translate(${pos.x}px, ${tipY}px) scale(${scale}) ` +
        `translate(${-PIN_WIDTH / 2}px, ${-PIN_HEIGHT}px)`;
    }
  }

  useImperativeHandle(ref, () => ({
    reposition(getScreenPosition, hexCircumradius) {
      lastViewport.current = { getScreenPosition, hexCircumradius };
      applyPositions();
    },
  }));

  useLayoutEffect(() => {
    applyPositions();
  });

  return (
    <div ref={containerRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 54 }}>
      {tiles.map((tile) => (
        <CollectPin key={axialKey(tile.coord)} tile={tile} onCollect={onCollect} />
      ))}
    </div>
  );
});
