import { useCallback } from "react";
import type { ReactNode } from "react";
import type { Axial } from "../../engine/hexCoords";
import {
  CollapsibleNotificationRow,
  NOTIFICATION_EXPANDED_MS,
} from "./CollapsibleNotificationRow";
import { CoordLink } from "./CoordLink";

export interface ToastRecord {
  id: string;
  icon?: ReactNode;
  message: ReactNode;
  /** When set, rendered as a tappable coord link after `message`. */
  coord?: Axial;
  /** Optional second line — e.g. work cancelled by horde capture. */
  detail?: ReactNode;
}

/** Soft-wrap long toast copy near this length so it doesn't clip in the 320px tray. */
export const TOAST_SOFT_WRAP_CHARS = 42;

/**
 * Insert newlines at word boundaries near `maxChars` so long single-line
 * toasts wrap predictably (CSS `pre-wrap` preserves the breaks).
 */
export function softWrapToastText(text: string, maxChars = TOAST_SOFT_WRAP_CHARS): string {
  if (text.includes("\n") || text.length <= maxChars) return text;

  const lines: string[] = [];
  let remaining = text.trim();
  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars + 1);
    const breakAt = window.lastIndexOf(" ");
    const cut = breakAt > maxChars * 0.5 ? breakAt : maxChars;
    lines.push(remaining.slice(0, cut).trimEnd());
    remaining = remaining.slice(cut).trimStart();
  }
  if (remaining.length > 0) lines.push(remaining);
  return lines.join("\n");
}

/** `onDismiss` must be a stable (`useCallback`'d) reference — passed into dismiss timers. */
function ToastItem({
  toast,
  onDismiss,
  onGoToTile,
}: {
  toast: ToastRecord;
  onDismiss: (id: string) => void;
  onGoToTile?: (coord: Axial) => void;
}) {
  const dismiss = useCallback(() => onDismiss(toast.id), [onDismiss, toast.id]);

  return (
    <CollapsibleNotificationRow
      rowKey={toast.id}
      icon={toast.icon}
      expandedMs={NOTIFICATION_EXPANDED_MS}
      ephemeral
      onEphemeralDismiss={dismiss}
      wrapText
      panelStyle={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}
    >
      <span>{typeof toast.message === "string" ? softWrapToastText(toast.message) : toast.message}</span>
      {toast.coord != null && onGoToTile != null ? (
        <>
          {" "}
          <CoordLink coord={toast.coord} onGoToTile={onGoToTile} />
        </>
      ) : null}
      {toast.detail != null ? (
        <span style={{ display: "block", marginTop: "0.15rem", opacity: 0.85 }}>
          {typeof toast.detail === "string" ? softWrapToastText(toast.detail) : toast.detail}
        </span>
      ) : null}
    </CollapsibleNotificationRow>
  );
}

/**
 * Ephemeral one-off event notices (lab clue, watchtower signal, den cleared) —
 * distinct from `NotificationTray` countdown rows (builds / training / assaults).
 * Shows wrapped copy, then removes itself — no icon-peek linger. Renders bare
 * items (composed with the tray in `GameScreen`).
 */
export function ToastStack({
  toasts,
  onDismiss,
  onGoToTile,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
  onGoToTile?: (coord: Axial) => void;
}) {
  return (
    <>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} onGoToTile={onGoToTile} />
      ))}
    </>
  );
}
