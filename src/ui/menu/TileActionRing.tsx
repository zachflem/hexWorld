import { ArrowLeft } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { ReactNode } from "react";
import { axialNeighbors, type Axial } from "../../engine/hexCoords";
import { UPGRADE_AVAILABLE_BADGE_COLOR } from "../../render/HexCanvas";
import { HexButton } from "../primitives/HexButton";

export interface RingAction {
  key: string;
  icon: ReactNode;
  /** Also used as the hex's hover tooltip — this is the "cost/duration preview" the design calls for, via the native title attribute rather than a custom tooltip component (genuinely lightweight, per the plan). */
  title: string;
  disabled?: boolean;
  /**
   * True if this action itself is an upgrade that's currently affordable —
   * OR (for a category hex) if ANY descendant subAction has this set,
   * computed bottom-up when building the tree (see GameScreen.tsx's
   * ringActionsFor). Colors the hex the same orange used for the map's own
   * structure-level upgrade badges, so the indicator is visible on a parent
   * category hex without having to open it first — the whole click path
   * down to an available upgrade lights up, not just the leaf.
   */
  upgradeAvailable?: boolean;
  /** Exactly one of onClick/subActions/formContent/dialogContent. */
  onClick?: () => void;
  /** Drills into a further set of choices, replacing the currently-shown ring in place (see the module doc comment) — used for genuine multi-choice branching (which resource, which structure category). */
  subActions?: RingAction[];
  /** Opens a small non-hex popover (a form, not more hexes) anchored to this hex — used for the few leaf interactions that are inherently a form (quantity input + buttons: garrison, unit training) rather than a discrete choice. */
  formContent?: ReactNode;
  /**
   * Like `formContent`, but renders fixed to the viewport's bottom-center
   * instead of anchored below the hex — for read-only status info (the
   * "Info" hex: auto-flow/connected status, noise floor, tower stats,
   * base-relocation countdown) rather than a form next to the tile the
   * player clicked. Otherwise an ordinary ring action: it occupies a normal
   * neighbor slot like anything else, not a reserved position.
   */
  dialogContent?: ReactNode;
}

export interface TileActionRingHandle {
  /**
   * Called on every HexCanvas redraw with a resolver from axial coord to
   * true on-screen position (HexCanvas's own getTileScreenPosition) and the
   * current on-screen hex circumradius (BASE_HEX_SIZE * zoom) — repositions
   * every currently-mounted hex by looking up its registered coordinate.
   * Deliberately not a React state update (see the module doc comment below).
   */
  repositionAll: (getScreenPosition: (coord: Axial) => { x: number; y: number } | null, hexCircumradius: number) => void;
}

const SQRT3 = Math.sqrt(3);

interface RegistryEntry {
  el: HTMLDivElement;
  coord: Axial;
}

/**
 * DOM overlay of hex buttons anchored to the selected tile's true map
 * neighbors — the structural "commit an action" buttons previously inline in
 * TilePopup.tsx, re-homed here (see GameScreen.tsx:ringActionsFor for the
 * tile-state -> actions mapping).
 *
 * A hex with `subActions` does NOT pop out a further ring of hexes around
 * itself — instead it *replaces* the currently-displayed set of hexes with
 * its subActions, always positioned at the SAME anchor tile's 6 neighbor
 * positions, all 6 of which stay available for real actions. This was a
 * deliberate revision after the first recursive-ring version anchored each
 * sub-ring at the clicked hex's own coordinate — for a category several
 * levels deep that placed hexes visibly far from the selected tile (a real
 * bug the user hit live). Anchoring every level at the same root tile makes
 * that class of bug structurally impossible: the ring can never drift away
 * from the tile it belongs to, at any depth.
 *
 * The tile's own center is deliberately left empty at every depth — the
 * user wants it kept clear so the selected tile itself stays visible under
 * the ring, not used as a 7th action slot. Once the player has drilled below
 * the root, a "Back" hex appears at a true tessellating position *outside*
 * the 6-neighbor ring — one step upper-right then one step right of that
 * (tucked beside the upper-right hex, not stacked directly above it) —
 * rather than displacing one of the 6 real slots. "Info" (see
 * `RingAction.dialogContent`), by contrast, is an ordinary action GameScreen
 * appends to the root action list — it competes for a normal neighbor slot
 * like everything else, rather than getting its own reserved position, per
 * the user's call that it belongs in the main ring, not bolted on outside it.
 *
 * Positioning is imperative, not a React prop: every currently-rendered hex
 * registers its own DOM node + axial coordinate in a shared registry;
 * `repositionAll` (called from HexCanvas's onViewportChange -> GameScreen)
 * walks that registry and writes position/size directly via style, with no
 * React re-render — every pan/zoom frame would otherwise force a GameScreen
 * re-render (see Phase 0's notes in the implementation plan). A component
 * only re-renders when the action tree itself changes, or the drill-down
 * path changes (ordinary local state).
 *
 * Sizing matches HexCanvas's own convention exactly: a hex with circumradius
 * R renders as `size*sqrt(3)` x `size*2` (see HexCanvas.tsx's own
 * `size * sqrt3, size * 2` texture-draw calls) — HexButton's clip-path is a
 * true regular hexagon at exactly that aspect ratio, so these buttons are
 * pixel-for-pixel the same size as the map hexes they sit on, at any zoom.
 */
export const TileActionRing = forwardRef<TileActionRingHandle, { rootCoord: Axial; actions: RingAction[] }>(
  function TileActionRing({ rootCoord, actions }, ref) {
    const registry = useRef<Map<string, RegistryEntry>>(new Map());
    const lastViewport = useRef<{ getScreenPosition: (coord: Axial) => { x: number; y: number } | null; hexCircumradius: number } | null>(
      null,
    );
    const [path, setPath] = useState<string[]>([]);
    const [openKey, setOpenKey] = useState<string | null>(null);
    const dialogPanelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
      setOpenKey(null);
    }, [path]);

    function applyPosition(el: HTMLDivElement, coord: Axial) {
      if (!lastViewport.current) return;
      const { getScreenPosition, hexCircumradius } = lastViewport.current;
      const pos = getScreenPosition(coord);
      if (!pos) {
        el.style.display = "none";
        return;
      }
      const width = hexCircumradius * SQRT3;
      const height = hexCircumradius * 2;
      el.style.display = "block";
      el.style.width = `${width}px`;
      el.style.height = `${height}px`;
      el.style.transform = `translate(${pos.x - width / 2}px, ${pos.y - height / 2}px)`;
    }

    useImperativeHandle(ref, () => ({
      repositionAll(getScreenPosition, hexCircumradius) {
        lastViewport.current = { getScreenPosition, hexCircumradius };
        for (const { el, coord } of registry.current.values()) {
          applyPosition(el, coord);
        }
      },
    }));

    function registerRef(key: string, coord: Axial, el: HTMLDivElement | null) {
      if (el) {
        registry.current.set(key, { el, coord });
        applyPosition(el, coord);
      } else {
        registry.current.delete(key);
      }
    }

    // Walk the drill-down path to find the currently-displayed level. Re-walked
    // from the live `actions` prop every render (not snapshotted) so affordability
    // / cost text stay fresh while the player sits inside a sub-level.
    let level = actions;
    for (const key of path) {
      const found = level.find((a) => a.key === key);
      if (!found?.subActions) break;
      level = found.subActions;
    }

    const showBack = path.length > 0;
    const leafActions = level.slice(0, 6);
    const neighbors = axialNeighbors(rootCoord);
    // One step upper-right then one step right of that (neighbors[1] is
    // rootCoord's own upper-right neighbor) — a real tessellating position
    // just outside the ring, tucked beside the upper-right hex rather than
    // stacked directly above it, and never one of the 6 slots used for actions.
    const backCoord = axialNeighbors(neighbors[1])[0];

    const backAction: RingAction = {
      key: "__back",
      icon: <ArrowLeft size={18} />,
      title: "Back",
      onClick: () => setPath((p) => p.slice(0, -1)),
    };

    // Only ever set for a leaf that's both open AND carries dialogContent —
    // its popover renders as its own top-level sibling below (a fixed
    // bottom-center dialog can't live inside a hex's own transformed wrapper,
    // since a CSS transform makes that wrapper the containing block for any
    // `position: fixed` descendant, breaking the "fixed to viewport" intent).
    const openDialogAction = leafActions.find((a) => a.key === openKey && a.dialogContent);

    useEffect(() => {
      if (!openKey) return;
      function handlePointerDown(event: PointerEvent) {
        const target = event.target as Node;
        if (registry.current.get(openKey!)?.el.contains(target)) return;
        if (dialogPanelRef.current?.contains(target)) return;
        setOpenKey(null);
      }
      document.addEventListener("pointerdown", handlePointerDown);
      return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, [openKey]);

    function renderHex(action: RingAction, coord: Axial) {
      const isOpen = openKey === action.key;
      return (
        <div
          key={action.key}
          ref={(el) => registerRef(action.key, coord, el)}
          style={{ position: "fixed", left: 0, top: 0, display: "none", pointerEvents: "none" }}
        >
          <HexButton
            icon={action.icon}
            title={action.title}
            disabled={action.disabled}
            highlight={action.upgradeAvailable ? UPGRADE_AVAILABLE_BADGE_COLOR : undefined}
            onClick={() => {
              if (action.subActions) {
                setPath((p) => [...p, action.key]);
              } else if (action.formContent || action.dialogContent) {
                setOpenKey((k) => (k === action.key ? null : action.key));
              } else {
                action.onClick?.();
              }
            }}
            style={{ position: "relative", width: "100%", height: "100%", pointerEvents: "auto" }}
          />
          {isOpen && action.formContent && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "100%",
                transform: "translateX(-50%)",
                marginTop: "0.4rem",
                pointerEvents: "auto",
              }}
            >
              {action.formContent}
            </div>
          )}
        </div>
      );
    }

    return (
      <>
        {leafActions.map((action, i) => renderHex(action, neighbors[i]))}
        {showBack && renderHex(backAction, backCoord)}
        {openDialogAction && (
          <div
            ref={dialogPanelRef}
            style={{
              position: "fixed",
              bottom: "1.5rem",
              left: "50%",
              transform: "translateX(-50%)",
              pointerEvents: "auto",
              zIndex: 50,
            }}
          >
            {openDialogAction.dialogContent}
          </div>
        )}
      </>
    );
  },
);
