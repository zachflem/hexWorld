import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

/**
 * Mobile-first bottom sheet shell — full-width and centered on small
 * viewports; capped and left-docked from 768px up (see `.bottom-sheet` in
 * index.css). Chrome only (header + optional toolbar + scroll body); tabs
 * and content layout belong to the consumer so Settings/Garrisons/etc. can
 * reuse this later without inheriting tile-action UI.
 */
export function BottomSheet({
  open,
  title,
  onClose,
  children,
  toolbar,
  footer,
  scrollKey,
  style,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Pinned between the title bar and the scrollable body (e.g. category tabs). */
  toolbar?: ReactNode;
  footer?: ReactNode;
  /** When this changes, the body scrolls back to top (tab / form navigation). */
  scrollKey?: string | number;
  style?: CSSProperties;
}) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const updateScrollAffordances = useCallback(() => {
    const el = bodyRef.current;
    if (!el) {
      setCanScrollUp(false);
      setCanScrollDown(false);
      return;
    }
    const { scrollTop, clientHeight, scrollHeight } = el;
    setCanScrollUp(scrollTop > 2);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 2);
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = bodyRef.current;
    if (!el) return;

    updateScrollAffordances();
    el.addEventListener("scroll", updateScrollAffordances, { passive: true });
    const observer = new ResizeObserver(updateScrollAffordances);
    observer.observe(el);
    if (el.firstElementChild) observer.observe(el.firstElementChild);

    return () => {
      el.removeEventListener("scroll", updateScrollAffordances);
      observer.disconnect();
    };
  }, [open, children, toolbar, updateScrollAffordances]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = 0;
    updateScrollAffordances();
  }, [scrollKey, updateScrollAffordances]);

  if (!open) return null;

  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.35)",
          zIndex: 50,
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="bottom-sheet"
        style={{
          position: "fixed",
          bottom: 0,
          // Fixed height (not only max-height) so the body gets a definite
          // scrollport — max-height alone leaves height indefinite and content
          // gets clipped without scrolling.
          // Tall enough for train/garrison steppers; body still scrolls when needed.
          height: "min(52vh, 420px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "rgba(20, 20, 22, 0.96)",
          color: "white",
          borderRadius: "12px 12px 0 0",
          zIndex: 51,
          pointerEvents: "auto",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.45)",
          ...style,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            padding: "0.85rem 1rem 0.65rem",
            flexShrink: 0,
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          }}
        >
          <strong style={{ fontSize: "1rem", lineHeight: 1.2 }}>{title}</strong>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              color: "white",
              borderRadius: 6,
              padding: "0.25rem 0.55rem",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
        {toolbar && (
          <div
            style={{
              flexShrink: 0,
              padding: "0.65rem 1rem 0",
            }}
          >
            {toolbar}
          </div>
        )}
        <div
          style={{
            position: "relative",
            flex: "1 1 0",
            minHeight: 0,
          }}
        >
          <div
            ref={bodyRef}
            style={{
              position: "absolute",
              inset: 0,
              overflowY: "auto",
              overflowX: "hidden",
              overscrollBehavior: "contain",
              touchAction: "pan-y",
              padding: "0.75rem 1rem 1rem",
              WebkitOverflowScrolling: "touch",
            }}
          >
            {children}
          </div>
          {canScrollUp && (
            <div
              aria-hidden
              style={{
                pointerEvents: "none",
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 28,
                background: "linear-gradient(to bottom, rgba(20, 20, 22, 0.96), rgba(20, 20, 22, 0))",
              }}
            />
          )}
          {canScrollDown && (
            <div
              aria-hidden
              style={{
                pointerEvents: "none",
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 40,
                background: "linear-gradient(to top, rgba(20, 20, 22, 0.98), rgba(20, 20, 22, 0))",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                paddingBottom: 6,
              }}
            >
              <span
                style={{
                  width: 36,
                  height: 3,
                  borderRadius: 2,
                  background: "rgba(255, 255, 255, 0.35)",
                }}
              />
            </div>
          )}
        </div>
        {footer && (
          <div
            style={{
              flexShrink: 0,
              padding: "0.65rem 1rem",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
