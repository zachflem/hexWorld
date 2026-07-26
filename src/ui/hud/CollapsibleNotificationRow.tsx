import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Panel } from "../primitives/Panel";

export const NOTIFICATION_EXPANDED_MS = 5000;
export const NOTIFICATION_SLIDE_MS = 350;
/** Lucide + marker icons in the top-right notification column — keep rows a uniform height. */
export const NOTIFICATION_ICON_SIZE = 14;
/** Compact countdown / toast rows. */
export const NOTIFICATION_ROW_MAX_WIDTH = "min(90vw, 320px)";
/** Arrival orders with action buttons — must fit Redeploy / Reinforce / Garrison / Recall / Dismiss. */
export const NOTIFICATION_DECISION_ROW_MAX_WIDTH = "min(96vw, 720px)";

function NotificationIconSlot({ icon }: { icon: ReactNode }) {
  return (
    <span
      style={{
        width: NOTIFICATION_ICON_SIZE,
        height: NOTIFICATION_ICON_SIZE,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        lineHeight: 0,
      }}
    >
      {icon}
    </span>
  );
}

/**
 * Top-right HUD row.
 *
 * Default (tray): expanded label/countdown for {@link NOTIFICATION_EXPANDED_MS},
 * then the text slides out while the icon stays as a compact peek. Tap to expand again.
 *
 * `stayExpandedUntilDismiss`: stay expanded until the player hits Dismiss (or the row
 * unmounts). Used for expedition arrival orders — collapses to the usual icon peek,
 * still present until auto-recall removes the expedition.
 *
 * `ephemeral` (toasts): stay expanded, then call `onEphemeralDismiss` — no icon peek.
 * Watchtower / clue / den notices should vanish, not linger like build timers.
 */
export type CollapsibleNotificationApi = {
  expanded: boolean;
  collapse: () => void;
};

export function CollapsibleNotificationRow({
  rowKey,
  icon,
  children,
  panelStyle,
  expandedMs = NOTIFICATION_EXPANDED_MS,
  onPeekDismiss,
  peekDismissMs,
  /** When true, body text wraps instead of clipping (toasts). Countdown tray rows stay single-line. */
  wrapText = false,
  /** Show once, then remove — no collapse-to-icon linger. */
  ephemeral = false,
  onEphemeralDismiss,
  /** Emphasize the collapsed icon peek (arrival decisions). */
  highlightPeek = false,
  /** Do not auto-collapse; caller should offer Dismiss via function children. */
  stayExpandedUntilDismiss = false,
}: {
  rowKey: string;
  icon: ReactNode;
  children: ReactNode | ((api: CollapsibleNotificationApi) => ReactNode);
  panelStyle?: CSSProperties;
  expandedMs?: number;
  /** Optional — e.g. one-off toasts dismiss after lingering collapsed. */
  onPeekDismiss?: () => void;
  peekDismissMs?: number;
  wrapText?: boolean;
  ephemeral?: boolean;
  onEphemeralDismiss?: () => void;
  highlightPeek?: boolean;
  stayExpandedUntilDismiss?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  const expand = useCallback(() => setExpanded(true), []);
  const collapse = useCallback(() => setExpanded(false), []);
  const body = typeof children === "function" ? children({ expanded, collapse }) : children;

  useEffect(() => {
    if (ephemeral) {
      if (onEphemeralDismiss == null) return;
      const dismissTimer = window.setTimeout(onEphemeralDismiss, expandedMs);
      return () => window.clearTimeout(dismissTimer);
    }
    if (stayExpandedUntilDismiss) return;
    if (!expanded) return;
    const collapseTimer = window.setTimeout(() => setExpanded(false), expandedMs);
    return () => window.clearTimeout(collapseTimer);
  }, [ephemeral, expanded, expandedMs, onEphemeralDismiss, rowKey, stayExpandedUntilDismiss]);

  useEffect(() => {
    if (ephemeral || expanded || onPeekDismiss == null || peekDismissMs == null) return;
    const dismissTimer = window.setTimeout(onPeekDismiss, peekDismissMs);
    return () => window.clearTimeout(dismissTimer);
  }, [ephemeral, expanded, onPeekDismiss, peekDismissMs, rowKey]);

  const slideMs = NOTIFICATION_SLIDE_MS;
  /** Wrapping only while fully expanded — shrinking max-width with pre-wrap makes a tall 1-char column. */
  const wrapping = wrapText && expanded;
  /** Arrival decision rows: wider slide-out + flex-wrap so action buttons aren't clipped. */
  const decisionExpanded = stayExpandedUntilDismiss && expanded;
  const rowMaxWidth = decisionExpanded
    ? NOTIFICATION_DECISION_ROW_MAX_WIDTH
    : NOTIFICATION_ROW_MAX_WIDTH;

  return (
    <Panel
      style={{
        display: "flex",
        alignItems: wrapping || decisionExpanded ? "flex-start" : "center",
        alignSelf: "flex-end",
        gap: expanded ? "0.5rem" : 0,
        maxWidth: rowMaxWidth,
        overflow: "hidden",
        transition: `gap ${slideMs}ms ease, max-width ${slideMs}ms ease`,
        ...(highlightPeek && !expanded
          ? {
              boxShadow: "0 0 0 2px rgba(255, 180, 70, 0.85)",
              borderRadius: 8,
            }
          : null),
        ...panelStyle,
      }}
    >
      <button
        type="button"
        onClick={expanded || ephemeral ? undefined : expand}
        aria-expanded={expanded}
        aria-label={expanded || ephemeral ? undefined : "Expand notification"}
        style={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          padding:
            wrapping || decisionExpanded
              ? "0.1rem 0 0"
              : highlightPeek && !expanded
                ? "0.2rem"
                : 0,
          margin: 0,
          border: "none",
          background: highlightPeek && !expanded ? "rgba(255, 180, 70, 0.25)" : "transparent",
          borderRadius: highlightPeek && !expanded ? 999 : 0,
          color: "inherit",
          cursor: expanded || ephemeral ? "default" : "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
        tabIndex={expanded || ephemeral ? -1 : 0}
      >
        {icon != null ? <NotificationIconSlot icon={icon} /> : null}
      </button>
      <div
        style={{
          display: wrapping ? "block" : "flex",
          alignItems: wrapping ? undefined : "center",
          flexWrap: decisionExpanded ? "wrap" : undefined,
          rowGap: decisionExpanded ? "0.35rem" : undefined,
          gap: wrapping ? undefined : "0.5rem",
          flex: "1 1 auto",
          minWidth: 0,
          overflow: "hidden",
          maxWidth: expanded ? "100%" : 0,
          opacity: expanded ? 1 : 0,
          transform: expanded ? "translateX(0)" : "translateX(12px)",
          transition: `max-width ${slideMs}ms ease, opacity ${slideMs}ms ease, transform ${slideMs}ms ease`,
          pointerEvents: expanded ? "auto" : "none",
          whiteSpace: wrapping ? "pre-wrap" : "nowrap",
          overflowWrap: wrapping ? "break-word" : undefined,
          lineHeight: wrapping ? 1.35 : undefined,
        }}
      >
        {body}
      </div>
    </Panel>
  );
}
