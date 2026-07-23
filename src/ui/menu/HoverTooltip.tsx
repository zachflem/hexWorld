import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import type { Axial } from "../../engine/hexCoords";

export interface HoverTooltipHandle {
  /** Imperative reposition — see the module doc comment for why this isn't a React state update. */
  reposition: (getScreenPosition: (coord: Axial) => { x: number; y: number } | null, hexCircumradius: number) => void;
}

/**
 * Desktop-mouse-only info card that follows whichever tile HexCanvas reports
 * as hovered (see HexCanvas's onTileHover) — anchored above the tile's true
 * screen position, repositioned imperatively so pan/zoom does not force a
 * GameScreen re-render. `coord`/`content` ARE React state in the parent, but
 * deliberately only change when the hovered tile itself changes (deduped in
 * HexCanvas), not on every mousemove pixel — so this still re-renders far
 * less often than the cursor moves.
 */
export const HoverTooltip = forwardRef<HoverTooltipHandle, { coord: Axial | null; content: ReactNode | null }>(
  function HoverTooltip({ coord, content }, ref) {
    const elRef = useRef<HTMLDivElement | null>(null);
    const lastViewport = useRef<{ getScreenPosition: (coord: Axial) => { x: number; y: number } | null; hexCircumradius: number } | null>(
      null,
    );

    function applyPosition() {
      const el = elRef.current;
      if (!el) return;
      if (!coord || !content || !lastViewport.current) {
        el.style.display = "none";
        return;
      }
      const { getScreenPosition, hexCircumradius } = lastViewport.current;
      const pos = getScreenPosition(coord);
      if (!pos) {
        el.style.display = "none";
        return;
      }
      el.style.display = "block";
      // Anchored above the tile's own top edge, centered horizontally —
      // translate(-50%, -100%) resolves against the element's own box, so
      // this stays correct regardless of the tooltip's actual rendered size.
      el.style.transform = `translate(${pos.x}px, ${pos.y - hexCircumradius}px) translate(-50%, -100%)`;
    }

    useImperativeHandle(ref, () => ({
      reposition(getScreenPosition, hexCircumradius) {
        lastViewport.current = { getScreenPosition, hexCircumradius };
        applyPosition();
      },
    }));

    // Re-applies whenever the hovered tile/content changes, using whatever
    // viewport reading `reposition` last cached. The wrapper div below is
    // NEVER conditionally unmounted (unlike an early `if (!content) return
    // null`) specifically so elRef — and therefore lastViewport, which only
    // gets (re-)populated via HexCanvas's own pan/zoom/redraw callback, not
    // on every hover — survives every hide/show cycle instead of resetting
    // to null each time a fresh hover has to wait for the next redraw.
    useLayoutEffect(() => {
      applyPosition();
    });

    return (
      <div ref={elRef} style={{ position: "fixed", left: 0, top: 0, display: "none", pointerEvents: "none", zIndex: 55 }}>
        {content}
      </div>
    );
  },
);
