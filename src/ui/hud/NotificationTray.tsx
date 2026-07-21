import { FlaskConical, Footprints, Skull, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import type { Axial } from "../../engine/hexCoords";
import { remainingMs } from "../../engine/timers";
import type { ExpeditionsRecord } from "../../data/expeditions";
import type { DenAssaultsRecord } from "../../data/denAssaults";
import type { LabAssaultsRecord } from "../../data/labAssaults";
import type { GarrisonRecallsRecord } from "../../data/garrisonRecalls";
import { Panel } from "../primitives/Panel";
import { formatDuration } from "../format";

function TrayRow({ icon, label, coord, remaining }: { icon: ReactNode; label: string; coord: Axial; remaining: number }) {
  return (
    <Panel style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.65rem", fontSize: "0.8rem" }}>
      {icon}
      <span>
        {label} ({coord.q}, {coord.r})
      </span>
      <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.7)" }}>{formatDuration(remaining)}</span>
    </Panel>
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
  now,
}: {
  expeditions: ExpeditionsRecord;
  denAssaults: DenAssaultsRecord;
  labAssaults: LabAssaultsRecord;
  garrisonRecalls: GarrisonRecallsRecord;
  now: number;
}) {
  return (
    <>
      {expeditions.map((expedition) => (
        <TrayRow
          key={expedition.id}
          icon={<Footprints size={14} />}
          label="Expedition"
          coord={expedition.target}
          remaining={remainingMs(expedition.departedAt, expedition.arriveAt - expedition.departedAt, now)}
        />
      ))}
      {denAssaults.map((assault) => (
        <TrayRow
          key={assault.id}
          icon={<Skull size={14} />}
          label="Den assault"
          coord={assault.target}
          remaining={remainingMs(assault.departedAt, assault.arriveAt - assault.departedAt, now)}
        />
      ))}
      {labAssaults.map((assault) => (
        <TrayRow
          key={assault.id}
          icon={<FlaskConical size={14} />}
          label="Lab assault"
          coord={assault.target}
          remaining={remainingMs(assault.departedAt, assault.arriveAt - assault.departedAt, now)}
        />
      ))}
      {garrisonRecalls.map((recall) => (
        <TrayRow
          key={recall.id}
          icon={<Undo2 size={14} />}
          label="Garrison recalling"
          coord={recall.coord}
          remaining={remainingMs(recall.departedAt, recall.arriveAt - recall.departedAt, now)}
        />
      ))}
    </>
  );
}
