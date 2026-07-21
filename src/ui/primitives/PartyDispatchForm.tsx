import type { ReactNode } from "react";
import type { ResourceType } from "../../data/resources";
import { formatCost, formatDuration } from "../format";

interface UnitSendField {
  available: number;
  toSend: number;
  onChange: (n: number) => void;
}

function UnitInput({ label, field }: { label: string; field: UnitSendField }) {
  if (field.available <= 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
      <input
        type="number"
        min={0}
        max={field.available}
        value={field.toSend}
        onChange={(e) => field.onChange(Number(e.target.value))}
        style={{ width: 60 }}
        aria-label={`${label} to send`}
      />
      <span>
        {label} (of {field.available} available)
      </span>
    </div>
  );
}

/**
 * Militia/knight/sniper quantity inputs + route/cost/ETA + commit button —
 * consolidates the three near-identical dispatch forms previously duplicated
 * in TilePopup.tsx (den assault, lab assault, and plain expedition), which
 * differed only in an optional defense-line and the commit button's label.
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
  return (
    <>
      {extraInfo}
      <p>
        Route: {distanceTiles} tile{distanceTiles === 1 ? "" : "s"} (cost {pathCost.toFixed(1)}) — {formatCost(provisionsCost)} — ETA{" "}
        {formatDuration(etaMs)}
      </p>
      <UnitInput label="militia" field={militia} />
      <UnitInput label="junkyard knights" field={junkyardKnight} />
      <UnitInput label="cross-bow snipers" field={crossBowSniper} />
      <button type="button" disabled={!affordable || totalToSend <= 0} onClick={onCommit} style={{ marginTop: "0.25rem" }}>
        {buttonLabel}
      </button>
    </>
  );
}
