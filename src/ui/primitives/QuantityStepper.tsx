import { Minus, Plus } from "lucide-react";
import type { CSSProperties } from "react";

const STEP_BTN: CSSProperties = {
  width: 48,
  height: 48,
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
 * Mobile-first quantity control: large − / + hit targets with a centered
 * value. Avoids native number-input spinners, which are unusable on touch.
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

  function setClamped(n: number) {
    const rounded = Number.isFinite(n) ? Math.floor(n) : min;
    onChange(Math.min(clampedMax, Math.max(min, rounded)));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
      <div
        role="group"
        aria-label={label}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.65rem" }}
      >
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={atMin}
          onClick={() => setClamped(value - 1)}
          style={{ ...STEP_BTN, opacity: atMin ? 0.35 : 1, cursor: atMin ? "default" : "pointer" }}
        >
          <Minus size={22} />
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
            width: 72,
            height: 48,
            textAlign: "center",
            fontSize: "1.35rem",
            fontWeight: 700,
            background: "rgba(0, 0, 0, 0.35)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: 10,
            color: "white",
            // Hide native spinners if a browser still treats this as numeric.
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
          <Plus size={22} />
        </button>
      </div>
      {showMaxButton && (
        <button
          type="button"
          disabled={clampedMax <= min || value >= clampedMax}
          onClick={() => setClamped(clampedMax)}
          style={{
            alignSelf: "center",
            background: "transparent",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            color: "white",
            borderRadius: 8,
            padding: "0.4rem 0.9rem",
            fontSize: "0.85rem",
            cursor: clampedMax <= min || value >= clampedMax ? "default" : "pointer",
            opacity: clampedMax <= min || value >= clampedMax ? 0.4 : 1,
          }}
        >
          Max ({clampedMax})
        </button>
      )}
    </div>
  );
}
