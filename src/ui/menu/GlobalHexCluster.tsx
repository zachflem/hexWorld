import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { HexButton } from "../primitives/HexButton";

export interface HexClusterSlot {
  key: string;
  icon: ReactNode;
  title: string;
  /** Highlights this slot's hex — e.g. the panel it opens is currently open, or (hammer) build-mode is active. */
  active?: boolean;
  /** Orange upgrade-available cue — takes precedence over `active` on HexButton. */
  highlight?: string;
  onClick: () => void;
}

/**
 * Collapsed-by-default global menu (bottom-right) — a single hex toggle that
 * expands into a vertical stack of hex buttons above it, and retracts on a
 * second click or a click outside. Per-slot click handlers own what happens
 * after a slot is clicked (this component only owns open/closed state).
 *
 * `pinnedSlots`, if given, sit to the left of the toggle — always visible,
 * unaffected by open/closed state. Production uses this for the playtest
 * speed cycle; dev-only tools live in the Dev tools panel instead.
 *
 * When any slot has a `highlight` and the menu is collapsed, the Menu toggle
 * inherits that highlight so the cue remains visible.
 */
export function GlobalHexCluster({ slots, pinnedSlots }: { slots: HexClusterSlot[]; pinnedSlots?: HexClusterSlot[] }) {
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

  const menuHighlight = !open ? slots.find((slot) => slot.highlight)?.highlight : undefined;

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        right: "1.25rem",
        bottom: "1.25rem",
        // Below BottomSheet backdrop/dialog (z 50/51) so the tile action
        // sheet and global panels cover the cluster when open.
        zIndex: 49,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: "0.35rem",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "0.35rem",
          // Collapse when closed so the toggle stays bottom-anchored.
          maxHeight: open ? 480 : 0,
          opacity: open ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.2s ease, opacity 0.2s ease",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        {slots.map((slot) => (
          <HexButton
            key={slot.key}
            icon={slot.icon}
            title={slot.title}
            active={slot.active}
            highlight={slot.highlight}
            onClick={slot.onClick}
          />
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        {pinnedSlots?.map((slot) => (
          <HexButton
            key={slot.key}
            icon={slot.icon}
            title={slot.title}
            active={slot.active}
            highlight={slot.highlight}
            onClick={slot.onClick}
          />
        ))}
        <HexButton
          icon={open ? <X size={20} /> : <Menu size={20} />}
          title={open ? "Close menu" : "Menu"}
          highlight={menuHighlight}
          onClick={() => setOpen((v) => !v)}
        />
      </div>
    </div>
  );
}
