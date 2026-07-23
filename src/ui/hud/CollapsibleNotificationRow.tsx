import { useCallback, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Panel } from "../primitives/Panel";

export const NOTIFICATION_EXPANDED_MS = 5000;
export const NOTIFICATION_SLIDE_MS = 350;
/** Lucide + marker icons in the top-right notification column — keep rows a uniform height. */
export const NOTIFICATION_ICON_SIZE = 14;

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
 * Top-right HUD row: expanded label/countdown for {@link NOTIFICATION_EXPANDED_MS},
 * then the text/countdown slides out to the right while the icon (left) stays as a
 * compact peek at the column's right edge. Tap the icon to expand again (timer resets).
 */
export function CollapsibleNotificationRow({
  rowKey,
  icon,
  children,
  panelStyle,
  expandedMs = NOTIFICATION_EXPANDED_MS,
  onPeekDismiss,
  peekDismissMs,
}: {
  rowKey: string;
  icon: ReactNode;
  children: ReactNode;
  panelStyle?: CSSProperties;
  expandedMs?: number;
  /** Optional — e.g. one-off toasts dismiss after lingering collapsed. */
  onPeekDismiss?: () => void;
  peekDismissMs?: number;
}) {
  const [expanded, setExpanded] = useState(true);

  const expand = useCallback(() => setExpanded(true), []);

  useEffect(() => {
    if (!expanded) return;
    const collapseTimer = window.setTimeout(() => setExpanded(false), expandedMs);
    return () => window.clearTimeout(collapseTimer);
  }, [expanded, expandedMs, rowKey]);

  useEffect(() => {
    if (expanded || onPeekDismiss == null || peekDismissMs == null) return;
    const dismissTimer = window.setTimeout(onPeekDismiss, peekDismissMs);
    return () => window.clearTimeout(dismissTimer);
  }, [expanded, onPeekDismiss, peekDismissMs, rowKey]);

  const slideMs = NOTIFICATION_SLIDE_MS;

  return (
    <Panel
      style={{
        display: "flex",
        alignItems: "center",
        alignSelf: "flex-end",
        gap: expanded ? "0.5rem" : 0,
        maxWidth: "min(90vw, 320px)",
        overflow: "hidden",
        transition: `gap ${slideMs}ms ease`,
        ...panelStyle,
      }}
    >
      <button
        type="button"
        onClick={expanded ? undefined : expand}
        aria-expanded={expanded}
        aria-label={expanded ? undefined : "Expand notification"}
        style={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          padding: 0,
          margin: 0,
          border: "none",
          background: "transparent",
          color: "inherit",
          cursor: expanded ? "default" : "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
        tabIndex={expanded ? -1 : 0}
      >
        {icon != null ? <NotificationIconSlot icon={icon} /> : null}
      </button>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          flex: "1 1 auto",
          minWidth: 0,
          overflow: "hidden",
          maxWidth: expanded ? "100%" : 0,
          opacity: expanded ? 1 : 0,
          transform: expanded ? "translateX(0)" : "translateX(12px)",
          transition: `max-width ${slideMs}ms ease, opacity ${slideMs}ms ease, transform ${slideMs}ms ease`,
          pointerEvents: expanded ? "auto" : "none",
          whiteSpace: "nowrap",
        }}
      >
        {children}
      </div>
    </Panel>
  );
}
