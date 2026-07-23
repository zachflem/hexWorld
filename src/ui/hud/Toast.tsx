import { useCallback } from "react";
import type { ReactNode } from "react";
import {
  CollapsibleNotificationRow,
  NOTIFICATION_EXPANDED_MS,
} from "./CollapsibleNotificationRow";

export interface ToastRecord {
  id: string;
  icon?: ReactNode;
  message: ReactNode;
}

/** How long a collapsed toast lingers as an icon peek before removing itself. */
const TOAST_PEEK_DISMISS_MS = 8000;

/** `onDismiss` must be a stable (`useCallback`'d) reference — passed into peek-dismiss timers. */
function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  const dismiss = useCallback(() => onDismiss(toast.id), [onDismiss, toast.id]);

  return (
    <CollapsibleNotificationRow
      rowKey={toast.id}
      icon={toast.icon}
      expandedMs={NOTIFICATION_EXPANDED_MS}
      peekDismissMs={TOAST_PEEK_DISMISS_MS}
      onPeekDismiss={dismiss}
      panelStyle={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}
    >
      <span>{toast.message}</span>
    </CollapsibleNotificationRow>
  );
}

/**
 * Ephemeral one-off event notices (lab clue landed, den cleared, base
 * upgrade completed) — a distinct lifecycle from `NotificationTray`'s
 * ambient countdown rows: each toast expands fully, slides to an icon peek,
 * then removes itself after a short peek linger. Renders bare items, not its
 * own positioned container — see `NotificationTray`'s doc comment for why
 * (composed together in `GameScreen`).
 */
export function ToastStack({ toasts, onDismiss }: { toasts: ToastRecord[]; onDismiss: (id: string) => void }) {
  return (
    <>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </>
  );
}
