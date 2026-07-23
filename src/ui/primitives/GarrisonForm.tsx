import { Check } from "lucide-react";
import { QuantityStepper } from "./QuantityStepper";
import { SheetButton } from "./SheetButton";

export type GarrisonUnitKind = "militia" | "junkyardKnight" | "crossBowSniper";

interface UnitField {
  available: number;
  toGarrison: number;
  onChange: (n: number) => void;
}

function UnitRow({
  label,
  field,
  hordeOccupied,
  onStation,
}: {
  label: string;
  field: UnitField;
  hordeOccupied: boolean;
  onStation: () => void;
}) {
  if (field.available <= 0) return null;
  const disabled = hordeOccupied || field.toGarrison <= 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
      <div
        style={{
          flex: "0 0 4.6rem",
          fontSize: "0.72rem",
          lineHeight: 1.25,
          opacity: 0.8,
        }}
      >
        <div style={{ fontWeight: 650, opacity: 1 }}>{label}</div>
        <div>{field.available} free</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <QuantityStepper
          compact
          label={`${label} to garrison`}
          value={field.toGarrison}
          min={0}
          max={field.available}
          onChange={field.onChange}
        />
      </div>
      <button
        type="button"
        aria-label={`Station ${label}`}
        disabled={disabled}
        onClick={onStation}
        style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 0,
          border: "none",
          borderRadius: 8,
          background: disabled ? "rgba(255, 255, 255, 0.12)" : "#2e7d32",
          color: "white",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "default" : "pointer",
          WebkitTapHighlightColor: "transparent",
        }}
      >
        <Check size={18} strokeWidth={2.5} />
      </button>
    </div>
  );
}

/**
 * Dense multi-unit garrison sheet: one compact stepper + station-check row
 * per available unit type (no separate Station footer).
 */
export function GarrisonForm({
  stationedSummary,
  militia,
  junkyardKnight,
  crossBowSniper,
  recalling,
  hordeOccupied,
  onStation,
  onRecall,
}: {
  /** e.g. "8 militia · 2 knights" — omitted when nothing is stationed. */
  stationedSummary?: string;
  militia: UnitField;
  junkyardKnight: UnitField;
  crossBowSniper: UnitField;
  recalling: boolean;
  hordeOccupied: boolean;
  onStation: (kind: GarrisonUnitKind) => void;
  onRecall: () => void;
}) {
  const anyFree = militia.available > 0 || junkyardKnight.available > 0 || crossBowSniper.available > 0;
  const canRecall = !!stationedSummary && !recalling;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", fontSize: "0.8rem" }}>
      {stationedSummary && <span style={{ opacity: 0.8 }}>{stationedSummary} stationed</span>}
      {anyFree && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          <UnitRow
            label="militia"
            field={militia}
            hordeOccupied={hordeOccupied}
            onStation={() => onStation("militia")}
          />
          <UnitRow
            label="knights"
            field={junkyardKnight}
            hordeOccupied={hordeOccupied}
            onStation={() => onStation("junkyardKnight")}
          />
          <UnitRow
            label="snipers"
            field={crossBowSniper}
            hordeOccupied={hordeOccupied}
            onStation={() => onStation("crossBowSniper")}
          />
        </div>
      )}
      {recalling ? (
        <span>Recalling…</span>
      ) : (
        canRecall && (
          <SheetButton variant="secondary" onClick={onRecall}>
            Recall
          </SheetButton>
        )
      )}
    </div>
  );
}
