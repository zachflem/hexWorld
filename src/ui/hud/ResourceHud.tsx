import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { RESOURCE_ORDER, type ResourceAmounts, type ResourceType } from "../../data/resources";
import { resolveAssetPath } from "../../render/assetPaths";
import { Panel } from "../primitives/Panel";

/** Natural (unscaled) icon size — the whole HUD scales down on narrow viewports. */
const ICON_SIZE = 32;

function resourceIcon(resource: ResourceType, size = ICON_SIZE) {
  return (
    <img
      src={resolveAssetPath("markers", `icon-${resource}.png`)}
      width={size}
      height={size}
      alt=""
      style={{ objectFit: "contain" }}
    />
  );
}

function noiseIcon(size = ICON_SIZE) {
  return (
    <img
      src={resolveAssetPath("markers", "icon-noise.png")}
      width={size}
      height={size}
      alt=""
      style={{ objectFit: "contain" }}
    />
  );
}

/** icon + value(+delta) chip — the HUD bar's atom. Tuned for the dark floating Panel HUD. */
function StatChip({
  icon,
  value,
  delta,
  title,
  separator = false,
}: {
  icon?: ReactNode;
  value: ReactNode;
  /** Signed rate, shown as "+84"/"-12" in green/red — omitted entirely when 0. */
  delta?: number;
  title?: string;
  /** Hairline rule before this chip so the row reads as one instrument cluster. */
  separator?: boolean;
}) {
  const showDelta = delta !== undefined && Math.round(delta) !== 0;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.35rem",
        fontSize: "1rem",
        color: "white",
        lineHeight: 1.15,
        borderLeft: separator ? "1px solid rgba(255, 255, 255, 0.12)" : undefined,
        paddingLeft: separator ? "0.7rem" : undefined,
        paddingRight: "0.7rem",
        flex: "0 0 auto",
      }}
      title={title}
    >
      {icon}
      <span style={{ position: "relative", fontWeight: 600 }}>
        {value}
        {showDelta && (
          <span
            style={{
              position: "absolute",
              left: "100%",
              bottom: "70%",
              marginLeft: "0.15rem",
              fontSize: "0.72rem",
              lineHeight: 1,
              fontWeight: 500,
              whiteSpace: "nowrap",
              color: delta > 0 ? "#81c784" : "#ef5350",
              pointerEvents: "none",
            }}
          >
            {delta > 0 ? "+" : ""}
            {Math.round(delta)}
          </span>
        )}
      </span>
    </span>
  );
}

/**
 * Floating top-left resource/noise instrument cluster. Renders at a natural max
 * size on large screens; on narrow viewports the whole bar scales down uniformly
 * so it never wraps.
 */
export function ResourceHud({
  resources,
  resourceRates,
  noiseValue,
  onLayoutMetrics,
}: {
  resources: ResourceAmounts;
  resourceRates: ResourceAmounts;
  noiseValue: number;
  /** Fired when the bar's scaled height or shrink factor changes — used to tuck notifications below the HUD on narrow viewports. */
  onLayoutMetrics?: (metrics: { height: number; scale: number }) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ scale: 1, height: 0 });

  useLayoutEffect(() => {
    const frame = frameRef.current;
    const content = contentRef.current;
    if (!frame || !content) return;

    const update = () => {
      const available = frame.clientWidth;
      const naturalW = content.offsetWidth;
      const naturalH = content.offsetHeight;
      if (naturalW <= 0) return;
      const scale = Math.min(1, available / naturalW);
      setMetrics((prev) => {
        const height = naturalH * scale;
        if (Math.abs(prev.scale - scale) < 0.001 && Math.abs(prev.height - height) < 0.5) return prev;
        return { scale, height };
      });
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(frame);
    ro.observe(content);
    return () => ro.disconnect();
  }, [resources, resourceRates, noiseValue]);

  useLayoutEffect(() => {
    onLayoutMetrics?.({ height: metrics.height, scale: metrics.scale });
  }, [metrics.height, metrics.scale, onLayoutMetrics]);

  return (
    <div
      ref={frameRef}
      style={{
        position: "fixed",
        top: "max(0.65rem, env(safe-area-inset-top, 0px))",
        left: "max(0.65rem, env(safe-area-inset-left, 0px))",
        zIndex: 40,
        width:
          "min(calc(100vw - 1.3rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)), 42rem)",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: metrics.height || undefined,
          width: metrics.scale < 1 ? "100%" : "fit-content",
          pointerEvents: "auto",
        }}
      >
        <div
          ref={contentRef}
          style={{
            width: "max-content",
            transform: `scale(${metrics.scale})`,
            transformOrigin: "top left",
          }}
        >
          <Panel
            style={{
              padding: "0.55rem 0.9rem",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.35)",
            }}
          >
            <div style={{ display: "flex", flexWrap: "nowrap", alignItems: "center" }}>
              {RESOURCE_ORDER.map((type, index) => (
                <StatChip
                  key={type}
                  separator={index > 0}
                  icon={resourceIcon(type)}
                  value={Math.floor(resources[type]).toLocaleString()}
                  delta={resourceRates[type]}
                  title={type}
                />
              ))}
              <StatChip
                separator
                icon={noiseIcon()}
                value={
                  <>
                    {Math.floor(noiseValue)}
                    <span style={{ color: "rgba(255, 255, 255, 0.55)", fontWeight: 500 }}>db</span>
                  </>
                }
                title="noise"
              />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
