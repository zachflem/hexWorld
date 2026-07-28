import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";
import { BottomSheet } from "./BottomSheet";
import { SheetButton } from "./SheetButton";

export type ConfirmRequest = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Above Settings / tile sheets (layer 50) so discard/load/demolish confirms stack on top. */
const CONFIRM_LAYER = 200;

/**
 * Promise-based in-app confirm (#86) — replaces `window.confirm` with BottomSheet
 * chrome matching game menus. Mount once near the app root.
 */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((next) => {
    return new Promise<boolean>((resolve) => {
      // Replace any in-flight confirm (should be rare) without resolving inside a
      // setState updater — StrictMode double-invokes updaters in dev.
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setRequest(next);
    });
  }, []);

  function settle(value: boolean) {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setRequest(null);
    resolve?.(value);
  }

  const confirmLabel = request?.confirmLabel ?? "Confirm";
  const cancelLabel = request?.cancelLabel ?? "Cancel";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && (
        <BottomSheet
          open
          title={request.title}
          onClose={() => settle(false)}
          layer={CONFIRM_LAYER}
          style={{ height: "min(34vh, 280px)" }}
          footer={
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <SheetButton onClick={() => settle(true)}>{confirmLabel}</SheetButton>
              <SheetButton variant="secondary" onClick={() => settle(false)}>
                {cancelLabel}
              </SheetButton>
            </div>
          }
        >
          <p
            style={{
              margin: 0,
              fontSize: "0.85rem",
              lineHeight: 1.4,
              opacity: 0.85,
              textAlign: "left",
            }}
          >
            {request.message}
          </p>
        </BottomSheet>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within ConfirmProvider");
  }
  return confirm;
}
