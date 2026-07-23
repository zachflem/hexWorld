import { Minus, Plus } from "lucide-react";
import type { CSSProperties } from "react";

const STEP_BTN: CSSProperties = {
  width: 44,
  height: 44,
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  borderRadius: 10,
  color: "white",
  cursor: "pointer",
  padding: 0,
  WebkitTapHighlightColor: "transparent",
};

const STEP_BTN_COMPACT: CSSProperties = {
  ...STEP_BTN,
  width: 36,
  height: 36,
  borderRadius: 8,
};

/**
 * Mobile-first quantity control: − / + hit targets with a centered value and
 * an inline Max — keeps the whole control on one row for sheet forms.
 */
export function QuantityStepper({
  value,
  min = 0,
  max,
  onChange,
  label,
  showMaxButton = true,
  compact = false,
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (n: number) => void;
  /** Accessible name for the control group. */
  label: string;
  showMaxButton?: boolean;
  /** Smaller hit targets for dense multi-unit sheet rows (garrison). */
  compact?: boolean;
}) {
  const clampedMax = Math.max(min, max);
  const atMin = value <= min;
  const atMax = value >= clampedMax;
  const maxDisabled = clampedMax <= min || value >= clampedMax;
  const btnStyle = compact ? STEP_BTN_COMPACT : STEP_BTN;
  const controlHeight = compact ? 36 : 44;
  const iconSize = compact ? 16 : 20;

  function setClamped(n: number) {
    const rounded = Number.isFinite(n) ? Math.floor(n) : min;
    onChange(Math.min(clampedMax, Math.max(min, rounded)));
  }

  return (
    <div
      role="group"
      aria-label={label}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: compact ? "0.3rem" : "0.45rem" }}
    >
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={atMin}
        onClick={() => setClamped(value - 1)}
        style={{ ...btnStyle, opacity: atMin ? 0.35 : 1, cursor: atMin ? "default" : "pointer" }}
      >
        <Minus size={iconSize} />
      </button>
      <input
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={label}
        value={Number.isFinite(value) ? String(value) : "0"}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, "");
          if (raw === "") {
            onChange(min);
            return;
          }
          setClamped(Number(raw));
        }}
        style={{
          width: compact ? 48 : 64,
          height: controlHeight,
          textAlign: "center",
          fontSize: compact ? "1.05rem" : "1.25rem",
          fontWeight: 700,
          background: "rgba(0, 0, 0, 0.35)",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          borderRadius: compact ? 8 : 10,
          color: "white",
          appearance: "textfield",
          MozAppearance: "textfield",
        }}
      />
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={atMax}
        onClick={() => setClamped(value + 1)}
        style={{ ...btnStyle, opacity: atMax ? 0.35 : 1, cursor: atMax ? "default" : "pointer" }}
      >
        <Plus size={iconSize} />
      </button>
      {showMaxButton && (
        <button
          type="button"
          disabled={maxDisabled}
          onClick={() => setClamped(clampedMax)}
          style={{
            flexShrink: 0,
            height: controlHeight,
            background: "transparent",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            color: "white",
            borderRadius: compact ? 8 : 10,
            padding: compact ? "0 0.5rem" : "0 0.7rem",
            fontSize: compact ? "0.72rem" : "0.8rem",
            cursor: maxDisabled ? "default" : "pointer",
            opacity: maxDisabled ? 0.4 : 1,
          }}
        >
          Max
        </button>
      )}
    </div>
  );
}
