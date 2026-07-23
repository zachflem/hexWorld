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
}: {
  value: number;
  min?: number;
  max: number;
  onChange: (n: number) => void;
  /** Accessible name for the control group. */
  label: string;
  showMaxButton?: boolean;
}) {
  const clampedMax = Math.max(min, max);
  const atMin = value <= min;
  const atMax = value >= clampedMax;
  const maxDisabled = clampedMax <= min || value >= clampedMax;

  function setClamped(n: number) {
    const rounded = Number.isFinite(n) ? Math.floor(n) : min;
    onChange(Math.min(clampedMax, Math.max(min, rounded)));
  }

  return (
    <div
      role="group"
      aria-label={label}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.45rem" }}
    >
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={atMin}
        onClick={() => setClamped(value - 1)}
        style={{ ...STEP_BTN, opacity: atMin ? 0.35 : 1, cursor: atMin ? "default" : "pointer" }}
      >
        <Minus size={20} />
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
          width: 64,
          height: 44,
          textAlign: "center",
          fontSize: "1.25rem",
          fontWeight: 700,
          background: "rgba(0, 0, 0, 0.35)",
          border: "1px solid rgba(255, 255, 255, 0.18)",
          borderRadius: 10,
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
        style={{ ...STEP_BTN, opacity: atMax ? 0.35 : 1, cursor: atMax ? "default" : "pointer" }}
      >
        <Plus size={20} />
      </button>
      {showMaxButton && (
        <button
          type="button"
          disabled={maxDisabled}
          onClick={() => setClamped(clampedMax)}
          style={{
            flexShrink: 0,
            height: 44,
            background: "transparent",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            color: "white",
            borderRadius: 10,
            padding: "0 0.7rem",
            fontSize: "0.8rem",
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
