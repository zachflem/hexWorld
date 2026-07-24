import { FlaskConical, Footprints, ShieldAlert, Skull, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import type { Axial } from "../../engine/hexCoords";
import { remainingMs } from "../../engine/timers";
import type { ExpeditionsRecord } from "../../data/expeditions";
import type { DenAssaultsRecord } from "../../data/denAssaults";
import type { LabAssaultsRecord } from "../../data/labAssaults";
import type { GarrisonRecallsRecord } from "../../data/garrisonRecalls";
import { CollapsibleNotificationRow, NOTIFICATION_ICON_SIZE } from "./CollapsibleNotificationRow";
import { CoordLink, coordLinkStyle } from "./CoordLink";
import { formatDuration } from "../format";

function TrayActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
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
      {label}
    </button>
  );
}

function TrayRow({
  rowKey,
  icon,
  label,
  coord,
  remaining,
  onRush,
  onLabelClick,
  onGoToTile,
  actions,
  expandedMs,
  highlightPeek,
}: {
  rowKey: string;
  icon: ReactNode;
  label: string;
  coord?: Axial;
  remaining: number;
  onRush?: () => void;
  /** When set (and no coord), the label itself is tappable — e.g. open the Research panel. */
  onLabelClick?: () => void;
  onGoToTile?: (coord: Axial) => void;
  actions?: { label: string; onClick: () => void }[];
  expandedMs?: number;
  highlightPeek?: boolean;
}) {
  const labelNode =
    onLabelClick != null ? (
      <button type="button" onClick={onLabelClick} style={coordLinkStyle}>
        {label}
      </button>
    ) : (
      <span>{label}</span>
    );

  return (
    <CollapsibleNotificationRow
      rowKey={rowKey}
      icon={icon}
      panelStyle={{ padding: "0.4rem 0.65rem", fontSize: "0.8rem" }}
      expandedMs={expandedMs}
      highlightPeek={highlightPeek}
    >
      {labelNode}
      {coord != null && onGoToTile != null ? (
        <>
          {" "}
          <CoordLink coord={coord} onGoToTile={onGoToTile} />
        </>
      ) : null}
      {onRush && <TrayActionButton label="Rush" onClick={onRush} />}
      {actions?.map((a) => (
        <TrayActionButton key={a.label} label={a.label} onClick={a.onClick} />
      ))}
      <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.7)" }}>{formatDuration(remaining)}</span>
    </CollapsibleNotificationRow>
  );
}

export type NotificationCountdownRow = {
  key: string;
  icon: ReactNode;
  label: string;
  remainingMs: number;
  coord?: Axial;
  onRush?: () => void;
  onLabelClick?: () => void;
};

/**
 * Compact rows, one per active expedition/den-assault/lab-assault/garrison-recall.
 * Arrival decisions linger longer with a highlighted collapsed pill.
 */
export function NotificationTray({
  expeditions,
  denAssaults,
  labAssaults,
  garrisonRecalls,
  siegedDens,
  countdowns,
  now,
  arrivalExpandedMs,
  onGoToTile,
  onRecallExpedition,
  onBeginRedeploy,
  onBeginReinforce,
}: {
  expeditions: ExpeditionsRecord;
  denAssaults: DenAssaultsRecord;
  labAssaults: LabAssaultsRecord;
  garrisonRecalls: GarrisonRecallsRecord;
  siegedDens: { coord: Axial; holdRemainingMs: number }[];
  countdowns: NotificationCountdownRow[];
  now: number;
  arrivalExpandedMs?: number;
  onGoToTile?: (coord: Axial) => void;
  onRecallExpedition?: (expeditionId: string) => void;
  onBeginRedeploy?: (expeditionId: string) => void;
  onBeginReinforce?: (expeditionId: string) => void;
}) {
  return (
    <>
      {siegedDens.map((den) => (
        <TrayRow
          key={`siege-${den.coord.q},${den.coord.r}`}
          rowKey={`siege-${den.coord.q},${den.coord.r}`}
          icon={<ShieldAlert size={NOTIFICATION_ICON_SIZE} />}
          label="Den siege holding"
          coord={den.coord}
          remaining={den.holdRemainingMs}
          onGoToTile={onGoToTile}
        />
      ))}
      {countdowns.map((c) => (
        <TrayRow
          key={c.key}
          rowKey={c.key}
          icon={c.icon}
          label={c.label}
          coord={c.coord}
          remaining={c.remainingMs}
          onRush={c.onRush}
          onLabelClick={c.onLabelClick}
          onGoToTile={onGoToTile}
        />
      ))}
      {expeditions.map((expedition) => {
        const phase = expedition.phase ?? "marching";
        if (phase === "awaitingOrders") {
          const deadline = expedition.decisionDeadlineAt ?? now;
          return (
            <TrayRow
              key={expedition.id}
              rowKey={expedition.id}
              icon={<Footprints size={NOTIFICATION_ICON_SIZE} />}
              label="We made it. Where to next, boss?"
              coord={expedition.target}
              remaining={Math.max(0, deadline - now)}
              onGoToTile={onGoToTile}
              expandedMs={arrivalExpandedMs}
              highlightPeek
              actions={[
                ...(onBeginRedeploy
                  ? [{ label: "Redeploy", onClick: () => onBeginRedeploy(expedition.id) }]
                  : []),
                ...(onBeginReinforce
                  ? [{ label: "Reinforce", onClick: () => onBeginReinforce(expedition.id) }]
                  : []),
                ...(onRecallExpedition
                  ? [{ label: "Recall", onClick: () => onRecallExpedition(expedition.id) }]
                  : []),
              ]}
            />
          );
        }
        const label =
          phase === "recalling"
            ? "Expedition returning"
            : phase === "reinforcing"
              ? "Reinforcements"
              : "Expedition";
        return (
          <TrayRow
            key={expedition.id}
            rowKey={expedition.id}
            icon={<Footprints size={NOTIFICATION_ICON_SIZE} />}
            label={label}
            coord={expedition.target}
            remaining={remainingMs(expedition.departedAt, expedition.arriveAt - expedition.departedAt, now)}
            onGoToTile={onGoToTile}
            actions={
              phase === "marching" && onRecallExpedition
                ? [{ label: "Recall", onClick: () => onRecallExpedition(expedition.id) }]
                : undefined
            }
          />
        );
      })}
      {denAssaults.map((assault) => (
        <TrayRow
          key={assault.id}
          rowKey={assault.id}
          icon={<Skull size={NOTIFICATION_ICON_SIZE} />}
          label="Den assault"
          coord={assault.target}
          remaining={remainingMs(assault.departedAt, assault.arriveAt - assault.departedAt, now)}
          onGoToTile={onGoToTile}
        />
      ))}
      {labAssaults.map((assault) => (
        <TrayRow
          key={assault.id}
          rowKey={assault.id}
          icon={<FlaskConical size={NOTIFICATION_ICON_SIZE} />}
          label="Lab assault"
          coord={assault.target}
          remaining={remainingMs(assault.departedAt, assault.arriveAt - assault.departedAt, now)}
          onGoToTile={onGoToTile}
        />
      ))}
      {garrisonRecalls.map((recall) => (
        <TrayRow
          key={recall.id}
          rowKey={recall.id}
          icon={<Undo2 size={NOTIFICATION_ICON_SIZE} />}
          label="Garrison recalling"
          coord={recall.coord}
          remaining={remainingMs(recall.departedAt, recall.arriveAt - recall.departedAt, now)}
          onGoToTile={onGoToTile}
        />
      ))}
    </>
  );
}
