import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { HexButton } from "../primitives/HexButton";
import { hexNeighborOffsets } from "../hexGeometry";

export interface HexClusterSlot {
  key: string;
  icon: ReactNode;
  title: string;
  /** Highlights this slot's hex — e.g. the panel it opens is currently open, or (hammer) build-mode is active. */
  active?: boolean;
  onClick: () => void;
}

/**
 * Only the up/upper-left/left directions are used to build the cluster
 * (never right/lower-right/lower-left), so it only ever grows up-and-left
 * from the bottom-right-anchored toggle and can't push itself off-screen.
 */
const { upperLeft: UPPER_LEFT, upperRight: UPPER_RIGHT, left: LEFT } = hexNeighborOffsets();

function add(a: [number, number], b: [number, number]): [number, number] {
  return [a[0] + b[0], a[1] + b[1]];
}

/**
 * Six positions, each reached by summing only UPPER_LEFT/UPPER_RIGHT/LEFT
 * steps from the center (the toggle) — since every step is a genuine
 * hex-neighbor offset, any two positions one step apart are true touching
 * neighbors, not just visually close. Forms a compact 2-3-1 triangular
 * honeycomb block above and to the left of the toggle.
 */
const HONEYCOMB_POSITIONS: [number, number][] = (() => {
  const p1 = UPPER_LEFT;
  const p2 = add(UPPER_LEFT, UPPER_RIGHT); // straight up from the toggle
  const p3 = add(UPPER_LEFT, LEFT);
  const p4 = add(p2, LEFT);
  const p5 = add(p2, UPPER_LEFT);
  const p6 = add(p3, UPPER_LEFT);
  return [p1, p2, p3, p4, p5, p6];
})();

/**
 * Collapsed-by-default global menu (bottom-right) — a single center hex
 * button that blooms into a tight honeycomb cluster of up to 6 hex buttons
 * on click, and retracts on a second click or a click outside the cluster.
 * Per-slot click handlers are expected to close the cluster themselves if
 * opening a panel (this component only owns the open/closed bloom state,
 * not what happens after a slot is clicked).
 *
 * `pinnedSlot`, if given, sits at the toggle's LEFT neighbor position —
 * always visible, unaffected by open/closed state, still a true touching
 * hex neighbor rather than an arbitrarily-placed nearby button. Meant for
 * playtest-only controls (fast-forward) that don't belong in the honeycomb
 * itself but should stay reachable without opening it.
 */
export function GlobalHexCluster({ slots, pinnedSlot }: { slots: HexClusterSlot[]; pinnedSlot?: HexClusterSlot }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "fixed", right: "1.25rem", bottom: "1.25rem" }}>
      {slots.slice(0, HONEYCOMB_POSITIONS.length).map((slot, i) => {
        const [dx, dy] = HONEYCOMB_POSITIONS[i];
        return (
          <HexButton
            key={slot.key}
            icon={slot.icon}
            title={slot.title}
            active={slot.active}
            onClick={slot.onClick}
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              transform: open ? `translate(${dx}px, ${dy}px) scale(1)` : "translate(0, 0) scale(0)",
              opacity: open ? 1 : 0,
              transition: "transform 0.2s ease, opacity 0.2s ease",
              pointerEvents: open ? "auto" : "none",
            }}
          />
        );
      })}
      {pinnedSlot && (
        <HexButton
          key={pinnedSlot.key}
          icon={pinnedSlot.icon}
          title={pinnedSlot.title}
          active={pinnedSlot.active}
          onClick={pinnedSlot.onClick}
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            transform: `translate(${LEFT[0]}px, ${LEFT[1]}px)`,
          }}
        />
      )}
      <HexButton
        icon={open ? <X size={20} /> : <Menu size={20} />}
        title={open ? "Close menu" : "Menu"}
        onClick={() => setOpen((v) => !v)}
        style={{ position: "relative" }}
      />
    </div>
  );
}
