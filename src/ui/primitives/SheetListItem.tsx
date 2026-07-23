import type { ReactNode } from "react";

/**
 * Non-interactive row matching TileActionSheet ActionRow chrome — title +
 * optional detail, used for read-only lists inside global cluster sheets.
 */
export function SheetListItem({
  title,
  detail,
  children,
  muted = false,
}: {
  title: string;
  detail?: string;
  /** Extra body under the detail line (e.g. an in-progress countdown). */
  children?: ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.15rem",
        width: "100%",
        boxSizing: "border-box",
        background: "rgba(255, 255, 255, 0.04)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: 8,
        padding: "0.65rem 0.75rem",
        color: "white",
        textAlign: "left",
        opacity: muted ? 0.7 : 1,
      }}
    >
      <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{title}</span>
      {detail && <span style={{ fontSize: "0.78rem", opacity: 0.75 }}>{detail}</span>}
      {children}
    </div>
  );
}

/** Uppercase section label used above steppers / grouped rows in sheet forms. */
export function SheetSectionLabel({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: "0.8rem",
        opacity: 0.7,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </span>
  );
}

/** Bordered summary block (route/cost cards in TrainForm / PartyDispatchForm). */
export function SheetInfoCard({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.25rem",
        padding: "0.75rem 0.85rem",
        borderRadius: 10,
        background: "rgba(255, 255, 255, 0.05)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        fontSize: "0.85rem",
      }}
    >
      {children}
    </div>
  );
}
