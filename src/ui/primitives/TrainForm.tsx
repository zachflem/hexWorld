import { QuantityStepper } from "./QuantityStepper";
import { formatCost, formatDuration } from "../format";
import type { SimpleTrainOption, TrainOption, TrainQueueStatus } from "../tileOptions";
import { SheetButton } from "./SheetButton";
import { SheetInfoCard } from "./SheetListItem";

/**
 * Barracks train flow for the bottom sheet: compact quantity stepper, inline
 * cost, and sticky Train / Rush so the commit stays reachable without scrolling.
 * Max only fills the quantity — Train is the commit.
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
      <SheetInfoCard>
        <strong style={{ fontSize: "0.9rem" }}>Training in progress</strong>
        <span style={{ opacity: 0.85 }}>
          {queueStatus.remaining} {label} left
        </span>
        <span style={{ opacity: 0.7, fontSize: "0.8rem" }}>
          Next in {formatDuration(queueStatus.msUntilNextMs)}
        </span>
      </SheetInfoCard>
    );
  }

  if (!option) {
    return <p style={{ margin: 0, opacity: 0.7, fontSize: "0.85rem" }}>Cannot train {label} right now.</p>;
  }

  const disabled = !option.affordable || toTrain <= 0 || option.maxQuantity <= 0;
  const rushNoise = "rushNoise" in option ? option.rushNoise : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
      <QuantityStepper
        label={`${label} to train`}
        value={toTrain}
        min={0}
        max={option.maxQuantity}
        onChange={onChangeToTrain}
      />

      <div style={{ fontSize: "0.8rem", lineHeight: 1.35 }}>
        <span style={{ opacity: 0.7 }}>Cost </span>
        <strong>{formatCost(option.totalCost)}</strong>
        {!option.affordable && toTrain > 0 && (
          <span style={{ color: "#ff8080" }}> · not enough resources</span>
        )}
        {option.maxQuantity <= 0 && <span style={{ color: "#ff8080" }}> · at capacity</span>}
      </div>

      <div
        style={{
          position: "sticky",
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
          paddingTop: "0.35rem",
          // Match sheet body so sticky actions cover scrolling content underneath.
          background: "rgba(20, 20, 22, 0.96)",
        }}
      >
        <SheetButton compact disabled={disabled} onClick={onTrain}>
          Train
        </SheetButton>
        {onRush && (
          <SheetButton compact variant="secondary" disabled={disabled} onClick={onRush}>
            Rush{rushNoise !== undefined ? ` · +${rushNoise.toFixed(0)}` : ""}
          </SheetButton>
        )}
      </div>
    </div>
  );
}
