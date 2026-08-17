import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import type { Axial } from "../../engine/hexCoords";
import { axialKey } from "../../engine/hexCoords";
import { resolveAssetPath } from "../../render/assetPaths";
import { BASE_HEX_SIZE } from "../../render/HexCanvas";

export type PowerPinStatus = "full" | "degraded" | "offline";

export interface PowerStatusPin {
  coord: Axial;
  status: PowerPinStatus;
}

export interface PowerStatusPinOverlayHandle {
  /** Imperative reposition — same convention as CollectPinOverlay / HoverTooltip. */
  reposition: (getScreenPosition: (coord: Axial) => { x: number; y: number } | null, hexCircumradius: number) => void;
}

/**
 * Circular badge (not a pointy collect pin — those read as tappable stockpile
 * collect). Anchored in the same above-tile slot as collect pins.
 */
const BADGE_SIZE = 22;
const ICON_SIZE = 14;
/** Same tip height as CollectPinOverlay — badge bottom sits on that anchor. */
const ANCHOR_ABOVE_CENTER = 0.5;

const POWER_PIN_COLORS: Record<PowerPinStatus, { fill: string; stroke: string; label: string }> = {
  full: { fill: "rgba(46, 175, 80, 0.94)", stroke: "rgba(146, 213, 151, 0.6)", label: "Power OK" },
  degraded: { fill: "rgba(224, 142, 11, 0.94)", stroke: "rgba(255, 200, 120, 0.6)", label: "Brownout — underpowered" },
  offline: { fill: "rgba(231, 76, 60, 0.94)", stroke: "rgba(255, 160, 150, 0.6)", label: "Blackout — no power" },
};

function PowerBadge({ pin }: { pin: PowerStatusPin }) {
  const { fill, stroke, label } = POWER_PIN_COLORS[pin.status];

  return (
    <div
      data-power-pin-coord={axialKey(pin.coord)}
      title={label}
      aria-label={label}
      style={{
        position: "fixed",
        left: 0,
        top: 0,
        display: "none",
        width: BADGE_SIZE,
        height: BADGE_SIZE,
        borderRadius: "50%",
        background: fill,
        border: `1.5px solid ${stroke}`,
        boxSizing: "border-box",
        pointerEvents: "none",
        transformOrigin: "0 0",
        filter: "drop-shadow(0 1px 3px rgba(0, 0, 0, 0.45))",
      }}
    >
      <img
        src={resolveAssetPath("markers", "icon-power.png")}
        width={ICON_SIZE}
        height={ICON_SIZE}
        alt=""
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          objectFit: "contain",
        }}
      />
    </div>
  );
}

/**
 * Status badge above built power stations — same map slot as collect pins,
 * but a circle so it doesn't look collectable. Green = grid OK, orange =
 * brownout, red = blackout.
 */
export const PowerStatusPinOverlay = forwardRef<
  PowerStatusPinOverlayHandle,
  { pins: PowerStatusPin[] }
>(function PowerStatusPinOverlay({ pins }, ref) {
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

    for (const el of container.querySelectorAll<HTMLElement>("[data-power-pin-coord]")) {
      const key = el.getAttribute("data-power-pin-coord");
      const pin = pins.find((p) => axialKey(p.coord) === key);
      if (!pin) {
        el.style.display = "none";
        continue;
      }
      const pos = getScreenPosition(pin.coord);
      if (!pos) {
        el.style.display = "none";
        continue;
      }
      el.style.display = "block";
      const anchorY = pos.y - hexCircumradius * ANCHOR_ABOVE_CENTER;
      el.style.transform =
        `translate(${pos.x}px, ${anchorY}px) scale(${scale}) ` +
        `translate(${-BADGE_SIZE / 2}px, ${-BADGE_SIZE}px)`;
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
    <div ref={containerRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 30 }}>
      {pins.map((pin) => (
        <PowerBadge key={axialKey(pin.coord)} pin={pin} />
      ))}
    </div>
  );
});
