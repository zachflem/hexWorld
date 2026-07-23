import { FlaskConical, Footprints, ShieldAlert, Skull, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import type { Axial } from "../../engine/hexCoords";
import { remainingMs } from "../../engine/timers";
import type { ExpeditionsRecord } from "../../data/expeditions";
import type { DenAssaultsRecord } from "../../data/denAssaults";
import type { LabAssaultsRecord } from "../../data/labAssaults";
import type { GarrisonRecallsRecord } from "../../data/garrisonRecalls";
import { CollapsibleNotificationRow } from "./CollapsibleNotificationRow";
import { formatDuration } from "../format";

function TrayRow({
  rowKey,
  icon,
  label,
  coord,
  remaining,
  onRush,
}: {
  rowKey: string;
  icon: ReactNode;
  label: string;
  coord: Axial;
  remaining: number;
  onRush?: () => void;
}) {
  return (
    <CollapsibleNotificationRow
      rowKey={rowKey}
      icon={icon}
      panelStyle={{ padding: "0.4rem 0.65rem", fontSize: "0.8rem" }}
    >
      <span>
        {label} ({coord.q}, {coord.r})
      </span>
      {onRush && (
        <button
          type="button"
          onClick={onRush}
          style={{
            marginLeft: "0.15rem",
            padding: "0.15rem 0.45rem",
            fontSize: "0.72rem",
            fontWeight: 600,
            color: "white",
            background: "transparent",
            border: "1px solid rgba(255, 255, 255, 0.35)",
            borderRadius: 6,
            cursor: "pointer",
            WebkitTapHighlightColor: "transparent",
          }}
        >
          Rush
        </button>
      )}
      <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.7)" }}>{formatDuration(remaining)}</span>
    </CollapsibleNotificationRow>
  );
}

/**
 * Compact rows, one per active expedition/den-assault/lab-assault/garrison-recall
 * — replaces the old single grouped box (previously top-left, one internal
 * `<strong>` header per type). Renders bare rows, not its own positioned
 * container — the parent (GameScreen) composes this alongside `ToastStack`
 * inside one shared fixed top-right column so the two never overlap.
 */
export function NotificationTray({
  expeditions,
  denAssaults,
  labAssaults,
  garrisonRecalls,
  siegedDens,
  countdowns,
  now,
}: {
  expeditions: ExpeditionsRecord;
  denAssaults: DenAssaultsRecord;
  labAssaults: LabAssaultsRecord;
  garrisonRecalls: GarrisonRecallsRecord;
  /** Coord + hold-countdown for every den currently under siege — computed in GameScreen (engine/denSiegeStatusFor's math), kept to just what a row needs so this component stays presentation-only. */
  siegedDens: { coord: Axial; holdRemainingMs: number }[];
  /** Every active build/upgrade/repair timer across every owned structure (GameScreen:activeCountdownRows) — the default home for any user-created action with a countdown, not just what happens to be selected. */
  countdowns: { key: string; icon: ReactNode; label: string; coord: Axial; remainingMs: number; onRush?: () => void }[];
  now: number;
}) {
  return (
    <>
      {siegedDens.map((den) => (
        <TrayRow
          key={`siege-${den.coord.q},${den.coord.r}`}
          rowKey={`siege-${den.coord.q},${den.coord.r}`}
          icon={<ShieldAlert size={14} />}
          label="Den siege holding"
          coord={den.coord}
          remaining={den.holdRemainingMs}
        />
      ))}
      {countdowns.map((c) => (
        <TrayRow key={c.key} rowKey={c.key} icon={c.icon} label={c.label} coord={c.coord} remaining={c.remainingMs} onRush={c.onRush} />
      ))}
      {expeditions.map((expedition) => (
        <TrayRow
          key={expedition.id}
          rowKey={expedition.id}
          icon={<Footprints size={14} />}
          label="Expedition"
          coord={expedition.target}
          remaining={remainingMs(expedition.departedAt, expedition.arriveAt - expedition.departedAt, now)}
        />
      ))}
      {denAssaults.map((assault) => (
        <TrayRow
          key={assault.id}
          rowKey={assault.id}
          icon={<Skull size={14} />}
          label="Den assault"
          coord={assault.target}
          remaining={remainingMs(assault.departedAt, assault.arriveAt - assault.departedAt, now)}
        />
      ))}
      {labAssaults.map((assault) => (
        <TrayRow
          key={assault.id}
          rowKey={assault.id}
          icon={<FlaskConical size={14} />}
          label="Lab assault"
          coord={assault.target}
          remaining={remainingMs(assault.departedAt, assault.arriveAt - assault.departedAt, now)}
        />
      ))}
      {garrisonRecalls.map((recall) => (
        <TrayRow
          key={recall.id}
          rowKey={recall.id}
          icon={<Undo2 size={14} />}
          label="Garrison recalling"
          coord={recall.coord}
          remaining={remainingMs(recall.departedAt, recall.arriveAt - recall.departedAt, now)}
        />
      ))}
    </>
  );
}
