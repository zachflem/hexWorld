import { useMemo } from "react";
import { hexToRgb, rgbToHex } from "./colorUtils";

export function InlineColorPicker({
  id,
  value,
  onChange,
  "aria-labelledby": ariaLabelledBy,
}: {
  id: string;
  value: string;
  onChange: (hex: string) => void;
  "aria-labelledby"?: string;
}) {
  const rgb = useMemo(() => hexToRgb(value) ?? { r: 134, g: 59, b: 255 }, [value]);

  function setChannel(channel: "r" | "g" | "b", next: number) {
    onChange(rgbToHex(channel === "r" ? next : rgb.r, channel === "g" ? next : rgb.g, channel === "b" ? next : rgb.b));
  }

  return (
    <div className="onboarding-color-picker" id={id} aria-labelledby={ariaLabelledBy}>
      <div
        className="onboarding-color-picker__preview"
        style={{ backgroundColor: value }}
        aria-hidden="true"
      />
      <div className="onboarding-color-picker__sliders">
        {(["r", "g", "b"] as const).map((channel) => (
          <label key={channel} className="onboarding-color-picker__slider-row">
            <span className="onboarding-color-picker__channel">{channel.toUpperCase()}</span>
            <input
              type="range"
              min={0}
              max={255}
              value={rgb[channel]}
              onChange={(event) => setChannel(channel, Number(event.target.value))}
              aria-label={`${channel.toUpperCase()} channel`}
            />
            <span className="onboarding-color-picker__value">{rgb[channel]}</span>
          </label>
        ))}
      </div>
      <p className="onboarding-color-picker__hex" aria-live="polite">
        {value.toUpperCase()}
      </p>
    </div>
  );
}
