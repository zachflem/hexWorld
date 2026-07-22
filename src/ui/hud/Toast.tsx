import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Panel } from "../primitives/Panel";

export interface ToastRecord {
  id: string;
  icon?: ReactNode;
  message: ReactNode;
}

const TOAST_VISIBLE_MS = 5000;
/** How long the opacity transition takes — removal is deferred by this long past TOAST_VISIBLE_MS so the fade actually gets to play instead of the toast just vanishing. */
const TOAST_FADE_MS = 400;

/** `onDismiss` must be a stable (`useCallback`'d) reference — it's a `useEffect` dependency here, and the parent re-renders often (the game clock ticks every second or so), so an unstable identity would restart every toast's fade timer on every tick. */
function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), TOAST_VISIBLE_MS);
    const removeTimer = setTimeout(() => onDismiss(toast.id), TOAST_VISIBLE_MS + TOAST_FADE_MS);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [toast.id, onDismiss]);

  return (
    <Panel
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.5rem 0.75rem",
        fontSize: "0.85rem",
        opacity: fading ? 0 : 1,
        transition: `opacity ${TOAST_FADE_MS}ms ease`,
      }}
    >
      {toast.icon}
      <span>{toast.message}</span>
    </Panel>
  );
}

/**
 * Ephemeral one-off event notices (lab clue landed, den cleared, base
 * upgrade completed) — a distinct lifecycle from `NotificationTray`'s
 * ambient countdown rows: each toast fades and removes itself a few seconds
 * after appearing, rather than persisting for as long as some underlying
 * record exists. Renders bare items, not its own positioned container — see
 * `NotificationTray`'s doc comment for why (composed together in `GameScreen`).
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
