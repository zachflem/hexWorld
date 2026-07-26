import { FlaskConical } from "lucide-react";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import type { Axial } from "../../engine/hexCoords";
import { remainingMs } from "../../engine/timers";
import type { LabAssaultRecord } from "../../data/labAssaults";
import { normalizeLabAssault } from "../../data/labAssaults";
import { formatDuration } from "../format";
import { CoordLink } from "./CoordLink";
import "./labAssaultCeremony.css";

/**
 * Win-condition ceremony for an in-flight lab assault — full-width top banner
 * (pushes the resource HUD down) plus a pulsing viewport perimeter. Not a tray row.
 */
export function LabAssaultCeremony({
  assault: raw,
  now,
  onGoToTile,
  onRecall,
  onBannerHeight,
}: {
  assault: LabAssaultRecord;
  now: number;
  onGoToTile?: (coord: Axial) => void;
  onRecall?: (assaultId: string) => void;
  /** Scaled/layout height including safe-area — ResourceHud + tray sit below. */
  onBannerHeight?: (height: number) => void;
}) {
  const assault = normalizeLabAssault(raw);
  const bannerRef = useRef<HTMLDivElement>(null);
  const recalling = assault.phase === "recalling";
  const remaining = remainingMs(assault.departedAt, assault.arriveAt - assault.departedAt, now);
  const force =
    assault.militiaCommitted + assault.junkyardKnightCommitted + assault.crossBowSniperCommitted;

  useLayoutEffect(() => {
    const el = bannerRef.current;
    if (!el) return;
    const report = () => onBannerHeight?.(el.getBoundingClientRect().height);
    report();
    const ro = new ResizeObserver(report);
    ro.observe(el);
    return () => {
      ro.disconnect();
      onBannerHeight?.(0);
    };
  }, [onBannerHeight]);

  let sub: ReactNode;
  if (recalling) {
    sub = "Party aborting — marching home.";
  } else if (force > 0) {
    sub = (
      <>
        {force} fighter{force === 1 ? "" : "s"} en route to the guardian. The cure is within reach.
      </>
    );
  } else {
    sub = "The cure is within reach.";
  }

  return (
    <>
      <div className="lab-assault-perimeter" aria-hidden />
      <div
        ref={bannerRef}
        className="lab-assault-banner"
        role="status"
        aria-live="polite"
        aria-label={recalling ? "Lab assault returning" : "Lab assault in progress"}
      >
        <div className="lab-assault-banner__inner">
          <div className="lab-assault-banner__lead">
            <span className="lab-assault-banner__icon" aria-hidden>
              <FlaskConical size={22} strokeWidth={2.4} />
            </span>
            <div className="lab-assault-banner__copy">
              <div className="lab-assault-banner__eyebrow">
                {recalling ? "Mission aborted" : "Win condition"}
              </div>
              <h2 className="lab-assault-banner__title">
                {recalling ? "Lab assault returning" : "The lab assault"}
              </h2>
              <p className="lab-assault-banner__sub">{sub}</p>
            </div>
          </div>
          <div className="lab-assault-banner__actions">
            <div className="lab-assault-banner__meta">
              {onGoToTile ? (
                <CoordLink coord={assault.target} onGoToTile={onGoToTile} />
              ) : (
                <span>
                  ({assault.target.q}, {assault.target.r})
                </span>
              )}
              <span className="lab-assault-banner__eta">{formatDuration(remaining)}</span>
            </div>
            {!recalling && onRecall ? (
              <button
                type="button"
                className="lab-assault-banner__recall"
                onClick={() => onRecall(assault.id)}
              >
                Recall
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
