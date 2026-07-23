import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { Crosshair, ZoomIn, ZoomOut } from "lucide-react";
import { HexButton } from "../primitives/HexButton";

const HOLD_DELAY_MS = 350;
const HOLD_INTERVAL_MS = 80;

/**
 * Hex button that fires `onStep` immediately on press, then keeps stepping
 * while held (after a short delay). Pointer capture keeps the repeat going if
 * the finger slides slightly off the hex.
 */
function HoldRepeatHexButton({
  icon,
  title,
  onStep,
}: {
  icon: ReactNode;
  title: string;
  onStep: () => void;
}) {
  const delayRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  function clearHold() {
    if (delayRef.current !== null) {
      window.clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => () => clearHold(), []);

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    onStepRef.current();
    delayRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(() => onStepRef.current(), HOLD_INTERVAL_MS);
    }, HOLD_DELAY_MS);
  }

  function handlePointerEnd(event: PointerEvent<HTMLButtonElement>) {
    clearHold();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <HexButton
      icon={icon}
      title={title}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onLostPointerCapture={clearHold}
      onContextMenu={(event) => event.preventDefault()}
    />
  );
}

/**
 * Bottom-left map camera controls — mirrors the global hex cluster's
 * bottom-right footprint so the HUD reads balanced. Zoom steps match the
 * wheel/pinch factor (1.1); hold repeats. Recenter reuses
 * HexCanvas.recenterOnBase (same as Settings → Recenter on Base).
 */
export function MapControls({
  onZoomIn,
  onZoomOut,
  onRecenterOnBase,
}: {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenterOnBase: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        left: "1.25rem",
        bottom: "1.25rem",
        // Match GlobalHexCluster: below BottomSheet (z 50/51).
        zIndex: 49,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: "0.35rem",
      }}
    >
      <HoldRepeatHexButton icon={<ZoomIn size={20} />} title="Zoom in" onStep={onZoomIn} />
      <HoldRepeatHexButton icon={<ZoomOut size={20} />} title="Zoom out" onStep={onZoomOut} />
      <HexButton icon={<Crosshair size={20} />} title="Recenter on base" onClick={onRecenterOnBase} />
    </div>
  );
}
