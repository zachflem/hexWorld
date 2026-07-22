import type { GarrisonsRecord } from "../../data/garrisons";
import type { GarrisonRecallsRecord } from "../../data/garrisonRecalls";
import { remainingMs } from "../../engine/timers";
import { Panel } from "../primitives/Panel";
import { formatDuration } from "../format";

/** Every garrisoned tile at a glance, plus any recalls currently marching home — previously only visible by clicking each tile individually. */
export function GarrisonsPanel({
  garrisons,
  garrisonRecalls,
  now,
  onClose,
}: {
  garrisons: GarrisonsRecord;
  garrisonRecalls: GarrisonRecallsRecord;
  now: number;
  onClose: () => void;
}) {
  return (
    <Panel style={{ position: "fixed", right: "1rem", bottom: "4.5rem", width: 300, fontSize: "0.85rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: "1rem" }}>Garrisons</strong>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div style={{ marginTop: "0.5rem" }}>
        {garrisons.length === 0 ? (
          <p style={{ opacity: 0.7 }}>No garrisons stationed.</p>
        ) : (
          garrisons.map((garrison) => (
            <div key={`${garrison.coord.q},${garrison.coord.r}`} style={{ padding: "0.25rem 0" }}>
              ({garrison.coord.q}, {garrison.coord.r}) — {garrison.militiaCount} militia
              {garrison.junkyardKnightCount > 0 && `, ${garrison.junkyardKnightCount} knights`}
              {garrison.crossBowSniperCount > 0 && `, ${garrison.crossBowSniperCount} snipers`}
            </div>
          ))
        )}
      </div>

      {garrisonRecalls.length > 0 && (
        <div style={{ marginTop: "0.75rem" }}>
          <div style={{ opacity: 0.8, marginBottom: "0.25rem" }}>Recalling</div>
          {garrisonRecalls.map((recall) => (
            <div key={recall.id} style={{ padding: "0.15rem 0" }}>
              ({recall.coord.q}, {recall.coord.r}) —{" "}
              {formatDuration(remainingMs(recall.departedAt, recall.arriveAt - recall.departedAt, now))}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
