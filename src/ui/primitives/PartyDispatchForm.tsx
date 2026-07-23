import type { ReactNode } from "react";
import type { ResourceType } from "../../data/resources";
import { formatCost, formatDuration } from "../format";
import { QuantityStepper } from "./QuantityStepper";

interface UnitSendField {
  available: number;
  toSend: number;
  onChange: (n: number) => void;
}

function UnitInput({ label, field }: { label: string; field: UnitSendField }) {
  if (field.available <= 0) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      <span style={{ fontSize: "0.8rem", opacity: 0.75 }}>
        {label} · {field.available} available
      </span>
      <QuantityStepper label={`${label} to send`} value={field.toSend} min={0} max={field.available} onChange={field.onChange} />
    </div>
  );
}

/**
 * Militia/knight/sniper quantity steppers + route/cost/ETA + commit button —
 * consolidates the three near-identical dispatch forms previously duplicated
 * in TilePopup.tsx (den assault, lab assault, and plain expedition).
 */
export function PartyDispatchForm({
  extraInfo,
  distanceTiles,
  pathCost,
  provisionsCost,
  etaMs,
  affordable,
  militia,
  junkyardKnight,
  crossBowSniper,
  buttonLabel,
  onCommit,
}: {
  /** Extra context shown above the route line, e.g. "Defense: 120" or "Guardian defense: 300" — omitted for a plain expedition. */
  extraInfo?: ReactNode;
  distanceTiles: number;
  pathCost: number;
  provisionsCost: Partial<Record<ResourceType, number>>;
  etaMs: number;
  affordable: boolean;
  militia: UnitSendField;
  junkyardKnight: UnitSendField;
  crossBowSniper: UnitSendField;
  buttonLabel: string;
  onCommit: () => void;
}) {
  const totalToSend = militia.toSend + junkyardKnight.toSend + crossBowSniper.toSend;
  const disabled = !affordable || totalToSend <= 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
      {extraInfo && <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>{extraInfo}</div>}
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
        <span>
          Route: {distanceTiles} tile{distanceTiles === 1 ? "" : "s"} (cost {pathCost.toFixed(1)})
        </span>
        <strong>{formatCost(provisionsCost)}</strong>
        <span style={{ opacity: 0.75 }}>ETA {formatDuration(etaMs)}</span>
      </div>
      <UnitInput label="militia" field={militia} />
      <UnitInput label="junkyard knights" field={junkyardKnight} />
      <UnitInput label="cross-bow snipers" field={crossBowSniper} />
      <button
        type="button"
        disabled={disabled}
        onClick={onCommit}
        style={{
          width: "100%",
          border: "none",
          borderRadius: 10,
          padding: "0.85rem 1rem",
          fontSize: "0.95rem",
          fontWeight: 650,
          background: disabled ? "rgba(255, 255, 255, 0.12)" : "#2e7d32",
          color: "white",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "default" : "pointer",
        }}
      >
        {buttonLabel}
      </button>
    </div>
  );
}
