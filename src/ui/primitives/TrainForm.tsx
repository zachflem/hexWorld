import type { CSSProperties } from "react";
import { QuantityStepper } from "./QuantityStepper";
import { formatCost } from "../format";
import type { SimpleTrainOption, TrainOption, TrainQueueStatus } from "../tileOptions";

const PRIMARY_BTN: CSSProperties = {
  width: "100%",
  border: "none",
  borderRadius: 10,
  padding: "0.85rem 1rem",
  fontSize: "0.95rem",
  fontWeight: 650,
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};

/**
 * Barracks train flow for the bottom sheet: large quantity stepper, clear
 * cost, full-width Train / Rush actions. Max only fills the quantity — Train
 * is the commit (safer on touch than the old Max-trains-immediately shortcut).
 */
export function TrainForm({
  label,
  queueStatus,
  option,
  toTrain,
  onChangeToTrain,
  onTrain,
  onRush,
}: {
  label: string;
  queueStatus: TrainQueueStatus | null;
  option: TrainOption | SimpleTrainOption | null;
  toTrain: number;
  onChangeToTrain: (n: number) => void;
  onTrain: () => void;
  onRush?: () => void;
}) {
  if (queueStatus) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.35rem",
          padding: "0.85rem",
          borderRadius: 10,
          background: "rgba(255, 255, 255, 0.06)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          fontSize: "0.9rem",
        }}
      >
        <strong>Training in progress</strong>
        <span style={{ opacity: 0.85 }}>
          {queueStatus.remaining} {label} left
        </span>
        <span style={{ opacity: 0.7, fontSize: "0.8rem" }}>
          Next in {Math.ceil(queueStatus.msUntilNextMs / 60_000)}m
        </span>
      </div>
    );
  }

  if (!option) {
    return <p style={{ margin: 0, opacity: 0.7, fontSize: "0.85rem" }}>Cannot train {label} right now.</p>;
  }

  const disabled = !option.affordable || toTrain <= 0 || option.maxQuantity <= 0;
  const rushNoise = "rushNoise" in option ? option.rushNoise : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <span style={{ fontSize: "0.8rem", opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Quantity
        </span>
        <QuantityStepper
          label={`${label} to train`}
          value={toTrain}
          min={0}
          max={option.maxQuantity}
          onChange={onChangeToTrain}
        />
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.25rem",
          padding: "0.75rem 0.85rem",
          borderRadius: 10,
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <span style={{ fontSize: "0.75rem", opacity: 0.65 }}>Total cost</span>
        <strong style={{ fontSize: "0.95rem" }}>{formatCost(option.totalCost)}</strong>
        {!option.affordable && toTrain > 0 && (
          <span style={{ fontSize: "0.78rem", color: "#ff8080" }}>Not enough resources</span>
        )}
        {option.maxQuantity <= 0 && (
          <span style={{ fontSize: "0.78rem", color: "#ff8080" }}>At capacity or unaffordable</span>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        <button
          type="button"
          disabled={disabled}
          onClick={onTrain}
          style={{
            ...PRIMARY_BTN,
            background: disabled ? "rgba(255, 255, 255, 0.12)" : "#2e7d32",
            color: "white",
            opacity: disabled ? 0.5 : 1,
            cursor: disabled ? "default" : "pointer",
          }}
        >
          Train {toTrain > 0 ? toTrain : ""} {label}
        </button>
        {onRush && (
          <button
            type="button"
            disabled={disabled}
            onClick={onRush}
            style={{
              ...PRIMARY_BTN,
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.28)",
              color: "white",
              opacity: disabled ? 0.45 : 1,
              cursor: disabled ? "default" : "pointer",
              fontWeight: 500,
            }}
          >
            Rush
            {rushNoise !== undefined ? ` · +${rushNoise.toFixed(0)}db` : " · instant, noisy"}
          </button>
        )}
      </div>
    </div>
  );
}
