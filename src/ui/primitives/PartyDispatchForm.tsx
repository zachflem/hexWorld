import type { ReactNode } from "react";
import type { ResourceType } from "../../data/resources";
import { formatCost, formatDuration } from "../format";
import { QuantityStepper } from "./QuantityStepper";
import { SheetButton } from "./SheetButton";
import { SheetInfoCard } from "./SheetListItem";

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
      <SheetInfoCard>
        <span>
          Route: {distanceTiles} tile{distanceTiles === 1 ? "" : "s"} (cost {pathCost.toFixed(1)})
        </span>
        <strong>{formatCost(provisionsCost)}</strong>
        <span style={{ opacity: 0.75 }}>ETA {formatDuration(etaMs)}</span>
      </SheetInfoCard>
      <UnitInput label="militia" field={militia} />
      <UnitInput label="junkyard knights" field={junkyardKnight} />
      <UnitInput label="cross-bow snipers" field={crossBowSniper} />
      <SheetButton compact disabled={disabled} onClick={onCommit}>
        {buttonLabel}
      </SheetButton>
    </div>
  );
}
