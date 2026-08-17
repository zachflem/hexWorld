import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { hexToHsl, hslToHex, hslToRgb } from "./colorUtils";

const WHEEL_SIZE = 220;
const WHEEL_RADIUS = 96;
const WHEEL_CENTER = WHEEL_SIZE / 2;

function drawColorWheel(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const image = ctx.createImageData(WHEEL_SIZE, WHEEL_SIZE);
  for (let y = 0; y < WHEEL_SIZE; y += 1) {
    for (let x = 0; x < WHEEL_SIZE; x += 1) {
      const dx = x - WHEEL_CENTER + 0.5;
      const dy = y - WHEEL_CENTER + 0.5;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const index = (y * WHEEL_SIZE + x) * 4;

      if (distance > WHEEL_RADIUS) {
        image.data[index + 3] = 0;
        continue;
      }

      const hue = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      const sat = (distance / WHEEL_RADIUS) * 100;
      const { r, g, b } = hslToRgb(hue, sat, 50);

      image.data[index] = r;
      image.data[index + 1] = g;
      image.data[index + 2] = b;
      image.data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
}

function pickHueSat(clientX: number, clientY: number, rect: DOMRect) {
  const scaleX = WHEEL_SIZE / rect.width;
  const scaleY = WHEEL_SIZE / rect.height;
  const x = (clientX - rect.left) * scaleX - WHEEL_CENTER;
  const y = (clientY - rect.top) * scaleY - WHEEL_CENTER;
  const distance = Math.min(Math.sqrt(x * x + y * y), WHEEL_RADIUS);
  const hue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const sat = (distance / WHEEL_RADIUS) * 100;
  return { hue, sat };
}

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dragging, setDragging] = useState(false);
  const hsl = useMemo(() => hexToHsl(value), [value]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawColorWheel(canvas);
  }, []);

  const updateFromWheel = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const { hue, sat } = pickHueSat(clientX, clientY, canvas.getBoundingClientRect());
      onChange(hslToHex(hue, sat, hsl.l));
    },
    [hsl.l, onChange],
  );

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    updateFromWheel(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging) return;
    updateFromWheel(event.clientX, event.clientY);
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const markerAngle = (hsl.h * Math.PI) / 180;
  const markerRadius = (hsl.s / 100) * WHEEL_RADIUS;
  const markerX = WHEEL_CENTER + Math.cos(markerAngle) * markerRadius;
  const markerY = WHEEL_CENTER + Math.sin(markerAngle) * markerRadius;
  const markerLeft = (markerX / WHEEL_SIZE) * 100;
  const markerTop = (markerY / WHEEL_SIZE) * 100;

  const lightnessGradient = `linear-gradient(to right, ${hslToHex(hsl.h, hsl.s, 0)}, ${hslToHex(hsl.h, hsl.s, 50)}, ${hslToHex(hsl.h, hsl.s, 100)})`;

  return (
    <div className="onboarding-color-picker" id={id} aria-labelledby={ariaLabelledBy}>
      <div className="onboarding-color-picker__wheel-wrap">
        <canvas
          ref={canvasRef}
          className="onboarding-color-picker__wheel"
          width={WHEEL_SIZE}
          height={WHEEL_SIZE}
          aria-label="Choose hue and saturation"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
        <span
          className="onboarding-color-picker__marker"
          style={{ left: `${markerLeft}%`, top: `${markerTop}%` }}
          aria-hidden="true"
        />
      </div>

      <label className="onboarding-color-picker__lightness-row">
        <span>Lightness</span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(hsl.l)}
          onChange={(event) =>
            onChange(hslToHex(hsl.h, hsl.s, Number(event.target.value)))
          }
          aria-label="Lightness"
          style={{ background: lightnessGradient }}
          className="onboarding-color-picker__lightness"
        />
      </label>

      <div className="onboarding-color-picker__footer">
        <div
          className="onboarding-color-picker__preview"
          style={{ backgroundColor: value }}
          aria-hidden="true"
        />
        <p className="onboarding-color-picker__hex" aria-live="polite">
          {value.toUpperCase()}
        </p>
      </div>
    </div>
  );
}
